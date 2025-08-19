-- Remove condition-related columns from checkins table
ALTER TABLE public.checkins 
DROP COLUMN IF EXISTS condition_after,
DROP COLUMN IF EXISTS location_found,
DROP COLUMN IF EXISTS returned_to_correct_location;

-- Remove condition column from tools table
ALTER TABLE public.tools 
DROP COLUMN IF EXISTS condition;

-- Remove condition and location fields from tool_audits table
ALTER TABLE public.tool_audits 
DROP COLUMN IF EXISTS condition_found,
DROP COLUMN IF EXISTS found_in_location,
DROP COLUMN IF EXISTS found_in_vicinity;

-- Drop the tool_condition enum type as it's no longer needed
DROP TYPE IF EXISTS tool_condition;