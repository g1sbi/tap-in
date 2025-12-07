-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code CHAR(6) UNIQUE NOT NULL CHECK (code ~ '^[0-9]{6}$'),
  host_id UUID NOT NULL,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  max_players INT DEFAULT 8 CHECK (max_players >= 2 AND max_players <= 8),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  is_host BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_players_room_id ON players(room_id);
CREATE INDEX idx_players_user_id ON players(user_id);

-- Enable Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rooms
-- Anyone can read rooms (needed for joining)
CREATE POLICY "Rooms are viewable by everyone"
  ON rooms FOR SELECT
  USING (true);

-- Only authenticated users can create rooms
CREATE POLICY "Authenticated users can create rooms"
  ON rooms FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Host can update their room
CREATE POLICY "Host can update their room"
  ON rooms FOR UPDATE
  USING (auth.uid() = host_id);

-- Host can delete their room
CREATE POLICY "Host can delete their room"
  ON rooms FOR DELETE
  USING (auth.uid() = host_id);

-- RLS Policies for players
-- Create a function to check room membership without RLS recursion
CREATE OR REPLACE FUNCTION user_is_in_room(check_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM players
    WHERE room_id = check_room_id
    AND user_id = auth.uid()
  );
$$;

-- Players in a room can view all players in that room
CREATE POLICY "Players can view players in their room"
  ON players FOR SELECT
  USING (user_is_in_room(room_id));

-- Authenticated users can join rooms
CREATE POLICY "Authenticated users can join rooms"
  ON players FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Players can update their own player record
CREATE POLICY "Players can update their own record"
  ON players FOR UPDATE
  USING (auth.uid() = user_id);

-- Players can leave (delete their own record)
CREATE POLICY "Players can leave rooms"
  ON players FOR DELETE
  USING (auth.uid() = user_id);

-- Host can kick players (delete any player in their room)
CREATE POLICY "Host can kick players"
  ON players FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = players.room_id
      AND r.host_id = auth.uid()
    )
  );

-- Enable Realtime for rooms and players
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE players;

