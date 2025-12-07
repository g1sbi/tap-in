/**
 * Unified Room Manager
 * 
 * Business logic for room creation, joining, and management.
 * Works with Supabase for persistence and real-time updates.
 */

import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import {
  createRoomInSupabase,
  joinRoomInSupabase,
  checkRoomExists,
  getRoomWithPlayers,
  updatePlayerStatus,
  updateRoomStatus,
  updateSelectedGames,
  leaveRoomInSupabase,
} from './supabase-rooms';
import type {
  Room,
  RoomWithPlayers,
  RoomPlayer,
  RoomStatus,
  PlayerStatus,
  CreateRoomOptions,
  JoinRoomOptions,
  RoomUpdatePayload,
} from './room-types';

type RoomUpdateCallback = (payload: RoomUpdatePayload) => void;
type RoomErrorCallback = (error: Error) => void;

class UnifiedRoomManager {
  private channel: RealtimeChannel | null = null;
  private currentRoom: Room | null = null;
  private currentUserId: string | null = null;
  private updateCallbacks: Set<RoomUpdateCallback> = new Set();
  private errorCallbacks: Set<RoomErrorCallback> = new Set();
  private isLeaving: boolean = false;

  /**
   * Get current user ID from Supabase auth
   */
  private async getCurrentUserId(): Promise<string> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Create anonymous user if not authenticated
      const {
        data: { user: anonUser },
        error,
      } = await supabase.auth.signInAnonymously();

      if (error || !anonUser) {
        throw new Error('Failed to authenticate user');
      }

      return anonUser.id;
    }

    return user.id;
  }

  /**
   * Set up real-time subscription for room updates
   */
  private async setupRealtimeSubscription(roomId: string): Promise<void> {
    if (this.channel) {
      await this.channel.unsubscribe();
    }

    this.channel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_players',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          logger.debug('UnifiedRoomManager', 'Room players changed', payload);

          // Refresh room data
          const room = await getRoomWithPlayers(roomId);
          if (room) {
            this.currentRoom = room;
            this.notifyUpdate({
              players: room.players,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        async (payload) => {
          logger.debug('UnifiedRoomManager', 'Room changed', payload);

          const room = await getRoomWithPlayers(roomId);
          if (room) {
            this.currentRoom = room;
            this.notifyUpdate({
              room: {
                status: room.status,
                selectedGames: room.selectedGames,
              },
            });
          }
        }
      )
      .subscribe((status) => {
        logger.debug('UnifiedRoomManager', 'Subscription status', status);
        if (status === 'SUBSCRIBED') {
          logger.info('UnifiedRoomManager', 'Subscribed to room updates', { roomId });
        } else if (status === 'CHANNEL_ERROR') {
          logger.error('UnifiedRoomManager', 'Channel error');
          this.notifyError(new Error('Connection error'));
        }
      });
  }

  /**
   * Notify all update callbacks
   */
  private notifyUpdate(payload: RoomUpdatePayload): void {
    this.updateCallbacks.forEach((callback) => {
      try {
        callback(payload);
      } catch (error) {
        logger.error('UnifiedRoomManager', 'Error in update callback', error);
      }
    });
  }

  /**
   * Notify all error callbacks
   */
  private notifyError(error: Error): void {
    this.errorCallbacks.forEach((callback) => {
      try {
        callback(error);
      } catch (err) {
        logger.error('UnifiedRoomManager', 'Error in error callback', err);
      }
    });
  }

  /**
   * Create a new room
   */
  async createRoom(options: CreateRoomOptions): Promise<Room> {
    try {
      logger.debug('UnifiedRoomManager', 'Creating room', options);

      const userId = await this.getCurrentUserId();
      this.currentUserId = userId;

      const room = await createRoomInSupabase(
        userId,
        options.displayName,
        options.maxPlayers || 8
      );

      this.currentRoom = room;

      // Set up real-time subscription
      await this.setupRealtimeSubscription(room.id);

      logger.info('UnifiedRoomManager', 'Room created', { roomId: room.id, code: room.code });
      return room;
    } catch (error) {
      logger.error('UnifiedRoomManager', 'Failed to create room', error);
      throw error;
    }
  }

  /**
   * Join an existing room
   */
  async joinRoom(options: JoinRoomOptions): Promise<Room> {
    try {
      logger.debug('UnifiedRoomManager', 'Joining room', { code: options.code });

      // Validate room exists
      const check = await checkRoomExists(options.code);
      if (!check.exists) {
        throw new Error(check.error || 'Room not found');
      }

      const userId = await this.getCurrentUserId();
      this.currentUserId = userId;

      const room = await joinRoomInSupabase(options.code, userId, options.displayName);

      this.currentRoom = room;

      // Set up real-time subscription
      await this.setupRealtimeSubscription(room.id);

      logger.info('UnifiedRoomManager', 'Joined room', { roomId: room.id, code: room.code });
      return room;
    } catch (error) {
      logger.error('UnifiedRoomManager', 'Failed to join room', error);
      throw error;
    }
  }

  /**
   * Leave the current room
   */
  async leaveRoom(): Promise<void> {
    if (!this.currentRoom || !this.currentUserId || this.isLeaving) {
      return;
    }

    try {
      this.isLeaving = true;
      logger.debug('UnifiedRoomManager', 'Leaving room', {
        roomId: this.currentRoom.id,
        userId: this.currentUserId,
      });

      await leaveRoomInSupabase(this.currentRoom.id, this.currentUserId);

      if (this.channel) {
        await this.channel.unsubscribe();
        this.channel = null;
      }

      this.currentRoom = null;
      this.currentUserId = null;

      logger.info('UnifiedRoomManager', 'Left room successfully');
    } catch (error) {
      logger.error('UnifiedRoomManager', 'Failed to leave room', error);
      throw error;
    } finally {
      this.isLeaving = false;
    }
  }

  /**
   * Update player status (ready/waiting/in-game)
   */
  async setPlayerStatus(status: PlayerStatus): Promise<void> {
    if (!this.currentRoom || !this.currentUserId) {
      throw new Error('Not in a room');
    }

    try {
      await updatePlayerStatus(this.currentRoom.id, this.currentUserId, status);
      logger.debug('UnifiedRoomManager', 'Player status updated', { status });
    } catch (error) {
      logger.error('UnifiedRoomManager', 'Failed to update player status', error);
      throw error;
    }
  }

  /**
   * Update room status (host only)
   */
  async setRoomStatus(status: RoomStatus): Promise<void> {
    if (!this.currentRoom || !this.currentUserId) {
      throw new Error('Not in a room');
    }

    if (this.currentRoom.hostId !== this.currentUserId) {
      throw new Error('Only the host can update room status');
    }

    try {
      await updateRoomStatus(this.currentRoom.id, this.currentUserId, status);
      logger.debug('UnifiedRoomManager', 'Room status updated', { status });
    } catch (error) {
      logger.error('UnifiedRoomManager', 'Failed to update room status', error);
      throw error;
    }
  }

  /**
   * Update selected games (host only)
   */
  async setSelectedGames(selectedGames: string[]): Promise<void> {
    if (!this.currentRoom || !this.currentUserId) {
      throw new Error('Not in a room');
    }

    if (this.currentRoom.hostId !== this.currentUserId) {
      throw new Error('Only the host can update selected games');
    }

    try {
      await updateSelectedGames(this.currentRoom.id, this.currentUserId, selectedGames);
      this.currentRoom.selectedGames = selectedGames;
      logger.debug('UnifiedRoomManager', 'Selected games updated', { selectedGames });
    } catch (error) {
      logger.error('UnifiedRoomManager', 'Failed to update selected games', error);
      throw error;
    }
  }

  /**
   * Get current room with players
   */
  async getCurrentRoom(): Promise<RoomWithPlayers | null> {
    if (!this.currentRoom) {
      return null;
    }

    return await getRoomWithPlayers(this.currentRoom.id);
  }

  /**
   * Subscribe to room updates
   */
  onUpdate(callback: RoomUpdateCallback): () => void {
    this.updateCallbacks.add(callback);
    return () => {
      this.updateCallbacks.delete(callback);
    };
  }

  /**
   * Subscribe to room errors
   */
  onError(callback: RoomErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => {
      this.errorCallbacks.delete(callback);
    };
  }

  /**
   * Get current room (synchronous)
   */
  getRoom(): Room | null {
    return this.currentRoom;
  }

  /**
   * Check if user is host
   */
  isHost(): boolean {
    return this.currentRoom?.hostId === this.currentUserId || false;
  }
}

export const unifiedRoomManager = new UnifiedRoomManager();

