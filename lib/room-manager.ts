import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useGameState } from './game-state';
import type { Bet, RoundResults } from './game-logic';
import { calculateRoundResults, checkWinConditions } from './game-logic';

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

  generateRoomCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async createRoom(): Promise<string> {
    const code = this.generateRoomCode();
    this.roomCode = code;
    this.isHost = true;
    this.currentDice = Math.floor(Math.random() * 6) + 1;
    this.round = 0;
    this.scores = {};
    this.bets = {};

    const state = useGameState.getState();
    this.playerId = state.playerId;
    this.scores[this.playerId] = 100;

    this.channel = supabase.channel(`room:${code}`, {
      config: {
        presence: {
          key: this.playerId,
        },
      },
    });

    this.channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = this.channel?.presenceState();
        const players = Object.keys(presenceState || {});
        if (players.length === 2) {
          const opponentId = players.find((id) => id !== this.playerId) || null;
          if (opponentId) {
            useGameState.getState().actions.setOpponent(opponentId);
            this.scores[opponentId] = 100;
            this.broadcast({ type: 'player-joined', data: { opponentId } });
            this.startGame();
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ keyPresences }) => {
        if (keyPresences && Array.isArray(keyPresences)) {
          keyPresences.forEach((presence) => {
            if (presence.key !== this.playerId) {
              this.handleOpponentDisconnect();
            }
          });
        }
      })
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        this.handleMessage(payload as RoomMessage);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.channel?.track({
            playerId: this.playerId,
            role: 'host',
            online_at: new Date().toISOString(),
          });
        }
      });

    return code;
  }

  async joinRoom(code: string): Promise<boolean> {
    this.roomCode = code;
    this.isHost = false;

    const state = useGameState.getState();
    this.playerId = state.playerId;
    this.scores[this.playerId] = 100;

    this.channel = supabase.channel(`room:${code}`, {
      config: {
        presence: {
          key: this.playerId,
        },
      },
    });

    this.channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = this.channel?.presenceState();
        const players = Object.keys(presenceState || {});
        if (players.length === 2) {
          const opponentId = players.find((id) => id !== this.playerId) || null;
          if (opponentId) {
            useGameState.getState().actions.setOpponent(opponentId);
            this.scores[opponentId] = 100;
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ keyPresences }) => {
        if (keyPresences && Array.isArray(keyPresences)) {
          keyPresences.forEach((presence) => {
            if (presence.key !== this.playerId) {
              this.handleOpponentDisconnect();
            }
          });
        }
      })
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        this.handleMessage(payload as RoomMessage);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await this.channel?.track({
            playerId: this.playerId,
            role: 'guest',
            online_at: new Date().toISOString(),
          });
        }
      });

    return true;
  }

  private startGame() {
    setTimeout(() => {
      this.broadcast({ type: 'start-game', data: { dice: this.currentDice } });
      this.startRound();
    }, 3000);
  }

  private startRound() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.round++;
    this.bets = {};
    useGameState.getState().actions.setGamePhase('BETTING');
    useGameState.getState().actions.unlockBet();
    useGameState.getState().actions.setMyBet(null);
    useGameState.getState().actions.setOpponentBet(null);
    useGameState.getState().actions.incrementRound();

    const isRushRound = this.round % 5 === 0;
    const timerDuration = isRushRound ? 5 : 10;
    useGameState.getState().actions.setTimeRemaining(timerDuration);

    let timeLeft = timerDuration;
    this.timerInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft < 0) timeLeft = 0;
      useGameState.getState().actions.setTimeRemaining(timeLeft);

      if (timeLeft <= 0) {
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
        }
        this.forceResolve();
      }
    }, 1000);
  }

  lockBet(amount: number, prediction: 'higher' | 'lower') {
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

    this.broadcast({ type: 'bet-locked', data: { bet } });

    const betCount = Object.keys(this.bets).length;
    if (betCount === 2 && this.isHost) {
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

    const newDice = Math.floor(Math.random() * 6) + 1;
    const results = calculateRoundResults(this.currentDice, newDice, this.bets);

    Object.entries(results.playerResults).forEach(([playerId, result]) => {
      if (!this.scores[playerId]) this.scores[playerId] = 100;
      this.scores[playerId] += result.pointsChange + result.bonuses;
      if (this.scores[playerId] < 0) this.scores[playerId] = 0;
      
      if (playerId === useGameState.getState().playerId) {
        if (result.result === 'win') {
          const currentStreak = useGameState.getState().winStreak;
          useGameState.getState().actions.setWinStreak(currentStreak + 1);
        } else if (result.result === 'loss') {
          useGameState.getState().actions.setWinStreak(0);
        }
      }
    });

    const winCheck = checkWinConditions(this.scores, this.round);
    if (winCheck.gameOver) {
      const winnerId = winCheck.winner || null;
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
      return;
    }

    useGameState.getState().actions.setGamePhase('REVEALING');
    
    setTimeout(() => {
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
      useGameState.getState().actions.updateScores(
        this.scores[useGameState.getState().playerId] || 100,
        this.scores[useGameState.getState().opponentId || ''] || 100
      );
      useGameState.getState().actions.setLastRoundResults(results);
      useGameState.getState().actions.setGamePhase('RESULTS');

      setTimeout(() => {
        this.broadcast({ type: 'new-round', data: { dice: this.currentDice } });
        this.startRound();
      }, 5000);
    }, 500);
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
          useGameState.getState().actions.setOpponentBet(message.data.bet);
          this.bets[message.data.bet.playerId] = message.data.bet;
          
          if (Object.keys(this.bets).length === 2 && this.isHost) {
            this.rollDice();
          }
        }
        break;

      case 'start-game':
        if (!this.isHost) {
          this.currentDice = message.data.dice;
          useGameState.getState().actions.startGame(message.data.dice);
        }
        break;

      case 'dice-result':
        const { dice, results, scores } = message.data;
        this.currentDice = dice;
        this.scores = scores;
      useGameState.getState().actions.setCurrentDice(dice);
      useGameState.getState().actions.updateScores(
        scores[this.playerId!] || 100,
        scores[useGameState.getState().opponentId || ''] || 100
      );
      
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
        useGameState.getState().actions.setGameWinner(winnerId, message.data.reason || null);
        useGameState.getState().actions.setGamePhase('GAME_OVER');
        if (message.data.scores) {
          this.scores = message.data.scores;
          useGameState.getState().actions.updateScores(
            message.data.scores[this.playerId!] || 100,
            message.data.scores[useGameState.getState().opponentId || ''] || 100
          );
        }
        break;

      case 'opponent-ready':
        break;

      case 'new-round':
        if (!this.isHost) {
          if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
          }
          if (message.data?.dice) {
            this.currentDice = message.data.dice;
            useGameState.getState().actions.setCurrentDice(message.data.dice);
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
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }
    this.roomCode = null;
    this.playerId = null;
    this.isHost = false;
    this.bets = {};
    this.scores = {};
  }
}

export const roomManager = new RoomManager();

