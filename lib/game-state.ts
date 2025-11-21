import { create } from 'zustand';
import type { Bet, Prediction, RoundResults } from './game-logic';

export type GamePhase = 'LOBBY' | 'BETTING' | 'REVEALING' | 'RESULTS' | 'GAME_OVER';
export type PlayerRole = 'host' | 'guest';

interface GameState {
  roomCode: string | null;
  playerRole: PlayerRole | null;
  playerId: string;
  opponentId: string | null;
  
  currentDice: number;
  previousDice: number | null;
  round: number;
  
  myScore: number;
  opponentScore: number;
  
  myBet: Bet | null;
  opponentBet: Bet | null;
  betLocked: boolean;
  
  timeRemaining: number;
  gamePhase: GamePhase;
  
  winStreak: number;
  lastRoundResults: RoundResults | null;
  gameWinner: string | null;
  gameOverReason: string | null;
  
  actions: {
    setRoom: (code: string, role: PlayerRole, playerId: string) => void;
    setOpponent: (opponentId: string) => void;
    startGame: (initialDice: number) => void;
    setCurrentDice: (dice: number) => void;
    setMyBet: (bet: Bet | null) => void;
    setOpponentBet: (bet: Bet | null) => void;
    lockBet: () => void;
    unlockBet: () => void;
    setTimeRemaining: (seconds: number) => void;
    setGamePhase: (phase: GamePhase) => void;
    updateScores: (myScore: number, opponentScore: number) => void;
    setWinStreak: (streak: number) => void;
    incrementRound: () => void;
    setLastRoundResults: (results: RoundResults | null) => void;
    setGameWinner: (winner: string | null, reason: string | null) => void;
    reset: () => void;
  };
}

const generatePlayerId = () => `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useGameState = create<GameState>((set) => ({
  roomCode: null,
  playerRole: null,
  playerId: generatePlayerId(),
  opponentId: null,
  
  currentDice: 1,
  previousDice: null,
  round: 0,
  
  myScore: 100,
  opponentScore: 100,
  
  myBet: null,
  opponentBet: null,
  betLocked: false,
  
  timeRemaining: 10,
  gamePhase: 'LOBBY',
  
  winStreak: 0,
  lastRoundResults: null,
  gameWinner: null,
  gameOverReason: null,
  
  actions: {
    setRoom: (code, role, playerId) => set({ roomCode: code, playerRole: role, playerId }),
    setOpponent: (opponentId) => set({ opponentId }),
    startGame: (initialDice) => set({ 
      gamePhase: 'BETTING', 
      currentDice: initialDice,
      round: 1,
      myScore: 100,
      opponentScore: 100,
      timeRemaining: 10,
    }),
    setCurrentDice: (dice) => set((state) => ({ 
      currentDice: dice, 
      previousDice: state.currentDice 
    })),
    setMyBet: (bet) => set({ myBet: bet }),
    setOpponentBet: (bet) => set({ opponentBet: bet }),
    lockBet: () => set({ betLocked: true }),
    unlockBet: () => set({ betLocked: false }),
    setTimeRemaining: (seconds) => set({ timeRemaining: seconds }),
    setGamePhase: (phase) => set({ gamePhase: phase }),
    updateScores: (myScore, opponentScore) => set({ myScore, opponentScore }),
    setWinStreak: (streak) => set({ winStreak: streak }),
    incrementRound: () => set((state) => ({ round: state.round + 1 })),
    setLastRoundResults: (results) => set({ lastRoundResults: results }),
    setGameWinner: (winner, reason) => set({ gameWinner: winner, gameOverReason: reason }),
    reset: () => set({
      roomCode: null,
      playerRole: null,
      opponentId: null,
      currentDice: 1,
      previousDice: null,
      round: 0,
      myScore: 100,
      opponentScore: 100,
      myBet: null,
      opponentBet: null,
      betLocked: false,
      timeRemaining: 10,
      gamePhase: 'LOBBY',
      winStreak: 0,
      lastRoundResults: null,
      gameWinner: null,
      gameOverReason: null,
    }),
  },
}));

