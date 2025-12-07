/**
 * Supabase Room Table Interactions
 * 
 * Client-side code for interacting with Supabase room tables.
 * 
 * NOTE: The actual Supabase schema migration should be created manually.
 * See the schema design in the comments below.
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import type { Room, RoomPlayer, RoomWithPlayers, RoomStatus, PlayerStatus } from './room-types';

/**
 * SUPABASE SCHEMA DESIGN
 * 
 * -- Rooms table
 * CREATE TABLE rooms (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   code VARCHAR(6) UNIQUE NOT NULL,
 *   host_id UUID NOT NULL REFERENCES auth.users(id),
 *   status VARCHAR(20) NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'game-active', 'game-ended', 'closed')),
 *   selected_games TEXT[] DEFAULT '{}',
 *   max_players INTEGER NOT NULL DEFAULT 8 CHECK (max_players >= 2 AND max_players <= 8),
 *   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 * );
 * 
 * CREATE INDEX idx_rooms_code ON rooms(code);
 * CREATE INDEX idx_rooms_status ON rooms(status);
 * 
 * -- Room players table
 * CREATE TABLE room_players (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
 *   user_id UUID NOT NULL REFERENCES auth.users(id),
 *   display_name VARCHAR(20) NOT NULL,
 *   status VARCHAR(20) NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'in-game', 'disconnected')),
 *   is_host BOOLEAN NOT NULL DEFAULT FALSE,
 *   joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *   UNIQUE(room_id, user_id)
 * );
 * 
 * CREATE INDEX idx_room_players_room_id ON room_players(room_id);
 * CREATE INDEX idx_room_players_user_id ON room_players(user_id);
 * 
 * -- RLS Policies
 * -- Rooms: Users can read any room, but only create/update their own rooms (if host)
 * -- Room players: Users can read players in rooms they're in, insert themselves, update their own status
 */

/**
 * Generate a unique 6-digit room code
 */
async function generateRoomCode(): Promise<string> {
  let code: string;
  let attempts = 0;
  const maxAttempts = 100;

  do {
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
 * Create a new room in Supabase
 */
export async function createRoomInSupabase(
  hostId: string,
  displayName: string,
  maxPlayers: number = 8
): Promise<Room> {
  logger.debug('supabase-rooms', 'Creating room', { hostId, displayName, maxPlayers });

  const code = await generateRoomCode();
  logger.debug('supabase-rooms', 'Generated room code', { code });

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .insert({
      code,
      host_id: hostId,
      status: 'lobby',
      selected_games: [],
      max_players: maxPlayers,
    })
    .select()
    .single();

  if (roomError) {
    logger.error('supabase-rooms', 'Failed to create room', roomError);
    throw new Error(`Failed to create room: ${roomError.message}`);
  }

  // Add host as first player
  const { error: playerError } = await supabase.from('room_players').insert({
    room_id: room.id,
    user_id: hostId,
    display_name: displayName,
    status: 'waiting',
    is_host: true,
  });

  if (playerError) {
    logger.error('supabase-rooms', 'Failed to add host player', playerError);
    // Clean up room
    await supabase.from('rooms').delete().eq('id', room.id);
    throw new Error(`Failed to add host to room: ${playerError.message}`);
  }

  logger.info('supabase-rooms', 'Room created successfully', { roomId: room.id, code });

  return {
    id: room.id,
    code: room.code,
    hostId: room.host_id,
    status: room.status as RoomStatus,
    selectedGames: room.selected_games || [],
    maxPlayers: room.max_players,
    createdAt: room.created_at,
    updatedAt: room.updated_at,
  };
}

/**
 * Check if a room exists and is joinable
 */
export async function checkRoomExists(code: string): Promise<{ exists: boolean; error?: string }> {
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

  if (room.status !== 'lobby') {
    return { exists: false, error: 'Room is not accepting players' };
  }

  return { exists: true };
}

/**
 * Join a room in Supabase
 */
export async function joinRoomInSupabase(
  code: string,
  userId: string,
  displayName: string
): Promise<Room> {
  logger.debug('supabase-rooms', 'Joining room', { code, userId, displayName });

  const trimmedCode = code.trim();
  if (!/^\d{6}$/.test(trimmedCode)) {
    throw new Error('Room code must be exactly 6 digits');
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

  if (room.status !== 'lobby') {
    throw new Error('Room is not accepting new players');
  }

  // Check current player count
  const { count } = await supabase
    .from('room_players')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', room.id);

  if (count && count >= room.max_players) {
    throw new Error('Room is full');
  }

  // Check if user is already in the room
  const { data: existingPlayer } = await supabase
    .from('room_players')
    .select('*')
    .eq('room_id', room.id)
    .eq('user_id', userId)
    .single();

  if (existingPlayer) {
    logger.debug('supabase-rooms', 'User already in room', { roomId: room.id });
    return {
      id: room.id,
      code: room.code,
      hostId: room.host_id,
      status: room.status as RoomStatus,
      selectedGames: room.selected_games || [],
      maxPlayers: room.max_players,
      createdAt: room.created_at,
      updatedAt: room.updated_at,
    };
  }

  // Add player to room
  const { error: playerError } = await supabase.from('room_players').insert({
    room_id: room.id,
    user_id: userId,
    display_name: displayName,
    status: 'waiting',
    is_host: false,
  });

  if (playerError) {
    logger.error('supabase-rooms', 'Failed to join room', playerError);
    throw new Error(`Failed to join room: ${playerError.message}`);
  }

  logger.info('supabase-rooms', 'Joined room successfully', { roomId: room.id, code });

  return {
    id: room.id,
    code: room.code,
    hostId: room.host_id,
    status: room.status as RoomStatus,
    selectedGames: room.selected_games || [],
    maxPlayers: room.max_players,
    createdAt: room.created_at,
    updatedAt: room.updated_at,
  };
}

/**
 * Get room with all players
 */
export async function getRoomWithPlayers(roomId: string): Promise<RoomWithPlayers | null> {
  logger.debug('supabase-rooms', 'Getting room with players', { roomId });

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (roomError || !room) {
    logger.warn('supabase-rooms', 'Room not found', { roomId });
    return null;
  }

  const { data: players, error: playersError } = await supabase
    .from('room_players')
    .select('*')
    .eq('room_id', room.id)
    .order('joined_at', { ascending: true });

  if (playersError) {
    logger.error('supabase-rooms', 'Failed to fetch players', playersError);
    throw new Error(`Failed to fetch players: ${playersError.message}`);
  }

  return {
    id: room.id,
    code: room.code,
    hostId: room.host_id,
    status: room.status as RoomStatus,
    selectedGames: room.selected_games || [],
    maxPlayers: room.max_players,
    createdAt: room.created_at,
    updatedAt: room.updated_at,
    players: (players || []).map((p) => ({
      id: p.id,
      userId: p.user_id,
      displayName: p.display_name,
      status: p.status as PlayerStatus,
      isHost: p.is_host,
      joinedAt: p.joined_at,
    })),
  };
}

/**
 * Update player status
 */
export async function updatePlayerStatus(
  roomId: string,
  userId: string,
  status: PlayerStatus
): Promise<void> {
  logger.debug('supabase-rooms', 'Updating player status', { roomId, userId, status });

  const { error } = await supabase
    .from('room_players')
    .update({ status })
    .eq('room_id', roomId)
    .eq('user_id', userId);

  if (error) {
    logger.error('supabase-rooms', 'Failed to update player status', error);
    throw new Error(`Failed to update player status: ${error.message}`);
  }
}

/**
 * Update room status
 */
export async function updateRoomStatus(
  roomId: string,
  hostId: string,
  status: RoomStatus
): Promise<void> {
  logger.debug('supabase-rooms', 'Updating room status', { roomId, hostId, status });

  const { error } = await supabase
    .from('rooms')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', roomId)
    .eq('host_id', hostId);

  if (error) {
    logger.error('supabase-rooms', 'Failed to update room status', error);
    throw new Error(`Failed to update room status: ${error.message}`);
  }
}

/**
 * Update selected games (host only)
 */
export async function updateSelectedGames(
  roomId: string,
  hostId: string,
  selectedGames: string[]
): Promise<void> {
  logger.debug('supabase-rooms', 'Updating selected games', { roomId, hostId, selectedGames });

  const { error } = await supabase
    .from('rooms')
    .update({ selected_games: selectedGames, updated_at: new Date().toISOString() })
    .eq('id', roomId)
    .eq('host_id', hostId);

  if (error) {
    logger.error('supabase-rooms', 'Failed to update selected games', error);
    throw new Error(`Failed to update selected games: ${error.message}`);
  }
}

/**
 * Leave a room
 */
export async function leaveRoomInSupabase(roomId: string, userId: string): Promise<void> {
  logger.debug('supabase-rooms', 'Leaving room', { roomId, userId });

  const { error } = await supabase
    .from('room_players')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);

  if (error) {
    logger.error('supabase-rooms', 'Failed to leave room', error);
    throw new Error(`Failed to leave room: ${error.message}`);
  }

  // Check if room is empty and delete it
  const { count } = await supabase
    .from('room_players')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', roomId);

  if (count === 0) {
    await supabase.from('rooms').delete().eq('id', roomId);
    logger.debug('supabase-rooms', 'Room deleted (empty)', { roomId });
  }
}

