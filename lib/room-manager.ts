import { RealtimeChannel } from '@supabase/supabase-js';
import { GAME_CONSTANTS, type GameOverReason } from './game-constants';
import type { Bet, Prediction, RoundResults } from './game-logic';
import { calculateRoundResults, checkWinConditions } from './game-logic';
import { useGameState } from './game-state';
import { logger } from './logger';
import { supabase } from './supabase';

interface DiceResultData {
  dice: number;
  results: RoundResults;
  scores: { [playerId: string]: number };
}

interface GameOverData {
  scores: { [playerId: string]: number };
  winner?: string;
  reason?: GameOverReason;
}

interface StartGameData {
  dice: number;
}

interface BetLockedData {
  bet: Bet;
}

interface NewRoundData {
  dice: number;
}

interface PlayerJoinedData {
  opponentId: string;
}

export type RoomMessage = 
  | { type: 'bet-locked'; data: BetLockedData }
  | { type: 'dice-result'; data: DiceResultData }
  | { type: 'game-over'; data: GameOverData }
  | { type: 'start-game'; data: StartGameData }
  | { type: 'new-round'; data: NewRoundData }
  | { type: 'player-joined'; data: PlayerJoinedData }
  | { type: 'player-left' | 'opponent-ready' | 'both-ready'; data?: undefined };

class RoomManager {
  private channel: RealtimeChannel | null = null;
  private roomCode: string | null = null;
  private playerId: string | null = null;
  private isHost: boolean = false;
  private currentDice: number = GAME_CONSTANTS.DICE_MIN;
  private round: number = 0;
  private scores: { [playerId: string]: number } = {};
  private bets: { [playerId: string]: Bet } = {};
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  /**
   * Custom message handlers for extensibility.
   * Allows external code to register custom handlers for specific message types.
   */
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private isLeaving: boolean = false;

  /**
   * Generates a random 6-digit room code.
   * 
   * @returns A 6-digit room code string
   */
  generateRoomCode(): string {
    const min = 100000;
    const max = 999999;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  /**
   * Sets up channel event handlers for presence and broadcast events.
   * 
   * @param role - The player role ('host' or 'guest')
   */
  private setupChannelHandlers(role: 'host' | 'guest'): void {
    if (!this.channel) return;

    this.channel
      .on('presence', { event: 'sync' }, () => this.handlePresenceSync(role))
      .on('presence', { event: 'leave' }, (payload: any) => this.handlePresenceLeave(payload.keyPresences))
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        logger.debug('RoomManager', 'Received broadcast message', payload);
        this.handleMessage(payload as RoomMessage);
      })
      .subscribe(async (status) => this.handleSubscriptionStatus(status, role));
  }

  /**
   * Handles presence sync events when players join/leave.
   * 
   * @param role - The player role
   */
  private handlePresenceSync(role: 'host' | 'guest'): void {
    const presenceState = this.channel?.presenceState();
    const players = Object.keys(presenceState || {});
    logger.debug('RoomManager', `Presence sync | Players: ${players.length}`, players);
    
    if (players.length === 2) {
      const opponentId = players.find((id) => id !== this.playerId) || null;
      if (opponentId) {
        const { actions } = useGameState.getState();
        actions.setOpponent(opponentId);
        this.scores[opponentId] = GAME_CONSTANTS.INITIAL_SCORE;
        logger.debug('RoomManager', `Two players detected | OpponentId: ${opponentId}`);
        
        if (role === 'host') {
          this.broadcast({ type: 'player-joined', data: { opponentId } });
          this.startGame();
        }
      }
    } else if (players.length === 1) {
      logger.debug('RoomManager', 'Waiting for opponent');
    } else {
      logger.warn('RoomManager', `Unexpected player count: ${players.length}`);
    }
  }

  /**
   * Handles presence leave events when a player disconnects.
   * 
   * @param keyPresences - Array of presence keys that left
   */
  private handlePresenceLeave(keyPresences: any[]): void {
    if (!keyPresences || !Array.isArray(keyPresences)) return;
    
    keyPresences.forEach((presence) => {
      logger.debug('RoomManager', `Player left: ${presence.key}`);
      if (presence.key !== this.playerId) {
        this.handleOpponentDisconnect();
      }
    });
  }

  /**
   * Handles channel subscription status changes.
   * 
   * @param status - The subscription status
   * @param role - The player role
   */
  private async handleSubscriptionStatus(status: string, role: 'host' | 'guest'): Promise<void> {
    logger.debug('RoomManager', `Subscription status changed: ${status}`);
    
    if (status === 'SUBSCRIBED') {
      try {
        await this.channel?.track({
          playerId: this.playerId,
          role,
          online_at: new Date().toISOString(),
        });
        logger.debug('RoomManager', 'Presence tracked successfully');
      } catch (trackError) {
        logger.error('RoomManager', 'Error tracking presence', trackError);
      }
    } else if (status === 'CHANNEL_ERROR' && !this.isLeaving) {
      logger.error('RoomManager', 'Channel error occurred');
    } else if (status === 'TIMED_OUT' && !this.isLeaving) {
      logger.error('RoomManager', 'Channel subscription timed out');
    } else if (status === 'CLOSED') {
      if (this.isLeaving) {
        logger.debug('RoomManager', 'Channel closed (expected during leave)');
      } else {
        logger.error('RoomManager', 'Channel closed unexpectedly');
      }
    }
  }

  /**
   * Creates a new game room and sets up the host player.
   * 
   * @returns The generated room code
   * @throws Error if room creation fails
   */
  async createRoom(): Promise<string> {
    try {
      const code = this.generateRoomCode();
      logger.debug('RoomManager', `Creating room with code: ${code}`);
      
      this.roomCode = code;
      this.isHost = true;
      this.currentDice = Math.floor(Math.random() * (GAME_CONSTANTS.DICE_MAX - GAME_CONSTANTS.DICE_MIN + 1)) + GAME_CONSTANTS.DICE_MIN;
      this.round = 0;
      this.scores = {};
      this.bets = {};

      const { playerId, actions } = useGameState.getState();
      this.playerId = playerId;
      this.scores[this.playerId] = GAME_CONSTANTS.INITIAL_SCORE;
      
      logger.debug('RoomManager', `Room created | Initial dice: ${this.currentDice} | PlayerId: ${this.playerId}`);

      this.channel = supabase.channel(`room:${code}`, {
        config: {
          presence: {
            key: this.playerId,
          },
        },
      });

      this.setupChannelHandlers('host');

      logger.debug('RoomManager', `Room creation complete, returning code: ${code}`);
      return code;
    } catch (error) {
      logger.error('RoomManager', 'Failed to create room', error);
      throw new Error('Failed to create room. Please try again.');
    }
  }

  /**
   * Joins an existing game room as a guest player.
   * 
   * @param code - The 6-digit room code
   * @returns True if join was successful, false otherwise
   */
  async joinRoom(code: string): Promise<boolean> {
    try {
      logger.debug('RoomManager', `Attempting to join room: ${code}`);
      
      this.roomCode = code;
      this.isHost = false;

      const { playerId } = useGameState.getState();
      this.playerId = playerId;
      this.scores[this.playerId] = GAME_CONSTANTS.INITIAL_SCORE;
      
      logger.debug('RoomManager', `Room code set: ${this.roomCode} | PlayerId: ${this.playerId}`);

      this.channel = supabase.channel(`room:${code}`, {
        config: {
          presence: {
            key: this.playerId,
          },
        },
      });

      this.setupChannelHandlers('guest');

      logger.debug('RoomManager', 'Channel setup complete');
      return true;
    } catch (error) {
      logger.error('RoomManager', 'Error joining room', error);
      return false;
    }
  }

  /**
   * Starts the game after both players have joined.
   * Broadcasts start-game message and initializes the first round.
   */
  private startGame(): void {
    logger.debug('RoomManager', `Starting game | Dice: ${this.currentDice} | Round: ${this.round}`);
    setTimeout(() => {
      this.broadcast({ type: 'start-game', data: { dice: this.currentDice } });
      
      const { actions } = useGameState.getState();
      actions.startGame(this.currentDice);
      
      this.startRound();
    }, GAME_CONSTANTS.START_GAME_DELAY);
  }

  /**
   * Starts a new betting round with timer.
   */
  private startRound(): void {
    const { gamePhase, actions } = useGameState.getState();
    
    if (gamePhase === 'GAME_OVER') {
      logger.debug('RoomManager', 'Game is over, skipping new round');
      return;
    }

    this.clearTimer();

    this.round++;
    this.bets = {};
    
    actions.setCurrentDice(this.currentDice);
    actions.setGamePhase('BETTING');
    actions.unlockBet();
    actions.setMyBet(null);
    actions.setOpponentBet(null);
    actions.incrementRound();

    const isRushRound = this.round % GAME_CONSTANTS.RUSH_ROUND_INTERVAL === 0;
    const timerDuration = isRushRound 
      ? GAME_CONSTANTS.RUSH_TIMER_DURATION 
      : GAME_CONSTANTS.NORMAL_TIMER_DURATION;
    
    logger.debug('RoomManager', `Round ${this.round} started | Timer: ${timerDuration}s | Rush: ${isRushRound}`);
    
    actions.setTimeRemaining(timerDuration);
    this.startTimer(timerDuration);
  }

  /**
   * Clears the current timer interval if it exists.
   */
  private clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Starts the betting timer countdown.
   * 
   * @param duration - Timer duration in seconds
   */
  private startTimer(duration: number): void {
    let timeLeft = duration;
    const { actions } = useGameState.getState();
    
    this.timerInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft < 0) timeLeft = 0;
      
      actions.setTimeRemaining(timeLeft);

      if (timeLeft <= 0) {
        this.clearTimer();
        this.forceResolve();
      }
    }, 1000);
  }

  /**
   * Locks in a player's bet for the current round.
   * 
   * @param amount - The bet amount
   * @param prediction - The prediction (higher/lower/edge case)
   */
  lockBet(amount: number, prediction: Prediction): void {
    if (!this.playerId) return;

    const bet: Bet = {
      amount,
      prediction,
      timestamp: Date.now(),
      playerId: this.playerId,
    };

    this.bets[this.playerId] = bet;
    
    const { actions } = useGameState.getState();
    actions.setMyBet(bet);
    actions.lockBet();

    logger.debug('RoomManager', `Player ${this.playerId} locked bet: ${amount} on ${prediction}`, this.bets);

    this.broadcast({ type: 'bet-locked', data: { bet } });

    const betCount = Object.keys(this.bets).length;
    if (betCount === 2 && this.isHost) {
      logger.debug('RoomManager', 'Both players locked in, starting dice roll');
      this.rollDice();
    }
  }

  /**
   * Forces resolution of the round when timer expires.
   * Applies timeout penalty to players who didn't bet.
   */
  private forceResolve(): void {
    this.clearTimer();

    const { playerId, opponentId } = useGameState.getState();
    const allPlayerIds = [playerId, opponentId].filter(Boolean) as string[];

    allPlayerIds.forEach((pid) => {
      if (!this.bets[pid]) {
        this.scores[pid] = (this.scores[pid] || GAME_CONSTANTS.INITIAL_SCORE) - GAME_CONSTANTS.TIMEOUT_PENALTY;
        this.bets[pid] = {
          amount: 0,
          prediction: 'higher',
          timestamp: Date.now(),
          playerId: pid,
        };
      }
    });

    this.rollDice();
  }

  /**
   * Rolls the dice and resolves the round.
   * Only the host can roll dice.
   */
  private rollDice(): void {
    this.clearTimer();

    if (!this.isHost) return;

    const { gamePhase } = useGameState.getState();
    if (gamePhase === 'GAME_OVER') {
      logger.debug('RoomManager', 'Game is over, skipping roll');
      return;
    }

    const newDice = this.generateNewDiceValue();
    logger.debug('RoomManager', `Round ${this.round} | Old: ${this.currentDice} | New: ${newDice}`, this.bets);
    
    const results = calculateRoundResults(this.currentDice, newDice, this.bets);
    this.updateScores(results);

    const winCheck = checkWinConditions(this.scores, this.round);
    if (winCheck.gameOver) {
      this.handleGameEnd(newDice, results, winCheck);
    } else {
      this.handleNormalRoundEnd(newDice, results);
    }
  }

  /**
   * Generates a random dice value between 1 and 6.
   * 
   * @returns A random dice value
   */
  private generateNewDiceValue(): number {
    return Math.floor(Math.random() * (GAME_CONSTANTS.DICE_MAX - GAME_CONSTANTS.DICE_MIN + 1)) + GAME_CONSTANTS.DICE_MIN;
  }

  /**
   * Updates player scores based on round results.
   * 
   * @param results - The round results
   */
  private updateScores(results: RoundResults): void {
    const { playerId, actions } = useGameState.getState();
    
    Object.entries(results.playerResults).forEach(([pid, result]) => {
      if (!this.scores[pid]) {
        this.scores[pid] = GAME_CONSTANTS.INITIAL_SCORE;
      }
      
      const oldScore = this.scores[pid];
      this.scores[pid] += result.pointsChange + result.bonuses;
      if (this.scores[pid] < GAME_CONSTANTS.MIN_SCORE) {
        this.scores[pid] = GAME_CONSTANTS.MIN_SCORE;
      }
      
      logger.debug('RoomManager', `Player ${pid}: ${oldScore} -> ${this.scores[pid]} (+${result.pointsChange}, +${result.bonuses} bonus)`);
      
      if (pid === playerId) {
        if (result.result === 'win') {
          const currentStreak = useGameState.getState().winStreak;
          actions.setWinStreak(currentStreak + 1);
        } else if (result.result === 'loss') {
          actions.setWinStreak(0);
        }
      }
    });
  }

  /**
   * Handles game end when win conditions are met.
   * 
   * @param newDice - The new dice value
   * @param results - The round results
   * @param winCheck - The win condition check result
   */
  private handleGameEnd(newDice: number, results: RoundResults, winCheck: { gameOver: boolean; winner?: string; reason?: string }): void {
    const { playerId, opponentId, actions } = useGameState.getState();
    const winnerId = winCheck.winner || null;
    const myScore = this.scores[playerId] ?? GAME_CONSTANTS.INITIAL_SCORE;
    const oppScore = this.scores[opponentId || ''] ?? GAME_CONSTANTS.INITIAL_SCORE;
    
    logger.debug('RoomManager', `Game over | Winner: ${winnerId} | Reason: ${winCheck.reason}`, this.scores);
    
    // Broadcast dice-result first so guest can update scores before game-over
    this.broadcast({
      type: 'dice-result',
      data: {
        dice: newDice,
        results,
        scores: this.scores,
      },
    });
    
    this.currentDice = newDice;
    actions.setCurrentDice(newDice);
    actions.updateScores(myScore, oppScore);
    actions.setLastRoundResults(results);
    actions.setGamePhase('RESULTS');
    
    // Small delay to ensure dice-result is processed before game-over
    setTimeout(() => {
      actions.setGameWinner(winnerId, winCheck.reason || null);
      this.broadcast({
        type: 'game-over',
        data: {
          scores: this.scores,
          winner: winCheck.winner,
          reason: winCheck.reason as GameOverReason | undefined,
        },
      });
      actions.setGamePhase('GAME_OVER');
    }, GAME_CONSTANTS.GAME_OVER_DELAY);
    
    this.clearTimer();
  }

  /**
   * Handles normal round end (game continues).
   * 
   * @param newDice - The new dice value
   * @param results - The round results
   */
  private handleNormalRoundEnd(newDice: number, results: RoundResults): void {
    const { playerId, opponentId, actions } = useGameState.getState();
    actions.setGamePhase('REVEALING');
    
    setTimeout(() => {
      const myScore = this.scores[playerId] ?? GAME_CONSTANTS.INITIAL_SCORE;
      const oppScore = this.scores[opponentId || ''] ?? GAME_CONSTANTS.INITIAL_SCORE;
      
      logger.debug('RoomManager', `Round ${this.round} | Broadcasting dice-result`, { dice: newDice, scores: this.scores });
      
      this.broadcast({
        type: 'dice-result',
        data: {
          dice: newDice,
          results,
          scores: this.scores,
        },
      });

      this.currentDice = newDice;
      actions.setCurrentDice(newDice);
      actions.updateScores(myScore, oppScore);
      actions.setLastRoundResults(results);
      actions.setGamePhase('RESULTS');

      setTimeout(() => {
        this.broadcast({ type: 'new-round', data: { dice: this.currentDice } });
        this.startRound();
      }, GAME_CONSTANTS.NEW_ROUND_DELAY);
    }, GAME_CONSTANTS.DICE_ROLL_DELAY);
  }

  /**
   * Handles incoming room messages.
   * 
   * @param message - The room message to handle
   */
  private handleMessage(message: RoomMessage): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message.data);
      return;
    }

    switch (message.type) {
      case 'bet-locked':
        this.handleBetLocked(message.data);
        break;
      case 'start-game':
        this.handleStartGame(message.data);
        break;
      case 'dice-result':
        this.handleDiceResult(message.data);
        break;
      case 'game-over':
        this.handleGameOver(message.data);
        break;
      case 'new-round':
        this.handleNewRound(message.data);
        break;
      case 'opponent-ready':
      case 'player-left':
      case 'both-ready':
      case 'player-joined':
        // No action needed for these message types
        break;
    }
  }

  /**
   * Handles bet-locked message from opponent.
   * 
   * @param data - The bet-locked message data
   */
  private handleBetLocked(data: BetLockedData): void {
    if (data.bet.playerId === this.playerId) return;

    const { actions } = useGameState.getState();
    actions.setOpponentBet(data.bet);
    this.bets[data.bet.playerId] = data.bet;
    
    logger.debug('RoomManager', `Received opponent bet`, this.bets);
    
    if (Object.keys(this.bets).length === 2 && this.isHost) {
      logger.debug('RoomManager', 'Both players locked in, starting dice roll');
      this.rollDice();
    }
  }

  /**
   * Handles start-game message (guest only).
   * 
   * @param data - The start-game message data
   */
  private handleStartGame(data: StartGameData): void {
    if (this.isHost) return;

    logger.debug('RoomManager', `Received start-game message | Dice: ${data.dice}`);
    
    this.currentDice = data.dice;
    const { actions } = useGameState.getState();
    actions.startGame(data.dice);
    
    this.startRound();
  }

  /**
   * Handles dice-result message.
   * 
   * @param data - The dice-result message data
   */
  private handleDiceResult(data: DiceResultData): void {
    const { gamePhase, opponentId, actions } = useGameState.getState();
    
    if (gamePhase === 'GAME_OVER') {
      logger.debug('RoomManager', 'Game is over, ignoring dice-result');
      return;
    }
    
    const { dice, results, scores } = data;
    const myScore = scores[this.playerId!] ?? GAME_CONSTANTS.INITIAL_SCORE;
    const oppScore = scores[opponentId || ''] ?? GAME_CONSTANTS.INITIAL_SCORE;
    
    logger.debug('RoomManager', `Received dice-result | Dice: ${dice}`, { scores, results });
    
    this.currentDice = dice;
    this.scores = { ...scores };
    
    actions.setCurrentDice(dice);
    actions.updateScores(myScore, oppScore);
    
    const myResult = results.playerResults[this.playerId!];
    if (myResult) {
      if (myResult.result === 'win') {
        const currentStreak = useGameState.getState().winStreak;
        actions.setWinStreak(currentStreak + 1);
      } else if (myResult.result === 'loss') {
        actions.setWinStreak(0);
      }
    }
    
    actions.setLastRoundResults(results);
    actions.setGamePhase('RESULTS');
  }

  /**
   * Handles game-over message.
   * 
   * @param data - The game-over message data
   */
  private handleGameOver(data: GameOverData): void {
    const { opponentId, actions } = useGameState.getState();
    const winnerId = data.winner || null;
    const finalScores = data.scores || {};
    const finalMyScore = finalScores[this.playerId!] ?? GAME_CONSTANTS.INITIAL_SCORE;
    const finalOppScore = finalScores[opponentId || ''] ?? GAME_CONSTANTS.INITIAL_SCORE;
    
    logger.debug('RoomManager', `Game over | Winner: ${winnerId} | Reason: ${data.reason}`, finalScores);
    
    this.scores = { ...finalScores };
    actions.setGameWinner(winnerId, data.reason || null);
    actions.setGamePhase('GAME_OVER');
    actions.updateScores(finalMyScore, finalOppScore);
    
    const finalState = useGameState.getState();
    if (finalState.myScore !== finalMyScore || finalState.opponentScore !== finalOppScore) {
      logger.error('RoomManager', 'Score mismatch after game-over', {
        expected: { my: finalMyScore, opp: finalOppScore },
        actual: { my: finalState.myScore, opp: finalState.opponentScore },
      });
    }
  }

  /**
   * Handles new-round message (guest only).
   * 
   * @param data - The new-round message data
   */
  private handleNewRound(data: NewRoundData): void {
    if (this.isHost) return;

    const { gamePhase, actions } = useGameState.getState();
    
    if (gamePhase === 'GAME_OVER') {
      logger.debug('RoomManager', 'Game is over, ignoring new-round');
      return;
    }
    
    logger.debug('RoomManager', `Received new-round message | Dice: ${data.dice}`);
    
    this.clearTimer();
    
    if (data.dice) {
      this.currentDice = data.dice;
      actions.setCurrentDice(data.dice);
    }
    
    this.startRound();
  }

  /**
   * Handles opponent disconnection.
   */
  private handleOpponentDisconnect(): void {
    const { playerId, actions } = useGameState.getState();
    actions.setGameWinner(playerId, 'opponent_disconnected');
    actions.setGamePhase('GAME_OVER');
  }

  /**
   * Broadcasts a message to all players in the room.
   * 
   * @param message - The message to broadcast
   */
  private broadcast(message: RoomMessage): void {
    this.channel?.send({
      type: 'broadcast',
      event: 'message',
      payload: message,
    });
  }

  /**
   * Registers a custom message handler for a specific message type.
   * 
   * @param type - The message type
   * @param handler - The handler function
   */
  onMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Leaves the current room and cleans up resources.
   */
  async leaveRoom(): Promise<void> {
    const role = this.isHost ? 'HOST' : 'GUEST';
    logger.debug('RoomManager', `Leaving room | Role: ${role} | Code: ${this.roomCode}`);
    
    this.isLeaving = true;
    this.clearTimer();
    
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }
    
    this.roomCode = null;
    this.playerId = null;
    this.isHost = false;
    this.bets = {};
    this.scores = {};
    this.isLeaving = false;
    
    logger.debug('RoomManager', 'Room left successfully');
  }
}

export const roomManager = new RoomManager();

