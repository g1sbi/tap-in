import { RealtimeChannel } from '@supabase/supabase-js';
import type { Bet, Prediction } from './game-logic';
import { calculateRoundResults, checkWinConditions } from './game-logic';
import { useGameState } from './game-state';
import { supabase } from './supabase';

export interface RoomMessage {
  type: 'bet-locked' | 'both-ready' | 'dice-result' | 'game-over' | 'opponent-ready' | 'start-game' | 'player-joined' | 'player-left' | 'new-round';
  data?: any;
}

class RoomManager {
  private channel: RealtimeChannel | null = null;
  private roomCode: string | null = null;
  private playerId: string | null = null;
  private isHost: boolean = false;
  private currentDice: number = 1;
  private round: number = 0;
  private scores: { [playerId: string]: number } = {};
  private bets: { [playerId: string]: Bet } = {};
  private timerInterval: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private isLeaving: boolean = false; // Track if we're in the process of leaving

  generateRoomCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async createRoom(): Promise<string> {
    const code = this.generateRoomCode();
    console.log(`[CREATE ROOM] HOST | Generating room code: ${code}`);
    
    this.roomCode = code;
    this.isHost = true;
    this.currentDice = Math.floor(Math.random() * 6) + 1;
    this.round = 0;
    this.scores = {};
    this.bets = {};

    const state = useGameState.getState();
    this.playerId = state.playerId;
    this.scores[this.playerId] = 100;
    
    console.log(`[DICE INIT] HOST | Room created | Initial dice: ${this.currentDice} | PlayerId: ${this.playerId}`);
    console.log(`[CREATE ROOM] HOST | Creating Supabase channel: room:${code}`);

    this.channel = supabase.channel(`room:${code}`, {
      config: {
        presence: {
          key: this.playerId,
        },
      },
    });

    console.log(`[CREATE ROOM] HOST | Channel created, setting up event handlers`);

    this.channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = this.channel?.presenceState();
        const players = Object.keys(presenceState || {});
        console.log(`[CREATE ROOM] HOST | Presence sync event | Players in room: ${players.length} | PlayerIds: ${JSON.stringify(players)}`);
        
        if (players.length === 2) {
          const opponentId = players.find((id) => id !== this.playerId) || null;
          console.log(`[CREATE ROOM] HOST | Two players detected | MyId: ${this.playerId} | OpponentId: ${opponentId}`);
          if (opponentId) {
            useGameState.getState().actions.setOpponent(opponentId);
            this.scores[opponentId] = 100;
            console.log(`[CREATE ROOM] HOST | Opponent set: ${opponentId}, broadcasting player-joined and starting game`);
            this.broadcast({ type: 'player-joined', data: { opponentId } });
            this.startGame();
          }
        } else if (players.length === 1) {
          console.log(`[CREATE ROOM] HOST | Only one player in room (waiting for guest)`);
        } else {
          console.log(`[CREATE ROOM] HOST | Unexpected player count: ${players.length}`);
        }
      })
      .on('presence', { event: 'leave' }, ({ keyPresences }) => {
        console.log(`[CREATE ROOM] HOST | Presence leave event | keyPresences:`, keyPresences);
        if (keyPresences && Array.isArray(keyPresences)) {
          keyPresences.forEach((presence) => {
            console.log(`[CREATE ROOM] HOST | Player left: ${presence.key}`);
            if (presence.key !== this.playerId) {
              this.handleOpponentDisconnect();
            }
          });
        }
      })
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        console.log(`[CREATE ROOM] HOST | Received broadcast message:`, payload);
        this.handleMessage(payload as RoomMessage);
      })
      .subscribe(async (status) => {
        console.log(`[CREATE ROOM] HOST | Subscription status changed: ${status}`);
        if (status === 'SUBSCRIBED') {
          console.log(`[CREATE ROOM] HOST | Successfully subscribed, tracking presence`);
          try {
            await this.channel?.track({
              playerId: this.playerId,
              role: 'host',
              online_at: new Date().toISOString(),
            });
            console.log(`[CREATE ROOM] HOST | Presence tracked successfully`);
          } catch (trackError) {
            console.error(`[CREATE ROOM] HOST | Error tracking presence:`, trackError);
          }
        } else if (status === 'CHANNEL_ERROR') {
          if (!this.isLeaving) {
            console.error(`[CREATE ROOM] HOST | Channel error occurred`);
          }
        } else if (status === 'TIMED_OUT') {
          if (!this.isLeaving) {
            console.error(`[CREATE ROOM] HOST | Channel subscription timed out`);
          }
        } else if (status === 'CLOSED') {
          if (!this.isLeaving) {
            console.error(`[CREATE ROOM] HOST | Channel closed unexpectedly`);
          } else {
            console.log(`[CREATE ROOM] HOST | Channel closed (expected during leave)`);
          }
        }
      });

    console.log(`[CREATE ROOM] HOST | Room creation complete, returning code: ${code}`);
    return code;
  }

  async joinRoom(code: string): Promise<boolean> {
    console.log(`[JOIN ROOM] GUEST | Attempting to join room | Code: ${code} | PlayerId: ${useGameState.getState().playerId}`);
    
    try {
      this.roomCode = code;
      this.isHost = false;

      const state = useGameState.getState();
      this.playerId = state.playerId;
      this.scores[this.playerId] = 100;
      
      console.log(`[JOIN ROOM] GUEST | Room code set: ${this.roomCode} | PlayerId: ${this.playerId}`);
      console.log(`[JOIN ROOM] GUEST | Creating Supabase channel: room:${code}`);

      this.channel = supabase.channel(`room:${code}`, {
        config: {
          presence: {
            key: this.playerId,
          },
        },
      });

      console.log(`[JOIN ROOM] GUEST | Channel created, setting up event handlers`);

      this.channel
        .on('presence', { event: 'sync' }, () => {
          const presenceState = this.channel?.presenceState();
          const players = Object.keys(presenceState || {});
          console.log(`[JOIN ROOM] GUEST | Presence sync event | Players in room: ${players.length} | PlayerIds: ${JSON.stringify(players)}`);
          
          if (players.length === 2) {
            const opponentId = players.find((id) => id !== this.playerId) || null;
            console.log(`[JOIN ROOM] GUEST | Two players detected | MyId: ${this.playerId} | OpponentId: ${opponentId}`);
            if (opponentId) {
              useGameState.getState().actions.setOpponent(opponentId);
              this.scores[opponentId] = 100;
              console.log(`[JOIN ROOM] GUEST | Opponent set: ${opponentId}`);
            }
          } else if (players.length === 1) {
            console.log(`[JOIN ROOM] GUEST | Only one player in room (waiting for host or host waiting for guest)`);
          } else {
            console.log(`[JOIN ROOM] GUEST | Unexpected player count: ${players.length}`);
          }
        })
        .on('presence', { event: 'leave' }, ({ keyPresences }) => {
          console.log(`[JOIN ROOM] GUEST | Presence leave event | keyPresences:`, keyPresences);
          if (keyPresences && Array.isArray(keyPresences)) {
            keyPresences.forEach((presence) => {
              console.log(`[JOIN ROOM] GUEST | Player left: ${presence.key}`);
              if (presence.key !== this.playerId) {
                this.handleOpponentDisconnect();
              }
            });
          }
        })
        .on('broadcast', { event: 'message' }, ({ payload }) => {
          console.log(`[JOIN ROOM] GUEST | Received broadcast message:`, payload);
          this.handleMessage(payload as RoomMessage);
        })
        .subscribe(async (status) => {
          console.log(`[JOIN ROOM] GUEST | Subscription status changed: ${status}`);
          if (status === 'SUBSCRIBED') {
            console.log(`[JOIN ROOM] GUEST | Successfully subscribed, tracking presence`);
            try {
              await this.channel?.track({
                playerId: this.playerId,
                role: 'guest',
                online_at: new Date().toISOString(),
              });
              console.log(`[JOIN ROOM] GUEST | Presence tracked successfully`);
            } catch (trackError) {
              console.error(`[JOIN ROOM] GUEST | Error tracking presence:`, trackError);
            }
          } else if (status === 'CHANNEL_ERROR') {
            if (!this.isLeaving) {
              console.error(`[JOIN ROOM] GUEST | Channel error occurred`);
            }
          } else if (status === 'TIMED_OUT') {
            if (!this.isLeaving) {
              console.error(`[JOIN ROOM] GUEST | Channel subscription timed out`);
            }
          } else if (status === 'CLOSED') {
            if (!this.isLeaving) {
              console.error(`[JOIN ROOM] GUEST | Channel closed unexpectedly`);
            } else {
              console.log(`[JOIN ROOM] GUEST | Channel closed (expected during leave)`);
            }
          }
        });

      console.log(`[JOIN ROOM] GUEST | Channel setup complete, returning true`);
      return true;
    } catch (error) {
      console.error(`[JOIN ROOM] GUEST | Error joining room:`, error);
      return false;
    }
  }

  private startGame() {
    console.log(`[GAME START] HOST | Starting game | Dice: ${this.currentDice} | Round: ${this.round}`);
    setTimeout(() => {
      console.log(`[GAME START] HOST | Broadcasting start-game | Dice: ${this.currentDice}`);
      this.broadcast({ type: 'start-game', data: { dice: this.currentDice } });
      
      // CRITICAL: Host must also update its own state before starting the round
      console.log(`[GAME START] HOST | Updating host state | Dice: ${this.currentDice}`);
      useGameState.getState().actions.startGame(this.currentDice);
      
      console.log(`[GAME START] HOST | Calling startRound | Dice: ${this.currentDice}`);
      this.startRound();
    }, 3000);
  }

  private startRound() {
    // Guard: Don't start new round if game is already over
    if (useGameState.getState().gamePhase === 'GAME_OVER') {
      console.log('[GAME STATE] Game is over, skipping new round');
      return;
    }

    if (this.timerInterval) {
      console.log(`[TIMER] Round ${this.round} | Clearing existing timer interval`);
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.round++;
    this.bets = {};
    useGameState.getState().actions.setCurrentDice(this.currentDice);
    useGameState.getState().actions.setGamePhase('BETTING');
    useGameState.getState().actions.unlockBet();
    useGameState.getState().actions.setMyBet(null);
    useGameState.getState().actions.setOpponentBet(null);
    useGameState.getState().actions.incrementRound();

    const state = useGameState.getState();
    console.log(`[GAME STATE] Round ${this.round} STARTED | Role: ${this.isHost ? 'HOST' : 'GUEST'} | PlayerId: ${this.playerId}`);
    console.log(`[DICE STATE] Round ${this.round} | Current Dice: ${this.currentDice} | State Dice: ${state.currentDice}`);
    console.log(`[GAME STATE] Current Dice: ${this.currentDice} | My Score: ${state.myScore} | Opponent Score: ${state.opponentScore}`);
    console.log(`[GAME STATE] Internal Scores:`, JSON.stringify(this.scores));

    const isRushRound = this.round % 5 === 0;
    const timerDuration = isRushRound ? 5 : 10;
    console.log(`[TIMER] Round ${this.round} | Initializing timer | Duration: ${timerDuration}s | IsRushRound: ${isRushRound}`);
    useGameState.getState().actions.setTimeRemaining(timerDuration);
    
    const timerStateBefore = useGameState.getState().timeRemaining;
    console.log(`[TIMER] Round ${this.round} | Timer state after setTimeRemaining: ${timerStateBefore}`);

    let timeLeft = timerDuration;
    console.log(`[TIMER] Round ${this.round} | Starting interval | Initial timeLeft: ${timeLeft}`);
    this.timerInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft < 0) timeLeft = 0;
      const stateBeforeUpdate = useGameState.getState().timeRemaining;
      useGameState.getState().actions.setTimeRemaining(timeLeft);
      const stateAfterUpdate = useGameState.getState().timeRemaining;
      console.log(`[TIMER] Round ${this.round} | Tick | timeLeft: ${timeLeft} | State before: ${stateBeforeUpdate} | State after: ${stateAfterUpdate}`);

      if (timeLeft <= 0) {
        console.log(`[TIMER] Round ${this.round} | Timer expired | Clearing interval`);
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
        }
        this.forceResolve();
      }
    }, 1000);
    console.log(`[TIMER] Round ${this.round} | Interval started | timerInterval: ${this.timerInterval ? 'set' : 'null'}`);
  }

  lockBet(amount: number, prediction: Prediction) {
    if (!this.playerId) return;

    const bet: Bet = {
      amount,
      prediction,
      timestamp: Date.now(),
      playerId: this.playerId,
    };

    this.bets[this.playerId] = bet;
    useGameState.getState().actions.setMyBet(bet);
    useGameState.getState().actions.lockBet();

    console.log(`[BET] Round ${this.round} | Player ${this.playerId} locked bet: ${amount} points on ${prediction.toUpperCase()}`);
    console.log(`[BET] All bets so far:`, JSON.stringify(this.bets));

    this.broadcast({ type: 'bet-locked', data: { bet } });

    const betCount = Object.keys(this.bets).length;
    if (betCount === 2 && this.isHost) {
      console.log(`[BET] Both players locked in, starting dice roll...`);
      this.rollDice();
    }
  }

  private forceResolve() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const state = useGameState.getState();
    const allPlayerIds = [state.playerId, state.opponentId].filter(Boolean) as string[];

    allPlayerIds.forEach((playerId) => {
      if (!this.bets[playerId]) {
        this.scores[playerId] = (this.scores[playerId] || 100) - 10;
        this.bets[playerId] = {
          amount: 0,
          prediction: 'higher',
          timestamp: Date.now(),
          playerId,
        };
      }
    });

    this.rollDice();
  }

  private rollDice() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    if (!this.isHost) return;

    // Guard: Don't roll dice if game is already over
    if (useGameState.getState().gamePhase === 'GAME_OVER') {
      console.log('[DICE ROLL] Game is over, skipping roll');
      return;
    }

    const newDice = Math.floor(Math.random() * 6) + 1;
    console.log(`[DICE ROLL] Round ${this.round} | Old Dice: ${this.currentDice} | New Dice: ${newDice}`);
    console.log(`[DICE ROLL] Bets used for calculation:`, JSON.stringify(this.bets));
    
    const results = calculateRoundResults(this.currentDice, newDice, this.bets);
    console.log(`[DICE ROLL] Results calculated:`, JSON.stringify(results));

    const scoresBefore = { ...this.scores };
    Object.entries(results.playerResults).forEach(([playerId, result]) => {
      if (!this.scores[playerId]) this.scores[playerId] = 100;
      const oldScore = this.scores[playerId];
      this.scores[playerId] += result.pointsChange + result.bonuses;
      if (this.scores[playerId] < 0) this.scores[playerId] = 0;
      
      console.log(`[SCORE UPDATE] Player ${playerId}: ${oldScore} -> ${this.scores[playerId]} (${result.pointsChange >= 0 ? '+' : ''}${result.pointsChange} points, +${result.bonuses} bonuses)`);
      
      if (playerId === useGameState.getState().playerId) {
        if (result.result === 'win') {
          const currentStreak = useGameState.getState().winStreak;
          useGameState.getState().actions.setWinStreak(currentStreak + 1);
        } else if (result.result === 'loss') {
          useGameState.getState().actions.setWinStreak(0);
        }
      }
    });
    
    console.log(`[SCORE UPDATE] Scores before:`, JSON.stringify(scoresBefore));
    console.log(`[SCORE UPDATE] Scores after:`, JSON.stringify(this.scores));

    const winCheck = checkWinConditions(this.scores, this.round);
    if (winCheck.gameOver) {
      const winnerId = winCheck.winner || null;
      const playerId = useGameState.getState().playerId;
      const opponentId = useGameState.getState().opponentId || '';
      
      // CRITICAL: Get scores from this.scores (which has the updated scores after this round)
      // NOT from state, which might be stale
      const myScore = this.scores[playerId] ?? 100;
      const oppScore = this.scores[opponentId] ?? 100;
      
      console.log(`[GAME OVER] HOST | Win condition detected | Winner: ${winnerId} | Reason: ${winCheck.reason}`);
      console.log(`[GAME OVER] HOST | Final scores object:`, JSON.stringify(this.scores));
      console.log(`[GAME OVER] HOST | PlayerId: ${playerId} | OpponentId: ${opponentId}`);
      console.log(`[GAME OVER] HOST | My Score from this.scores: ${myScore} | Opp Score from this.scores: ${oppScore}`);
      
      // CRITICAL: Broadcast dice-result FIRST so guest can update their scores before game-over
      // This ensures both players have synchronized scores when game ends
      console.log(`[GAME OVER] HOST | Broadcasting final dice-result before game-over`);
      this.broadcast({
        type: 'dice-result',
        data: {
          dice: newDice,
          results,
          scores: this.scores,
        },
      });
      
      // Update host's own state with final results
      this.currentDice = newDice;
      useGameState.getState().actions.setCurrentDice(newDice);
      console.log(`[GAME OVER] HOST | Updating host state: My=${myScore}, Opp=${oppScore}`);
      useGameState.getState().actions.updateScores(myScore, oppScore);
      useGameState.getState().actions.setLastRoundResults(results);
      useGameState.getState().actions.setGamePhase('RESULTS');
      
      const stateAfterUpdate = useGameState.getState();
      console.log(`[GAME OVER] HOST | State after update: My=${stateAfterUpdate.myScore}, Opp=${stateAfterUpdate.opponentScore}`);
      
      // Small delay to ensure dice-result is processed before game-over
      setTimeout(() => {
        console.log(`[GAME OVER] HOST | Broadcasting game-over after dice-result`);
        useGameState.getState().actions.setGameWinner(winnerId, winCheck.reason || null);
        this.broadcast({
          type: 'game-over',
          data: {
            scores: this.scores,
            winner: winCheck.winner,
            reason: winCheck.reason,
          },
        });
        useGameState.getState().actions.setGamePhase('GAME_OVER');
      }, 100);
      
      // Clear all timers when game ends
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      
      return;
    }

    useGameState.getState().actions.setGamePhase('REVEALING');
    
    setTimeout(() => {
      const playerId = useGameState.getState().playerId;
      const opponentId = useGameState.getState().opponentId || '';
      // CRITICAL: Use ?? instead of || to preserve 0 values (0 || 100 = 100, but 0 ?? 100 = 0)
      const myScore = this.scores[playerId] ?? 100;
      const oppScore = this.scores[opponentId] ?? 100;
      
      console.log(`[BROADCAST] Round ${this.round} | Broadcasting dice-result:`);
      console.log(`[BROADCAST]   Dice: ${newDice}`);
      console.log(`[BROADCAST]   Scores:`, JSON.stringify(this.scores));
      console.log(`[BROADCAST]   My Score: ${myScore} | Opponent Score: ${oppScore}`);
      
      this.broadcast({
        type: 'dice-result',
        data: {
          dice: newDice,
          results,
          scores: this.scores,
        },
      });

      this.currentDice = newDice;
      useGameState.getState().actions.setCurrentDice(newDice);
      useGameState.getState().actions.updateScores(myScore, oppScore);
      useGameState.getState().actions.setLastRoundResults(results);
      useGameState.getState().actions.setGamePhase('RESULTS');
      
      console.log(`[LOCAL UPDATE] Round ${this.round} | Updated local state: My=${myScore}, Opp=${oppScore}`);

      setTimeout(() => {
        this.broadcast({ type: 'new-round', data: { dice: this.currentDice } });
        this.startRound();
      }, 6000);
    }, 800);
  }

  private handleMessage(message: RoomMessage) {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message.data);
      return;
    }

    switch (message.type) {
      case 'bet-locked':
        if (message.data?.bet?.playerId !== this.playerId) {
          console.log(`[BET RECEIVED] Round ${this.round} | Received opponent bet:`, JSON.stringify(message.data.bet));
          useGameState.getState().actions.setOpponentBet(message.data.bet);
          this.bets[message.data.bet.playerId] = message.data.bet;
          console.log(`[BET RECEIVED] All bets now:`, JSON.stringify(this.bets));
          
          if (Object.keys(this.bets).length === 2 && this.isHost) {
            console.log(`[BET RECEIVED] Both players locked in, starting dice roll...`);
            this.rollDice();
          }
        }
        break;

      case 'start-game':
        if (!this.isHost) {
          const diceFromMessage = message.data.dice;
          const diceBefore = this.currentDice;
          const stateDiceBefore = useGameState.getState().currentDice;
          
          console.log(`[DICE RECEIVED] GUEST | Received start-game message`);
          console.log(`[DICE RECEIVED]   Dice from message: ${diceFromMessage}`);
          console.log(`[DICE RECEIVED]   Internal currentDice before: ${diceBefore}`);
          console.log(`[DICE RECEIVED]   State currentDice before: ${stateDiceBefore}`);
          
          this.currentDice = diceFromMessage;
          useGameState.getState().actions.startGame(diceFromMessage);
          
          const diceAfter = this.currentDice;
          const stateDiceAfter = useGameState.getState().currentDice;
          console.log(`[DICE RECEIVED]   Internal currentDice after: ${diceAfter}`);
          console.log(`[DICE RECEIVED]   State currentDice after: ${stateDiceAfter}`);
          
          if (diceAfter !== diceFromMessage || stateDiceAfter !== diceFromMessage) {
            console.error(`[DICE RECEIVED] MISMATCH! Expected ${diceFromMessage}, got internal=${diceAfter}, state=${stateDiceAfter}`);
          }
          
          // CRITICAL: Guest must also start the round and timer after receiving start-game
          console.log(`[GAME START] GUEST | Starting round after receiving start-game`);
          this.startRound();
        }
        break;

      case 'dice-result':
        // Guard: Don't process dice-result if game is already over
        if (useGameState.getState().gamePhase === 'GAME_OVER') {
          console.log('[RESULT RECEIVED] Game is over, ignoring dice-result');
          break;
        }
        
        const { dice, results, scores } = message.data;
        const opponentId = useGameState.getState().opponentId || '';
        
        // CRITICAL: Get scores from message data, ensuring we use the correct player IDs
        const myScore = scores[this.playerId!] ?? 100;
        const oppScore = scores[opponentId] ?? 100;
        
        console.log(`[RESULT RECEIVED] Round ${this.round} | Received dice-result:`);
        console.log(`[RESULT RECEIVED]   Dice: ${dice}`);
        console.log(`[RESULT RECEIVED]   Scores from message:`, JSON.stringify(scores));
        console.log(`[RESULT RECEIVED]   PlayerId: ${this.playerId} | OpponentId: ${opponentId}`);
        console.log(`[RESULT RECEIVED]   My Score from scores[${this.playerId}]: ${myScore}`);
        console.log(`[RESULT RECEIVED]   Opp Score from scores[${opponentId}]: ${oppScore}`);
        console.log(`[RESULT RECEIVED]   Results:`, JSON.stringify(results));
        
        const scoresBefore = { ...this.scores };
        this.currentDice = dice;
        // CRITICAL: Update internal scores from the authoritative source (host)
        this.scores = { ...scores };
        console.log(`[RESULT RECEIVED]   Internal scores before:`, JSON.stringify(scoresBefore));
        console.log(`[RESULT RECEIVED]   Internal scores after:`, JSON.stringify(this.scores));
        
        useGameState.getState().actions.setCurrentDice(dice);
        // CRITICAL: Use scores from message, not from internal state
        useGameState.getState().actions.updateScores(myScore, oppScore);
        
        const stateAfter = useGameState.getState();
        console.log(`[RESULT RECEIVED]   State after update: My=${stateAfter.myScore}, Opp=${stateAfter.opponentScore}`);
        
        const myResult = results.playerResults[this.playerId!];
        if (myResult) {
          if (myResult.result === 'win') {
            const currentStreak = useGameState.getState().winStreak;
            useGameState.getState().actions.setWinStreak(currentStreak + 1);
          } else if (myResult.result === 'loss') {
            useGameState.getState().actions.setWinStreak(0);
          }
        }
        
        useGameState.getState().actions.setLastRoundResults(results);
        useGameState.getState().actions.setGamePhase('RESULTS');
        break;

      case 'game-over':
        const winnerId = message.data.winner || null;
        const finalScores = message.data.scores || {};
        // CRITICAL: Use ?? instead of || to preserve 0 values
        const finalMyScore = finalScores[this.playerId!] ?? 100;
        const finalOppScore = finalScores[useGameState.getState().opponentId || ''] ?? 100;
        
        console.log(`[GAME OVER] Received game-over message:`);
        console.log(`[GAME OVER]   Winner: ${winnerId}`);
        console.log(`[GAME OVER]   Reason: ${message.data.reason}`);
        console.log(`[GAME OVER]   Final scores from message:`, JSON.stringify(finalScores));
        console.log(`[GAME OVER]   My Score: ${finalMyScore} | Opponent Score: ${finalOppScore}`);
        console.log(`[GAME OVER]   Internal scores before:`, JSON.stringify(this.scores));
        
        // CRITICAL: Always use scores from game-over message as authoritative source
        // This ensures we have the correct final scores even if dice-result was missed
        this.scores = { ...finalScores };
        useGameState.getState().actions.setGameWinner(winnerId, message.data.reason || null);
        useGameState.getState().actions.setGamePhase('GAME_OVER');
        useGameState.getState().actions.updateScores(finalMyScore, finalOppScore);
        
        const finalState = useGameState.getState();
        console.log(`[GAME OVER]   Final state: My=${finalState.myScore}, Opp=${finalState.opponentScore}`);
        console.log(`[GAME OVER]   Internal scores after:`, JSON.stringify(this.scores));
        
        // Verify scores match
        if (finalState.myScore !== finalMyScore || finalState.opponentScore !== finalOppScore) {
          console.error(`[GAME OVER] SCORE MISMATCH! Expected My=${finalMyScore}, Opp=${finalOppScore}, but got My=${finalState.myScore}, Opp=${finalState.opponentScore}`);
        }
        break;

      case 'opponent-ready':
        break;

      case 'new-round':
        if (!this.isHost) {
          // Guard: Don't process new-round if game is already over
          if (useGameState.getState().gamePhase === 'GAME_OVER') {
            console.log('[NEW ROUND] Game is over, ignoring new-round');
            break;
          }
          
          console.log(`[NEW ROUND] Round ${this.round + 1} | Received new-round message`);
          console.log(`[NEW ROUND]   Dice from message: ${message.data?.dice}`);
          console.log(`[NEW ROUND]   Current dice before: ${this.currentDice}`);
          
          if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
          }
          if (message.data?.dice) {
            this.currentDice = message.data.dice;
            useGameState.getState().actions.setCurrentDice(message.data.dice);
            console.log(`[NEW ROUND]   Updated current dice to: ${this.currentDice}`);
          }
          this.startRound();
        }
        break;
    }
  }

  private handleOpponentDisconnect() {
    const playerId = useGameState.getState().playerId;
    useGameState.getState().actions.setGameWinner(playerId, 'opponent_disconnected');
    useGameState.getState().actions.setGamePhase('GAME_OVER');
  }

  private broadcast(message: RoomMessage) {
    this.channel?.send({
      type: 'broadcast',
      event: 'message',
      payload: message,
    });
  }

  onMessage(type: string, handler: (data: any) => void) {
    this.messageHandlers.set(type, handler);
  }

  async leaveRoom() {
    console.log(`[LEAVE ROOM] ${this.isHost ? 'HOST' : 'GUEST'} | Leaving room | RoomCode: ${this.roomCode}`);
    this.isLeaving = true;
    
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.channel) {
      console.log(`[LEAVE ROOM] ${this.isHost ? 'HOST' : 'GUEST'} | Unsubscribing from channel`);
      await this.channel.unsubscribe();
      this.channel = null;
      console.log(`[LEAVE ROOM] ${this.isHost ? 'HOST' : 'GUEST'} | Channel unsubscribed`);
    }
    this.roomCode = null;
    this.playerId = null;
    this.isHost = false;
    this.bets = {};
    this.scores = {};
    this.isLeaving = false;
    console.log(`[LEAVE ROOM] ${this.isHost ? 'HOST' : 'GUEST'} | Room left successfully`);
  }
}

export const roomManager = new RoomManager();

