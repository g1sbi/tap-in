import { supabase } from '@/lib/supabase';
import { Room, Player, RoomWithPlayers } from '@/games/edge/types';
import { logger } from '@/lib/logger';

class RoomService {
  /**
   * Generate a unique 6-digit numeric room code
   */
  private async generateRoomCode(): Promise<string> {
    let code: string;
    let attempts = 0;
    const maxAttempts = 1000;

    do {
      // Generate random 6-digit number (100000 to 999999)
      const randomNum = Math.floor(Math.random() * 900000) + 100000;
      code = randomNum.toString();

      const { data } = await supabase
        .from('rooms')
        .select('code')
        .eq('code', code)
        .maybeSingle();

      if (!data) {
        return code;
      }

      attempts++;
    } while (attempts < maxAttempts);

    throw new Error('Failed to generate unique room code');
  }

  /**
   * Create a new room with the current user as host
   */
  async createRoom(displayName: string, maxPlayers: number = 8): Promise<Room> {
    logger.debug('RoomService', 'createRoom called', { maxPlayers });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      logger.error('RoomService', 'User not authenticated');
      throw new Error('User must be authenticated to create a room');
    }

    logger.debug('RoomService', 'Generating room code');
    const code = await this.generateRoomCode();
    logger.debug('RoomService', 'Room code generated', { code });

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        code,
        host_id: user.id,
        max_players: maxPlayers,
        status: 'waiting',
      })
      .select()
      .single();

    if (roomError) {
      logger.error('RoomService', 'Failed to create room', {
        code,
        error: roomError.message,
      });
      throw new Error(`Failed to create room: ${roomError.message}`);
    }

    logger.info('RoomService', 'Room created', {
      roomId: room.id,
      roomCode: room.code,
    });

    // Validate display name
    const trimmedName = displayName.trim();
    if (!trimmedName || trimmedName.length === 0 || trimmedName.length > 8) {
      await supabase.from('rooms').delete().eq('id', room.id);
      throw new Error('Display name must be 1-8 characters');
    }

    // Add host as first player
    const { error: playerError } = await supabase.from('players').insert({
      room_id: room.id,
      user_id: user.id,
      display_name: trimmedName,
      is_host: true,
    });

    if (playerError) {
      logger.error('RoomService', 'Failed to add host player', {
        roomId: room.id,
        error: playerError.message,
      });
      // Clean up room if player creation fails
      await supabase.from('rooms').delete().eq('id', room.id);
      throw new Error(`Failed to add host to room: ${playerError.message}`);
    }

    logger.info('RoomService', 'Host player added successfully', {
      roomId: room.id,
      userId: user.id,
    });

    return room;
  }

  /**
   * Check if a room exists and is joinable
   */
  async checkRoomExists(code: string): Promise<{ exists: boolean; error?: string }> {
    const trimmedCode = code.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      return { exists: false, error: 'Invalid code format' };
    }

    const { data: room } = await supabase
      .from('rooms')
      .select('id, status')
      .eq('code', trimmedCode)
      .maybeSingle();

    if (!room) {
      return { exists: false, error: 'Room not found' };
    }
    if (room.status !== 'waiting') {
      return { exists: false, error: 'Room is not accepting players' };
    }
    return { exists: true };
  }

  /**
   * Join a room by code
   */
  async joinRoom(code: string, displayName: string): Promise<Room> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User must be authenticated to join a room');
    }

    // Validate code format (6 digits)
    const trimmedCode = code.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      throw new Error('Room code must be exactly 6 digits');
    }

    // Validate display name
    const trimmedName = displayName.trim();
    if (!trimmedName || trimmedName.length === 0 || trimmedName.length > 8) {
      throw new Error('Display name must be 1-8 characters');
    }

    // Find room by code
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', trimmedCode)
      .single();

    if (roomError || !room) {
      throw new Error('Room not found');
    }

    if (room.status !== 'waiting') {
      throw new Error('Room is not accepting new players');
    }

    // Check current player count
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', room.id);

    if (count && count >= room.max_players) {
      throw new Error('Room is full');
    }

    // Check if user is already in the room
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', room.id)
      .eq('user_id', user.id)
      .single();

    if (existingPlayer) {
      return room; // Already in room
    }

    // Add player to room
    const { error: playerError } = await supabase.from('players').insert({
      room_id: room.id,
      user_id: user.id,
      display_name: trimmedName,
      is_host: false,
    });

    if (playerError) {
      throw new Error(`Failed to join room: ${playerError.message}`);
    }

    return room;
  }

  /**
   * Get room with all players by room code or ID
   */
  async getRoomWithPlayers(roomCodeOrId: string): Promise<RoomWithPlayers | null> {
    logger.debug('RoomService', 'getRoomWithPlayers called', { roomCodeOrId });

    // Try to find room by code first (6 digits) or by ID (UUID)
    const isCode = /^\d{6}$/.test(roomCodeOrId);
    const query = isCode
      ? supabase.from('rooms').select('*').eq('code', roomCodeOrId).single()
      : supabase.from('rooms').select('*').eq('id', roomCodeOrId).single();

    const { data: room, error: roomError } = await query;

    if (roomError || !room) {
      logger.warn('RoomService', 'Room not found', {
        roomCodeOrId,
        isCode,
        error: roomError?.message,
      });
      return null;
    }

    logger.debug('RoomService', 'Room found', {
      roomId: room.id,
      roomCode: room.code,
    });

    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', room.id)
      .order('joined_at', { ascending: true });

    if (playersError) {
      logger.error('RoomService', 'Failed to fetch players', {
        roomId: room.id,
        error: playersError.message,
      });
      throw new Error(`Failed to fetch players: ${playersError.message}`);
    }

    logger.debug('RoomService', 'Players fetched', {
      roomId: room.id,
      playerCount: players?.length || 0,
    });

    return {
      ...room,
      players: players || [],
    };
  }

  /**
   * Leave a room
   */
  async leaveRoom(roomId: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User must be authenticated');
    }

    const { error } = await supabase
      .from('players')
      .delete()
      .eq('room_id', roomId)
      .eq('user_id', user.id);

    if (error) {
      throw new Error(`Failed to leave room: ${error.message}`);
    }

    // Check if room is empty and delete it
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);

    if (count === 0) {
      await supabase.from('rooms').delete().eq('id', roomId);
    }
  }

  /**
   * Kick a player from room (host only)
   */
  async kickPlayer(roomId: string, playerId: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User must be authenticated');
    }

    // Verify user is host
    const { data: room } = await supabase
      .from('rooms')
      .select('host_id')
      .eq('id', roomId)
      .single();

    if (!room || room.host_id !== user.id) {
      throw new Error('Only the host can kick players');
    }

    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', playerId)
      .eq('room_id', roomId);

    if (error) {
      throw new Error(`Failed to kick player: ${error.message}`);
    }
  }

  /**
   * Update room status (host only)
   */
  async updateRoomStatus(
    roomId: string,
    status: 'waiting' | 'playing' | 'finished'
  ): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User must be authenticated');
    }

    const { error } = await supabase
      .from('rooms')
      .update({ status })
      .eq('id', roomId)
      .eq('host_id', user.id);

    if (error) {
      throw new Error(`Failed to update room status: ${error.message}`);
    }
  }
}

export const roomService = new RoomService();

