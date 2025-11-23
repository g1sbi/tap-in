/**
 * Game constants and configuration values.
 * Centralizes all magic numbers used throughout the application.
 */

export const GAME_CONSTANTS = {
  INITIAL_SCORE: 100,
  WINNING_SCORE: 300,
  MIN_SCORE: 0,
  MAX_ROUNDS: 20,
  NORMAL_TIMER_DURATION: 10,
  RUSH_TIMER_DURATION: 5,
  RUSH_ROUND_INTERVAL: 5,
  DICE_MIN: 1,
  DICE_MAX: 6,
  ROOM_CODE_LENGTH: 6,
  TIMEOUT_PENALTY: 10,
  RESULTS_DISPLAY_DURATION: 4000,
  COUNTDOWN_DURATION: 3000,
  DICE_ROLL_DELAY: 800,
  NEW_ROUND_DELAY: 6000,
  GAME_OVER_DELAY: 100,
  START_GAME_DELAY: 3000,
} as const;

export const BONUS_POINTS = {
  MIRROR: 10,
  CONTRARIAN: 5,
  SPEED: 2,
} as const;

export const BET_AMOUNTS = {
  SMALL: 10,
  MEDIUM: 25,
  HALF_PERCENTAGE: 0.5,
} as const;

export const EDGE_CASE_DICE = [1, 6] as const;

export type GameOverReason = 
  | 'opponent_zero' 
  | 'points_threshold' 
  | 'rounds_complete' 
  | 'opponent_disconnected';

