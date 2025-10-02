-- Update existing unable_to_find records to removed status
UPDATE tools SET status = 'removed' WHERE status = 'unable_to_find';

-- Drop the existing tool_status type
DROP TYPE IF EXISTS tool_status CASCADE;

-- Create the updated tool_status enum with 'removed' instead of 'unable_to_find'
CREATE TYPE tool_status AS ENUM (
  'available',
  'checked_out', 
  'unavailable',
  'needs_attention',
  'under_repair',
  'removed'
);

-- Add the column back with the new enum type
ALTER TABLE tools ALTER COLUMN status TYPE tool_status USING status::text::tool_status;