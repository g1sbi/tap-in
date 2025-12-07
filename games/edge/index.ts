/**
 * Edge Game Manifest
 * 
 * Exports game configuration and metadata for the platform.
 */

export const gameConfig = {
  id: 'edge',
  name: 'Edge',
  displayName: 'Edge',
  description: '1-button multiplayer chicken game - hold to play, release to stop',
  minPlayers: 2,
  maxPlayers: 8,
  icon: '🔥',
  version: '1.0.0',
} as const;

// Re-export services and hooks for use by the platform
export { roomService } from './lib/RoomService';
export { realtimeService } from './lib/RealtimeService';
export { useRoom } from './hooks/useRoom';
export * from './types';

