-- First, create the new tool_status enum with 'removed' instead of 'unable_to_find'
CREATE TYPE tool_status_new AS ENUM (
  'available',
  'checked_out', 
  'unavailable',
  'needs_attention',
  'under_repair',
  'removed'
);

-- Update the tools table to use the new enum, converting 'unable_to_find' to 'removed'
ALTER TABLE tools ALTER COLUMN status TYPE tool_status_new 
USING (
  CASE 
    WHEN status::text = 'unable_to_find' THEN 'removed'::tool_status_new
    ELSE status::text::tool_status_new
  END
);

-- Drop the old enum and rename the new one
DROP TYPE tool_status;
ALTER TYPE tool_status_new RENAME TO tool_status;