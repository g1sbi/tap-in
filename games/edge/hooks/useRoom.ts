import { useState, useEffect, useCallback } from 'react';
import { roomService } from '@/games/edge/lib/RoomService';
import { realtimeService } from '@/games/edge/lib/RealtimeService';
import { RoomWithPlayers, Player } from '@/games/edge/types';
import { logger } from '@/lib/logger';

export function useRoom(roomId: string | null) {
  const [room, setRoom] = useState<RoomWithPlayers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshRoom = useCallback(async () => {
    logger.debug('useRoom', 'refreshRoom called', { roomId });

    if (!roomId) {
      logger.warn('useRoom', 'No roomId provided, clearing room state');
      setRoom(null);
      setLoading(false);
      return;
    }

    try {
      logger.debug('useRoom', 'Fetching room data', { roomId });
      setLoading(true);
      setError(null);
      const roomData = await roomService.getRoomWithPlayers(roomId);
      logger.info('useRoom', 'Room data fetched successfully', {
        roomId,
        roomCode: roomData?.code,
        playerCount: roomData?.players?.length || 0,
      });
      setRoom(roomData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load room';
      logger.error('useRoom', 'Failed to fetch room data', {
        roomId,
        error: errorMessage,
        stack: err instanceof Error ? err.stack : undefined,
      });
      setError(errorMessage);
      setRoom(null);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    refreshRoom();
  }, [refreshRoom]);

  useEffect(() => {
    // Wait until we have room data with actual room ID before subscribing
    if (!room || !room.id) {
      return;
    }

    logger.debug('useRoom', 'Setting up realtime subscription', {
      roomId: room.id,
      roomCode: room.code,
    });

    const unsubscribe = realtimeService.subscribeToRoom(room.id, {
      onRoomUpdate: async (updatedRoom) => {
        logger.debug('useRoom', 'Room updated via realtime', {
          roomId: updatedRoom.id,
        });
        // Refresh full room data when room updates
        await refreshRoom();
      },
      onPlayersUpdate: (players) => {
        logger.info('useRoom', 'Players updated via realtime', {
          playerCount: players.length,
          players: players.map((p) => ({ id: p.id, name: p.display_name })),
        });
        setRoom((prev) => {
          if (!prev) return null;
          return { ...prev, players };
        });
      },
      onRoomDeleted: () => {
        logger.warn('useRoom', 'Room deleted via realtime');
        setRoom(null);
        setError('Room has been deleted');
      },
    });

    return () => {
      logger.debug('useRoom', 'Cleaning up realtime subscription');
      unsubscribe();
    };
  }, [room?.id, refreshRoom]);

  const leaveRoom = useCallback(async () => {
    // Use room ID if available, otherwise fall back to roomId (code)
    const idToUse = room?.id || roomId;
    if (!idToUse) return;

    try {
      logger.debug('useRoom', 'Leaving room', { roomId: idToUse });
      await roomService.leaveRoom(idToUse);
    } catch (err) {
      logger.error('useRoom', 'Failed to leave room', {
        roomId: idToUse,
        error: err instanceof Error ? err.message : String(err),
      });
      setError(err instanceof Error ? err.message : 'Failed to leave room');
      throw err;
    }
  }, [room?.id, roomId]);

  const kickPlayer = useCallback(
    async (playerId: string) => {
      // Use room ID if available, otherwise fall back to roomId (code)
      const idToUse = room?.id || roomId;
      if (!idToUse) return;

      try {
        logger.debug('useRoom', 'Kicking player', { roomId: idToUse, playerId });
        await roomService.kickPlayer(idToUse, playerId);
      } catch (err) {
        logger.error('useRoom', 'Failed to kick player', {
          roomId: idToUse,
          playerId,
          error: err instanceof Error ? err.message : String(err),
        });
        setError(err instanceof Error ? err.message : 'Failed to kick player');
        throw err;
      }
    },
    [room?.id, roomId]
  );

  const startGame = useCallback(async () => {
    // Use room ID if available, otherwise fall back to roomId (code)
    const idToUse = room?.id || roomId;
    if (!idToUse) return;

    try {
      logger.debug('useRoom', 'Starting game', { roomId: idToUse });
      await roomService.updateRoomStatus(idToUse, 'playing');
    } catch (err) {
      logger.error('useRoom', 'Failed to start game', {
        roomId: idToUse,
        error: err instanceof Error ? err.message : String(err),
      });
      setError(err instanceof Error ? err.message : 'Failed to start game');
      throw err;
    }
  }, [room?.id, roomId]);

  return {
    room,
    loading,
    error,
    refreshRoom,
    leaveRoom,
    kickPlayer,
    startGame,
  };
}

