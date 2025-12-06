-- Migration script to convert time_entries from hours to minutes
-- Run this script against your database before using the new code

-- Step 1: Add new columns (nullable initially)
ALTER TABLE time_entries 
  ADD COLUMN IF NOT EXISTS minutes integer,
  ADD COLUMN IF NOT EXISTS input_format text DEFAULT 'fractional',
  ADD COLUMN IF NOT EXISTS raw_input text;

-- Step 2: Migrate existing data from hours to minutes
-- Convert fractional hours to minutes (e.g., 1.5 hours = 90 minutes)
UPDATE time_entries 
SET 
  minutes = ROUND(COALESCE(hours, 0) * 60),
  input_format = 'fractional',
  raw_input = COALESCE(hours::text, '0')
WHERE minutes IS NULL;

-- Step 3: Set defaults for any NULL values (safety)
UPDATE time_entries 
SET 
  minutes = 0,
  input_format = 'fractional',
  raw_input = '0'
WHERE minutes IS NULL;

-- Step 4: Make columns NOT NULL
ALTER TABLE time_entries 
  ALTER COLUMN minutes SET NOT NULL,
  ALTER COLUMN input_format SET NOT NULL,
  ALTER COLUMN input_format SET DEFAULT 'hm';

-- Step 5: (Optional) Drop the old hours column after verifying everything works
-- Uncomment the line below only after confirming the migration worked:
-- ALTER TABLE time_entries DROP COLUMN IF EXISTS hours;

