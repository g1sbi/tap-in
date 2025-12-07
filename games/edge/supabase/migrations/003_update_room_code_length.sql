-- Update room code from 4-character alphanumeric to 6-digit numeric
-- This migration updates existing schema to match new requirements

-- Step 1: Delete existing rooms with invalid codes (old 4-char alphanumeric)
-- This is safe for development - existing test rooms will be cleared
DELETE FROM rooms WHERE code !~ '^[0-9]{6}$';

-- Step 2: Drop existing constraints
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_code_check;
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_code_key;

-- Step 3: Change column type and add new constraints
ALTER TABLE rooms 
  ALTER COLUMN code TYPE CHAR(6),
  ADD CONSTRAINT rooms_code_check CHECK (code ~ '^[0-9]{6}$'),
  ADD CONSTRAINT rooms_code_key UNIQUE (code);

-- Note: This migration deletes all rooms with non-6-digit codes
-- For production, you may want to migrate existing codes instead of deleting

