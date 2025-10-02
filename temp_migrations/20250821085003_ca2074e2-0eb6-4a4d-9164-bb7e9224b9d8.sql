-- Remove the phase column from mission_tasks table
ALTER TABLE public.mission_tasks DROP COLUMN IF EXISTS phase;