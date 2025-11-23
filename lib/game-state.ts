import { create } from 'zustand';
import { GAME_CONSTANTS } from './game-constants';
import type { Bet, RoundResults } from './game-logic';
import { logger } from './logger';

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
  isRushRound: boolean;
  
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
    setRushRound: (isRush: boolean) => void;
    updateScores: (myScore: number, opponentScore: number) => void;
    setWinStreak: (streak: number) => void;
    incrementRound: () => void;
    setRound: (round: number) => void;
    setLastRoundResults: (results: RoundResults | null) => void;
    setGameWinner: (winner: string | null, reason: string | null) => void;
    reset: () => void;
  };
}

/**
 * Generates a unique player ID.
 * 
 * @returns A unique player ID string
 */
const generatePlayerId = (): string => {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const useGameState = create<GameState>((set) => ({
  roomCode: null,
  playerRole: null,
  playerId: generatePlayerId(),
  opponentId: null,
  
  currentDice: GAME_CONSTANTS.DICE_MIN,
  previousDice: null,
  round: 0,
  
  myScore: GAME_CONSTANTS.INITIAL_SCORE,
  opponentScore: GAME_CONSTANTS.INITIAL_SCORE,
  
  myBet: null,
  opponentBet: null,
  betLocked: false,
  
  timeRemaining: GAME_CONSTANTS.NORMAL_TIMER_DURATION,
  gamePhase: 'LOBBY',
  isRushRound: false,
  
  winStreak: 0,
  lastRoundResults: null,
  gameWinner: null,
  gameOverReason: null,
  
  actions: {
    setRoom: (code, role, playerId) => set({ roomCode: code, playerRole: role, playerId }),
    setOpponent: (opponentId) => set({ opponentId }),
    startGame: (initialDice) => {
      logger.debug('GameState', `startGame called | Dice: ${initialDice}`);
      set({ 
        gamePhase: 'BETTING', 
        currentDice: initialDice,
        myScore: GAME_CONSTANTS.INITIAL_SCORE,
        opponentScore: GAME_CONSTANTS.INITIAL_SCORE,
        timeRemaining: GAME_CONSTANTS.NORMAL_TIMER_DURATION,
      });
    },
    setCurrentDice: (dice) => {
      logger.debug('GameState', `setCurrentDice called | New dice: ${dice}`);
      set((state) => ({ 
        currentDice: dice, 
        previousDice: state.currentDice 
      }));
    },
    setMyBet: (bet) => set({ myBet: bet }),
    setOpponentBet: (bet) => set({ opponentBet: bet }),
    lockBet: () => set({ betLocked: true }),
    unlockBet: () => set({ betLocked: false }),
    setTimeRemaining: (seconds) => {
      logger.debug('GameState', `setTimeRemaining called | New: ${seconds}s`);
      set({ timeRemaining: seconds });
    },
    setGamePhase: (phase) => set({ gamePhase: phase }),
    setRushRound: (isRush) => set({ isRushRound: isRush }),
    updateScores: (myScore, opponentScore) => {
      const current = useGameState.getState();
      const myChange = myScore - current.myScore;
      const oppChange = opponentScore - current.opponentScore;
      logger.debug('GameState', `updateScores called | My: ${current.myScore} -> ${myScore} (${myChange >= 0 ? '+' : ''}${myChange}) | Opp: ${current.opponentScore} -> ${opponentScore} (${oppChange >= 0 ? '+' : ''}${oppChange})`);
      set({ myScore, opponentScore });
    },
    setWinStreak: (streak) => set({ winStreak: streak }),
    incrementRound: () => set((state) => ({ round: state.round + 1 })),
    setRound: (round) => set({ round }),
    setLastRoundResults: (results) => set({ lastRoundResults: results }),
    setGameWinner: (winner, reason) => set({ gameWinner: winner, gameOverReason: reason }),
    reset: () => set({
      roomCode: null,
      playerRole: null,
      opponentId: null,
      currentDice: GAME_CONSTANTS.DICE_MIN,
      previousDice: null,
      round: 0,
      myScore: GAME_CONSTANTS.INITIAL_SCORE,
      opponentScore: GAME_CONSTANTS.INITIAL_SCORE,
      myBet: null,
      opponentBet: null,
      betLocked: false,
      timeRemaining: GAME_CONSTANTS.NORMAL_TIMER_DURATION,
      gamePhase: 'LOBBY',
      isRushRound: false,
      winStreak: 0,
      lastRoundResults: null,
      gameWinner: null,
      gameOverReason: null,
    }),
  },
}));

