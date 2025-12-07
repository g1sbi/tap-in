/**
 * Dice Rush Game Manifest
 * 
 * Exports game configuration and metadata for the platform.
 */

export const gameConfig = {
  id: 'dice-rush',
  name: 'Dice Rush',
  displayName: 'Dice Rush',
  description: 'Fast-paced simultaneous multiplayer betting game',
  minPlayers: 2,
  maxPlayers: 2, // Will be extended to 8 in future phase
  icon: '🎲',
  version: '1.0.0',
} as const;

// Re-export game-specific config and logic
export { gameConfig as diceRushGameConfig } from './lib/game-config';
export * from './lib/game-logic';
export * from './lib/game-state';
export * from './lib/game-constants';

