import { RealtimeChannel } from '@supabase/supabase-js';
import { type GameOverReason } from './game-constants';
import { gameConfig } from './game-config';
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
  isRushRound?: boolean;
}

interface BetLockedData {
  bet: Bet;
}

interface NewRoundData {
  dice: number;
  round: number;
  isRushRound?: boolean;
}

interface PlayerJoinedData {
  opponentId: string;
}

interface TimerSyncData {
  startTimestamp: number;
  duration: number;
}

export type RoomMessage = 
  | { type: 'bet-locked'; data: BetLockedData }
  | { type: 'dice-result'; data: DiceResultData }
  | { type: 'game-over'; data: GameOverData }
  | { type: 'start-game'; data: StartGameData }
  | { type: 'new-round'; data: NewRoundData }
  | { type: 'timer-sync'; data: TimerSyncData }
  | { type: 'player-joined'; data: PlayerJoinedData }
  | { type: 'player-left' | 'opponent-ready' | 'both-ready'; data?: undefined };

class RoomManager {
  private channel: RealtimeChannel | null = null;
  private roomCode: string | null = null;
  private playerId: string | null = null;
  private isHost: boolean = false;
  private currentDice: number = gameConfig.DICE_MIN;
  private round: number = 0;
  private scores: { [playerId: string]: number } = {};
  private bets: { [playerId: string]: Bet } = {};
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private roundStartTimestamp: number | null = null;
  private hasGameStarted: boolean = false;
  private isRoundPrepared: boolean = false;
  private hasRolledDice: boolean = false;
  private isLeaving: boolean = false;

  /**
   * Generates a random 6-digit room code.
   * 
   * @returns A 6-digit room code string
   */
  generateRoomCode(): string {
    const min = gameConfig.ROOM_CODE_MIN;
    const max = gameConfig.ROOM_CODE_MAX;
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
   * Gets the host's presence data from the channel.
   * 
   * @returns Host presence data or null if not found
   */
  private getHostPresence(): any {
    const presenceState = this.channel?.presenceState();
    if (!presenceState) return null;
    
    const players = Object.keys(presenceState);
    for (const playerId of players) {
      const presences = presenceState[playerId];
      if (Array.isArray(presences) && presences.length > 0) {
        const presence = presences[0] as any;
        if (presence.role === 'host') {
          return presence;
        }
      }
    }
    return null;
  }

  /**
   * Handles presence sync events when players join/leave.
   * Also checks for timer updates from host (guest only).
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
        this.scores[opponentId] = gameConfig.INITIAL_SCORE;
        logger.debug('RoomManager', `Two players detected | OpponentId: ${opponentId}`);
        
        // Host: Only start game once when opponent first joins
        if (role === 'host' && !this.hasGameStarted) {
          this.hasGameStarted = true;
          this.broadcast({ type: 'player-joined', data: { opponentId } });
          this.startGame();
        }
      }
      
      // Guest: Check for timer updates from host presence
      if (role === 'guest') {
        this.checkHostTimerUpdate();
      }
    } else if (players.length === 1) {
      logger.debug('RoomManager', 'Waiting for opponent');
    } else {
      logger.warn('RoomManager', `Unexpected player count: ${players.length}`);
    }
  }

  /**
   * Checks host presence for timer updates and syncs guest timer.
   * Called by guest when presence syncs.
   */
  private checkHostTimerUpdate(): void {
    if (this.isHost) return;
    
    const hostPresence = this.getHostPresence();
    if (!hostPresence) return;
    
    const { roundStartTime, timerDuration } = hostPresence;
    
    // Check if host has updated timer info and we're in BETTING phase
    const { gamePhase } = useGameState.getState();
    if (gamePhase !== 'BETTING') return;
    
    // If we have timer info
    if (roundStartTime && timerDuration) {
      // Only sync if:
      // 1. We don't have a timer running yet, OR
      // 2. The timestamp is NEWER than our current one (to avoid syncing with stale data)
      const shouldSync = !this.roundStartTimestamp || roundStartTime > this.roundStartTimestamp;
      
      if (shouldSync) {
        logger.debug('RoomManager', `Syncing timer from host presence | StartTime: ${roundStartTime} | Duration: ${timerDuration}s | Current: ${this.roundStartTimestamp || 'none'}`);
        
        this.roundStartTimestamp = roundStartTime;
        this.clearTimer();
        this.startTimerWithTimestamp(timerDuration, roundStartTime);
        
        const elapsed = Math.floor((Date.now() - roundStartTime) / 1000);
        logger.debug('RoomManager', `Timer synced from presence | Elapsed: ${elapsed}s`);
      } else {
        logger.debug('RoomManager', `Ignoring stale presence timer | Host: ${roundStartTime} | Current: ${this.roundStartTimestamp}`);
      }
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
   * Updates presence with timer information (host only).
   * 
   * @param roundStartTime - The timestamp when the round started
   * @param timerDuration - The timer duration in seconds
   */
  private async updatePresenceTimer(roundStartTime: number, timerDuration: number): Promise<void> {
    if (!this.isHost || !this.channel) return;
    
    try {
      await this.channel.track({
        playerId: this.playerId,
        role: 'host',
        online_at: new Date().toISOString(),
        roundStartTime,
        timerDuration,
      });
      logger.debug('RoomManager', `Presence updated with timer | StartTime: ${roundStartTime} | Duration: ${timerDuration}s`);
    } catch (error) {
      logger.error('RoomManager', 'Error updating presence with timer', error);
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
      this.hasGameStarted = false;
      this.currentDice = Math.floor(Math.random() * (gameConfig.DICE_MAX - gameConfig.DICE_MIN + 1)) + gameConfig.DICE_MIN;
      this.round = 0;
      this.scores = {};
      this.bets = {};
      this.isRoundPrepared = false;

      const { playerId, actions } = useGameState.getState();
      this.playerId = playerId;
      this.scores[this.playerId] = gameConfig.INITIAL_SCORE;
      
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
      this.hasGameStarted = false;
      this.isRoundPrepared = false;

      const { playerId } = useGameState.getState();
      this.playerId = playerId;
      this.scores[this.playerId] = gameConfig.INITIAL_SCORE;
      
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
      // Reset round to 0 in UI state (startRound will increment it to 1)
      actions.setRound(0);
      
      // startRound() will calculate and broadcast rush status in new-round message
      // Fire and forget - async operation doesn't need to be awaited here
      this.startRound().catch((error) => {
        logger.error('RoomManager', 'Error in startRound', error);
      });
    }, gameConfig.START_GAME_DELAY);
  }

  /**
   * Checks if the game is over.
   * 
   * @returns True if game phase is GAME_OVER
   */
  private isGameOver(): boolean {
    const { gamePhase } = useGameState.getState();
    return gamePhase === 'GAME_OVER';
  }

  /**
   * Resets the round preparation flag.
   * Called when entering RESULTS phase to allow prepareRoundState() for the next round.
   */
  private resetRoundPreparationFlag(): void {
    this.isRoundPrepared = false;
  }

  /**
   * Prepares round state without starting the timer.
   * Used by guest to set up state before receiving timer-sync.
   * Prevents double execution with isRoundPrepared flag.
   * 
   * @param roundNumber - Optional round number from host (for synchronization)
   */
  private prepareRoundState(roundNumber?: number): void {
    if (this.isGameOver()) {
      logger.debug('RoomManager', 'Game is over, skipping round preparation');
      return;
    }
    
    const { actions } = useGameState.getState();

    // Prevent double execution if round state has already been prepared
    // Check isRoundPrepared regardless of phase to prevent incrementing round multiple times
    if (this.isRoundPrepared) {
      logger.debug('RoomManager', 'Round state already prepared, skipping');
      return;
    }

    this.clearTimer();

    // Use round number from host if provided (for synchronization), otherwise increment locally
    if (roundNumber !== undefined) {
      this.round = roundNumber;
    } else {
      this.round++;
    }
    this.bets = {};
    this.isRoundPrepared = true;
    
    // Clear timestamp so we can sync with fresh host data
    if (!this.isHost) {
      this.roundStartTimestamp = null;
    }
    
    actions.setCurrentDice(this.currentDice);
    // Sync round number to UI state
    actions.setRound(this.round);
    actions.setGamePhase('BETTING');
    // Reset rush round state - will be updated when rush status is received from host
    actions.setRushRound(false);
    actions.unlockBet();
    actions.setMyBet(null);
    actions.setOpponentBet(null);
    
    // Reset timer to prevent stale value from triggering onExpire
    // Default to normal duration - will be updated when rush status is received
    actions.setTimeRemaining(gameConfig.NORMAL_TIMER_DURATION);
    
    logger.debug('RoomManager', `Round ${this.round} state prepared (waiting for timer-sync)`);
    
    // Guest: Check for host timer update after a brief delay to allow presence to sync
    if (!this.isHost) {
      setTimeout(() => {
        this.checkHostTimerUpdate();
      }, 100);
    }
  }

  /**
   * Starts a new betting round with timer.
   * Only called by host. Updates presence state for guest to sync.
   */
  private async startRound(): Promise<void> {
    if (!this.isHost) {
      logger.warn('RoomManager', 'startRound() called by guest - this should not happen');
      return;
    }

    if (this.isGameOver()) {
      logger.debug('RoomManager', 'Game is over, skipping new round');
      return;
    }
    
    const { actions } = useGameState.getState();

    this.clearTimer();

    this.round++;
    this.bets = {};
    this.isRoundPrepared = false; // Reset flag for new round
    this.hasRolledDice = false;  // Reset for new round
    
    // Set round start timestamp
    this.roundStartTimestamp = Date.now();
    
    const isRushRound = Math.random() < gameConfig.RUSH_ROUND_CHANCE;
    const timerDuration = isRushRound 
      ? gameConfig.RUSH_TIMER_DURATION 
      : gameConfig.NORMAL_TIMER_DURATION;
    
    actions.setCurrentDice(this.currentDice);
    // Sync round number to UI state (this.round was incremented above)
    actions.setRound(this.round);
    actions.setGamePhase('BETTING');
    actions.setRushRound(isRushRound);
    actions.unlockBet();
    actions.setMyBet(null);
    actions.setOpponentBet(null);
    
    logger.debug('RoomManager', `Round ${this.round} started | Timer: ${timerDuration}s | Rush: ${isRushRound} | Timestamp: ${this.roundStartTimestamp}`);
    
    // Update presence with timer info - this is the primary sync mechanism
    // Guest will read from presence state via handlePresenceSync
    // AWAIT to ensure presence is updated before broadcasting messages
    await this.updatePresenceTimer(this.roundStartTimestamp, timerDuration);
    
    // Broadcast new-round with rush status and round number
    this.broadcast({
      type: 'new-round',
      data: {
        dice: this.currentDice,
        round: this.round,
        isRushRound
      }
    });
    
    // Also broadcast as fallback (for backwards compatibility)
      this.broadcast({
        type: 'timer-sync',
        data: {
          startTimestamp: this.roundStartTimestamp,
          duration: timerDuration
        }
      });
    
    // Start timer with timestamp - this will calculate and set the correct timeRemaining
    this.startTimerWithTimestamp(timerDuration, this.roundStartTimestamp);
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
        // Only host processes timeout and rolls dice
        if (this.isHost) {
          this.forceResolve();
        }
      }
    }, 1000);
  }

  /**
   * Starts the betting timer countdown using a timestamp for synchronization.
   * For guests, ignores network latency to maintain perceived synchronization.
   * 
   * @param duration - Timer duration in seconds
   * @param startTimestamp - The timestamp when the round started (for host reference only)
   */
  private startTimerWithTimestamp(duration: number, startTimestamp: number): void {
    const { actions } = useGameState.getState();
    
    // Guest: Ignore network latency for perceived synchronization
    // Host: Calculate elapsed time for accuracy
    let initialElapsed = 0;
    if (this.isHost) {
      initialElapsed = Math.max(0, Math.floor((Date.now() - startTimestamp) / 1000));
      initialElapsed = Math.min(initialElapsed, duration);
    }
    
    // Store local start time - all future calculations use THIS as reference
    const localStartTime = Date.now();
    
    // Calculate time remaining using local elapsed time (immune to clock skew)
    const calculateTimeRemaining = () => {
      const localElapsed = Math.floor((Date.now() - localStartTime) / 1000);
      return Math.max(0, duration - initialElapsed - localElapsed);
    };
    
    // Set initial time remaining
    actions.setTimeRemaining(calculateTimeRemaining());
    
    this.timerInterval = setInterval(() => {
      const timeLeft = calculateTimeRemaining();
      
      actions.setTimeRemaining(timeLeft);

      if (timeLeft <= 0) {
        this.clearTimer();
        // Only host processes timeout and rolls dice
        if (this.isHost) {
          this.forceResolve();
        }
      }
    }, 100) as any as ReturnType<typeof setInterval>;
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
   * Only host processes the penalty; guest waits for dice-result.
   */
  private forceResolve(): void {
    this.clearTimer();

    const { playerId, opponentId } = useGameState.getState();
    const allPlayerIds = [playerId, opponentId].filter(Boolean) as string[];

    logger.debug('RoomManager', `Timer expired | Role: ${this.isHost ? 'HOST' : 'GUEST'} | Existing bets: ${Object.keys(this.bets).length}`);

    // Create bet with amount 0 for players who didn't bet
    // The penalty will be applied in calculateRoundResults when it detects amount === 0
    allPlayerIds.forEach((pid) => {
      if (!this.bets[pid]) {
        logger.debug('RoomManager', `Creating timeout bet for player ${pid}`);
        this.bets[pid] = {
          amount: 0,
          prediction: 'higher',
          timestamp: Date.now(),
          playerId: pid,
        };
      } else {
        logger.debug('RoomManager', `Player ${pid} already has bet: ${this.bets[pid].amount}`);
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
    
    // Prevent double roll in same round
    if (this.hasRolledDice) {
      logger.debug('RoomManager', 'Dice already rolled for this round, skipping');
      return;
    }

    if (this.isGameOver()) {
      logger.debug('RoomManager', 'Game is over, skipping roll');
      return;
    }

    this.hasRolledDice = true;  // Mark as rolled

    const newDice = this.generateNewDiceValue();
    logger.debug('RoomManager', `Round ${this.round} | Old: ${this.currentDice} | New: ${newDice}`, this.bets);
    
    // Log bets before calculation to verify timeout bets are present
    Object.entries(this.bets).forEach(([pid, bet]) => {
      if (bet.amount === 0) {
        logger.debug('RoomManager', `Player ${pid} has timeout bet (amount: 0)`);
      }
    });
    
    const results = calculateRoundResults(this.currentDice, newDice, this.bets);
    
    // Log results to verify timeout penalty is applied
    Object.entries(results.playerResults).forEach(([pid, result]) => {
      if (result.result === 'passed') {
        logger.debug('RoomManager', `Player ${pid} passed - penalty: ${result.pointsChange} points`);
      }
    });
    
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
    return Math.floor(Math.random() * (gameConfig.DICE_MAX - gameConfig.DICE_MIN + 1)) + gameConfig.DICE_MIN;
  }

  /**
   * Updates player scores based on round results.
   * 
   * @param results - The round results
   */
  private updateScores(results: RoundResults): void {
    const { playerId, actions } = useGameState.getState();
    
    logger.debug('RoomManager', `updateScores called | Role: ${this.isHost ? 'HOST' : 'GUEST'} | Scores before:`, { ...this.scores });
    
    Object.entries(results.playerResults).forEach(([pid, result]) => {
      if (!this.scores[pid]) {
        this.scores[pid] = gameConfig.INITIAL_SCORE;
      }
      
      const oldScore = this.scores[pid];
      const scoreChange = result.pointsChange + result.bonuses;
      this.scores[pid] += scoreChange;
      if (this.scores[pid] < gameConfig.MIN_SCORE) {
        this.scores[pid] = gameConfig.MIN_SCORE;
      }
      
      logger.debug('RoomManager', `Player ${pid}: ${oldScore} -> ${this.scores[pid]} (change: ${scoreChange >= 0 ? '+' : ''}${scoreChange} = ${result.pointsChange >= 0 ? '+' : ''}${result.pointsChange} points + ${result.bonuses} bonus) | Result: ${result.result}`);
      
      if (pid === playerId) {
        if (result.result === 'win') {
          const currentStreak = useGameState.getState().winStreak;
          actions.setWinStreak(currentStreak + 1);
        } else if (result.result === 'loss' || result.result === 'passed') {
          actions.setWinStreak(0);
        }
      }
    });
    
    logger.debug('RoomManager', `Scores after updateScores:`, { ...this.scores });
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
    const myScore = this.scores[playerId] ?? gameConfig.INITIAL_SCORE;
    const oppScore = this.scores[opponentId || ''] ?? gameConfig.INITIAL_SCORE;
    
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
    
    this.resetRoundPreparationFlag();
    
    // Display results for full duration before showing game over screen
    // This allows players to see the final dice roll and results
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
    }, gameConfig.RESULTS_DISPLAY_DURATION);
    
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
      const myScore = this.scores[playerId] ?? gameConfig.INITIAL_SCORE;
      const oppScore = this.scores[opponentId || ''] ?? gameConfig.INITIAL_SCORE;
      
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
      
      this.resetRoundPreparationFlag();

      setTimeout(() => {
        // startRound() will broadcast new-round with isRushRound status
        // Fire and forget - async operation doesn't need to be awaited here
        this.startRound().catch((error) => {
          logger.error('RoomManager', 'Error in startRound', error);
        });
      }, gameConfig.NEW_ROUND_DELAY);
    }, gameConfig.DICE_ROLL_DELAY);
  }

  /**
   * Handles incoming room messages.
   * 
   * @param message - The room message to handle
   */
  private handleMessage(message: RoomMessage): void {
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
      case 'timer-sync':
        this.handleTimerSync(message.data);
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
    
    // Only roll if both players have bet AND we haven't rolled yet
    if (Object.keys(this.bets).length === 2 && this.isHost && !this.hasRolledDice) {
      logger.debug('RoomManager', 'Both players locked in, starting dice roll');
      this.rollDice();
    }
  }

  /**
   * Handles start-game message (guest only).
   * Sets up game state and prepares for first round, but waits for timer-sync.
   * 
   * @param data - The start-game message data
   */
  private handleStartGame(data: StartGameData): void {
    if (this.isHost) return;

    logger.debug('RoomManager', `Received start-game message | Dice: ${data.dice}`);
    
    this.currentDice = data.dice;
    const { actions } = useGameState.getState();
    actions.startGame(data.dice);
    
    // Set rush round status if provided (for first round)
    if (data.isRushRound !== undefined) {
      actions.setRushRound(data.isRushRound);
    }
    
    // Don't prepare round state here - wait for new-round message from host
    // The new-round message will call prepareRoundState() which increments the round
  }

  /**
   * Handles dice-result message.
   * 
   * @param data - The dice-result message data
   */
  private handleDiceResult(data: DiceResultData): void {
    if (this.isGameOver()) {
      logger.debug('RoomManager', 'Game is over, ignoring dice-result');
      return;
    }
    
    const { opponentId, actions } = useGameState.getState();
    
    const { dice, results, scores } = data;
    const myScore = scores[this.playerId!] ?? gameConfig.INITIAL_SCORE;
    const oppScore = scores[opponentId || ''] ?? gameConfig.INITIAL_SCORE;
    
    logger.debug('RoomManager', `GUEST received dice-result | Dice: ${dice} | Scores from host:`, { scores });
    logger.debug('RoomManager', `GUEST local scores before update:`, { ...this.scores });
    
    // Log results to verify timeout penalty is present
    Object.entries(results.playerResults).forEach(([pid, result]) => {
      logger.debug('RoomManager', `GUEST: Player ${pid} result: ${result.result} | Points change: ${result.pointsChange} | Bonuses: ${result.bonuses}`);
    });
    
    this.currentDice = dice;
    // Use scores from host broadcast - they should already include timeout penalties
    this.scores = { ...scores };
    
    logger.debug('RoomManager', `GUEST local scores after update from host:`, { ...this.scores });
    
    actions.setCurrentDice(dice);
    actions.updateScores(myScore, oppScore);
    
    const myResult = results.playerResults[this.playerId!];
    if (myResult) {
      if (myResult.result === 'win') {
        const currentStreak = useGameState.getState().winStreak;
        actions.setWinStreak(currentStreak + 1);
      } else if (myResult.result === 'loss' || myResult.result === 'passed') {
        actions.setWinStreak(0);
      }
    }
    
    actions.setLastRoundResults(results);
    actions.setGamePhase('RESULTS');
    
    this.resetRoundPreparationFlag();
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
    const finalMyScore = finalScores[this.playerId!] ?? gameConfig.INITIAL_SCORE;
    const finalOppScore = finalScores[opponentId || ''] ?? gameConfig.INITIAL_SCORE;
    
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
   * Prepares round state but waits for timer-sync from host.
   * 
   * @param data - The new-round message data
   */
  private handleNewRound(data: NewRoundData): void {
    if (this.isHost) return;

    if (this.isGameOver()) {
      logger.debug('RoomManager', 'Game is over, ignoring new-round');
      return;
    }
    
    const { actions } = useGameState.getState();
    
    logger.debug('RoomManager', `Received new-round message | Dice: ${data.dice}`);
    
    this.clearTimer();
    
    if (data.dice) {
      this.currentDice = data.dice;
      actions.setCurrentDice(data.dice);
    }
    
    // Store rush round status and round number before prepareRoundState() in case it returns early
    const rushRoundStatus = data.isRushRound;
    const roundNumber = data.round;
    
    // Prepare round state with round number from host for synchronization
    // Note: prepareRoundState() resets isRushRound to false, so we set it AFTER
    this.prepareRoundState(roundNumber);
    
    // Always set rush round status AFTER prepareRoundState() to avoid it being reset
    // This ensures rush status is set even if prepareRoundState() returned early
    if (rushRoundStatus !== undefined) {
      actions.setRushRound(rushRoundStatus);
    }
  }

  /**
   * Handles timer-sync message for synchronizing timers across devices.
   * Guest uses this to start the timer synchronized with the host.
   * 
   * @param data - The timer-sync message data
   */
  private handleTimerSync(data: TimerSyncData): void {
    if (this.isHost) {
      logger.warn('RoomManager', 'Timer-sync received by host - ignoring');
      return;
    }
    
    // Only prepare round state if we're in BETTING phase and not already prepared
    // This ensures round is only incremented by handleNewRound, not by timer-sync
    // If timer-sync arrives during RESULTS (before new-round), we should NOT prepare
    const { gamePhase } = useGameState.getState();
    if (gamePhase === 'BETTING' && !this.isRoundPrepared) {
      logger.debug('RoomManager', 'Timer-sync received in BETTING phase - preparing round state');
      this.prepareRoundState();
    }
    
    this.roundStartTimestamp = data.startTimestamp;
    this.clearTimer();
    this.startTimerWithTimestamp(data.duration, data.startTimestamp);
    
    logger.debug('RoomManager', `Timer synced with timestamp ${data.startTimestamp} | Duration: ${data.duration}s | Elapsed: ${Math.floor((Date.now() - data.startTimestamp) / 1000)}s`);
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
    this.hasGameStarted = false;
    this.bets = {};
    this.scores = {};
    this.isLeaving = false;
    
    logger.debug('RoomManager', 'Room left successfully');
  }
}

export const roomManager = new RoomManager();

