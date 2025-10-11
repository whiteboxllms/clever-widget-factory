-- Remove update_type column from action_implementation_updates table
-- This simplifies the data model since we're not using categorization

ALTER TABLE public.action_implementation_updates 
  DROP COLUMN IF EXISTS update_type;
