import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Room, Player } from '@/games/edge/types';
import { logger } from '@/lib/logger';

type RoomUpdateCallback = (room: Room) => void;
type PlayerUpdateCallback = (players: Player[]) => void;
type RoomDeletedCallback = () => void;

class RealtimeService {
  private roomChannel: RealtimeChannel | null = null;

  /**
   * Subscribe to room updates
   * @param roomId - The UUID of the room (not the code)
   */
  subscribeToRoom(
    roomId: string,
    callbacks: {
      onRoomUpdate?: RoomUpdateCallback;
      onPlayersUpdate?: PlayerUpdateCallback;
      onRoomDeleted?: RoomDeletedCallback;
    }
  ): () => void {
    // Unsubscribe from previous channel if exists
    this.unsubscribe();

    logger.debug('RealtimeService', 'Subscribing to room', { roomId });
    const channel = supabase.channel(`room:${roomId}`);

    // Subscribe to room changes
    if (callbacks.onRoomUpdate) {
      channel
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${roomId}`,
          },
          (payload) => {
            callbacks.onRoomUpdate?.(payload.new as Room);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${roomId}`,
          },
          () => {
            callbacks.onRoomDeleted?.();
          }
        );
    }

    // Subscribe to player changes
    if (callbacks.onPlayersUpdate) {
      channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'players',
            filter: `room_id=eq.${roomId}`,
          },
          async (payload) => {
            logger.debug('RealtimeService', 'Player change detected', {
              event: payload.eventType,
              roomId,
              playerId: payload.new?.id || payload.old?.id,
            });

            // Fetch all players when any change occurs
            const { data: players, error } = await supabase
              .from('players')
              .select('*')
              .eq('room_id', roomId)
              .order('joined_at', { ascending: true });

            if (error) {
              logger.error('RealtimeService', 'Failed to fetch players after change', {
                roomId,
                error: error.message,
              });
              return;
            }

            if (players) {
              logger.debug('RealtimeService', 'Calling onPlayersUpdate callback', {
                playerCount: players.length,
              });
              callbacks.onPlayersUpdate?.(players as Player[]);
            }
          }
        );
    }

    channel.subscribe((status) => {
      logger.debug('RealtimeService', 'Channel subscription status', {
        roomId,
        status,
      });
    });

    this.roomChannel = channel;

    // Return unsubscribe function
    return () => {
      this.unsubscribe();
    };
  }

  /**
   * Unsubscribe from current channel
   */
  unsubscribe(): void {
    if (this.roomChannel) {
      supabase.removeChannel(this.roomChannel);
      this.roomChannel = null;
    }
  }
}

export const realtimeService = new RealtimeService();

