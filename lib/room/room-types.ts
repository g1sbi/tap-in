/**
 * Unified Room Management Types
 * 
 * TypeScript interfaces and types for the multi-game room system.
 * Supports 2-8 players per room with game selection and ready-up system.
 */

export type RoomStatus = 'lobby' | 'game-active' | 'game-ended' | 'closed';
export type PlayerStatus = 'waiting' | 'ready' | 'in-game' | 'disconnected';

/**
 * Player in a room
 */
export interface RoomPlayer {
  id: string;
  userId: string;
  displayName: string;
  status: PlayerStatus;
  isHost: boolean;
  joinedAt: string;
}

/**
 * Room metadata
 */
export interface Room {
  id: string;
  code: string; // 6-digit room code
  hostId: string;
  status: RoomStatus;
  selectedGames: string[]; // Array of game IDs (e.g., ['dice-rush', 'edge'])
  maxPlayers: number; // 2-8
  createdAt: string;
  updatedAt: string;
}

/**
 * Room with players included
 */
export interface RoomWithPlayers extends Room {
  players: RoomPlayer[];
}

/**
 * Game configuration manifest
 * Each game exports this from games/[name]/index.ts
 */
export interface GameConfig {
  id: string;
  name: string;
  displayName: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  icon: string;
  version: string;
}

/**
 * Room creation options
 */
export interface CreateRoomOptions {
  displayName: string;
  maxPlayers?: number; // Default: 8
  selectedGames?: string[]; // Default: []
}

/**
 * Room join options
 */
export interface JoinRoomOptions {
  code: string; // 6-digit code
  displayName: string;
}

/**
 * Room update payload for real-time subscriptions
 */
export interface RoomUpdatePayload {
  room?: Partial<Room>;
  players?: RoomPlayer[];
  playerJoined?: RoomPlayer;
  playerLeft?: string; // player ID
  playerStatusChanged?: {
    playerId: string;
    status: PlayerStatus;
  };
}

