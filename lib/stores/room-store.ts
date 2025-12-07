/**
 * Room Store (Zustand)
 * 
 * Global state management for multiplayer room functionality.
 * Wraps unifiedRoomManager with reactive state.
 */

import { create } from 'zustand';
import { unifiedRoomManager } from '../room/room-manager';
import { logger } from '../logger';
import type {
  Room,
  RoomWithPlayers,
  RoomPlayer,
  RoomStatus,
  PlayerStatus,
  CreateRoomOptions,
  JoinRoomOptions,
} from '../room/room-types';

interface RoomState {
  room: RoomWithPlayers | null;
  loading: boolean;
  error: string | null;
}

interface RoomActions {
  // Room operations
  createRoom: (options: CreateRoomOptions) => Promise<Room>;
  joinRoom: (options: JoinRoomOptions) => Promise<Room>;
  leaveRoom: () => Promise<void>;
  refreshRoom: () => Promise<void>;

  // Status updates
  setPlayerStatus: (status: PlayerStatus) => Promise<void>;
  setRoomStatus: (status: RoomStatus) => Promise<void>;
  setSelectedGames: (games: string[]) => Promise<void>;

  // Internal
  setRoom: (room: RoomWithPlayers | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  initialize: () => () => void; // Returns cleanup function
}

interface RoomStore extends RoomState, RoomActions {
  // Computed
  isHost: boolean;
  currentPlayer: RoomPlayer | null;
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  // State
  room: null,
  loading: false,
  error: null,

  // Computed getters
  get isHost() {
    return unifiedRoomManager.isHost();
  },

  get currentPlayer() {
    const room = get().room;
    if (!room) return null;
    const currentRoom = unifiedRoomManager.getRoom();
    if (!currentRoom) return null;
    return room.players.find((p) => p.userId === currentRoom.hostId && p.isHost) || null;
  },

  // Internal setters
  setRoom: (room) => set({ room }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  // Initialize subscriptions
  initialize: () => {
    const { refreshRoom, setError } = get();

    // Initial load
    refreshRoom();

    // Subscribe to updates
    const unsubscribeUpdate = unifiedRoomManager.onUpdate(() => {
      logger.debug('RoomStore', 'Room update received');
      refreshRoom();
    });

    // Subscribe to errors
    const unsubscribeError = unifiedRoomManager.onError((err: Error) => {
      logger.error('RoomStore', 'Room error', err);
      setError(err.message);
    });

    // Return cleanup function
    return () => {
      unsubscribeUpdate();
      unsubscribeError();
    };
  },

  // Room operations
  refreshRoom: async () => {
    try {
      set({ loading: true, error: null });
      const roomData = await unifiedRoomManager.getCurrentRoom();
      set({ room: roomData, loading: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load room';
      logger.error('RoomStore', 'Failed to refresh room', err);
      set({ error: errorMessage, room: null, loading: false });
    }
  },

  createRoom: async (options) => {
    try {
      set({ loading: true, error: null });
      const room = await unifiedRoomManager.createRoom(options);
      await get().refreshRoom();
      return room;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create room';
      set({ error: errorMessage, loading: false });
      throw err;
    }
  },

  joinRoom: async (options) => {
    try {
      set({ loading: true, error: null });
      const room = await unifiedRoomManager.joinRoom(options);
      await get().refreshRoom();
      return room;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join room';
      set({ error: errorMessage, loading: false });
      throw err;
    }
  },

  leaveRoom: async () => {
    try {
      await unifiedRoomManager.leaveRoom();
      set({ room: null, error: null });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to leave room';
      set({ error: errorMessage });
      throw err;
    }
  },

  setPlayerStatus: async (status) => {
    try {
      await unifiedRoomManager.setPlayerStatus(status);
      await get().refreshRoom();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update status';
      set({ error: errorMessage });
      throw err;
    }
  },

  setRoomStatus: async (status) => {
    try {
      await unifiedRoomManager.setRoomStatus(status);
      await get().refreshRoom();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update room status';
      set({ error: errorMessage });
      throw err;
    }
  },

  setSelectedGames: async (games) => {
    try {
      await unifiedRoomManager.setSelectedGames(games);
      await get().refreshRoom();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update selected games';
      set({ error: errorMessage });
      throw err;
    }
  },
}));

// Selector hooks for optimized re-renders
export const useRoom = () => useRoomStore((state) => state.room);
export const useRoomLoading = () => useRoomStore((state) => state.loading);
export const useRoomError = () => useRoomStore((state) => state.error);
export const useIsHost = () => useRoomStore((state) => state.isHost);
export const useCurrentPlayer = () => useRoomStore((state) => state.currentPlayer);

// Action hooks
export const useRoomActions = () => useRoomStore((state) => ({
  createRoom: state.createRoom,
  joinRoom: state.joinRoom,
  leaveRoom: state.leaveRoom,
  refreshRoom: state.refreshRoom,
  setPlayerStatus: state.setPlayerStatus,
  setRoomStatus: state.setRoomStatus,
  setSelectedGames: state.setSelectedGames,
  initialize: state.initialize,
}));

// Re-export types
export type { Room, RoomWithPlayers, RoomStatus, PlayerStatus } from '../room/room-types';

