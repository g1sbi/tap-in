/**
 * Room Context Provider
 * 
 * React context for room state management across the app.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { unifiedRoomManager } from './room-manager';
import type {
  Room,
  RoomWithPlayers,
  RoomPlayer,
  RoomStatus,
  PlayerStatus,
  RoomUpdatePayload,
} from './room-types';
import { logger } from '@/lib/logger';

interface RoomContextValue {
  room: RoomWithPlayers | null;
  loading: boolean;
  error: string | null;
  isHost: boolean;
  currentPlayer: RoomPlayer | null;
  refreshRoom: () => Promise<void>;
  setPlayerStatus: (status: PlayerStatus) => Promise<void>;
  setRoomStatus: (status: RoomStatus) => Promise<void>;
  setSelectedGames: (games: string[]) => Promise<void>;
  leaveRoom: () => Promise<void>;
}

const RoomContext = createContext<RoomContextValue | null>(null);

interface RoomProviderProps {
  children: React.ReactNode;
}

export function RoomProvider({ children }: RoomProviderProps) {
  const [room, setRoom] = useState<RoomWithPlayers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshRoom = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const roomData = await unifiedRoomManager.getCurrentRoom();
      setRoom(roomData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load room';
      logger.error('RoomContext', 'Failed to refresh room', err);
      setError(errorMessage);
      setRoom(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load
    refreshRoom();

    // Subscribe to updates
    const unsubscribe = unifiedRoomManager.onUpdate((payload: RoomUpdatePayload) => {
      logger.debug('RoomContext', 'Room update received', payload);
      refreshRoom();
    });

    // Subscribe to errors
    const errorUnsubscribe = unifiedRoomManager.onError((err: Error) => {
      logger.error('RoomContext', 'Room error', err);
      setError(err.message);
    });

    return () => {
      unsubscribe();
      errorUnsubscribe();
    };
  }, [refreshRoom]);

  const setPlayerStatus = useCallback(
    async (status: PlayerStatus) => {
      try {
        await unifiedRoomManager.setPlayerStatus(status);
        await refreshRoom();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update status';
        setError(errorMessage);
        throw err;
      }
    },
    [refreshRoom]
  );

  const setRoomStatus = useCallback(
    async (status: RoomStatus) => {
      try {
        await unifiedRoomManager.setRoomStatus(status);
        await refreshRoom();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update room status';
        setError(errorMessage);
        throw err;
      }
    },
    [refreshRoom]
  );

  const setSelectedGames = useCallback(
    async (games: string[]) => {
      try {
        await unifiedRoomManager.setSelectedGames(games);
        await refreshRoom();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update selected games';
        setError(errorMessage);
        throw err;
      }
    },
    [refreshRoom]
  );

  const leaveRoom = useCallback(async () => {
    try {
      await unifiedRoomManager.leaveRoom();
      setRoom(null);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to leave room';
      setError(errorMessage);
      throw err;
    }
  }, []);

  const isHost = unifiedRoomManager.isHost();
  const currentRoom = unifiedRoomManager.getRoom();
  const currentPlayer = room?.players.find(
    (p) => p.userId === unifiedRoomManager.getRoom()?.hostId || p.isHost
  ) || null;

  const value: RoomContextValue = {
    room,
    loading,
    error,
    isHost,
    currentPlayer,
    refreshRoom,
    setPlayerStatus,
    setRoomStatus,
    setSelectedGames,
    leaveRoom,
  };

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom(): RoomContextValue {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within RoomProvider');
  }
  return context;
}

// Re-export types for convenience
export type { Room, RoomWithPlayers, RoomStatus, PlayerStatus } from './room-types';

