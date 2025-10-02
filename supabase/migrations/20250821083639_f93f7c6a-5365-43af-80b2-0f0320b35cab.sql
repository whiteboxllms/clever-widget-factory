-- Remove the unused mission-level plan field to simplify to task-level plans only
ALTER TABLE public.missions DROP COLUMN IF EXISTS plan;