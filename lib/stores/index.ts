/**
 * Zustand Stores Index
 * 
 * Central export for all global state stores.
 */

// Theme store
export {
  useThemeStore,
  useTheme,
  useColors,
  useReduceAnimations,
  useThemeHydrated,
  useThemeActions,
} from './theme-store';

// Room store
export {
  useRoomStore,
  useRoom,
  useRoomLoading,
  useRoomError,
  useIsHost,
  useCurrentPlayer,
  useRoomActions,
} from './room-store';

// Re-export types
export type { RoomWithPlayers, RoomStatus, PlayerStatus } from './room-store';

