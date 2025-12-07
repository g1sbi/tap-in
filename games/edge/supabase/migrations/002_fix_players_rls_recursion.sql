-- Fix infinite recursion in players RLS policy
-- The original policy was checking the players table recursively
-- Solution: Use a security definer function to check membership without RLS recursion

-- Drop the problematic policy
DROP POLICY IF EXISTS "Players can view players in their room" ON players;

-- Create a function that checks if user is in a room (bypasses RLS for the check)
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

-- New policy using the function (avoids recursion)
CREATE POLICY "Players can view players in their room"
  ON players FOR SELECT
  USING (user_is_in_room(room_id));

