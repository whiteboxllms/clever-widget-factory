
-- First, add the new columns to mission_tasks table
ALTER TABLE public.mission_tasks 
ADD COLUMN plan TEXT,
ADD COLUMN observations TEXT;

-- Migrate existing done_definition data to the plan field
UPDATE public.mission_tasks 
SET plan = done_definition 
WHERE done_definition IS NOT NULL;

-- Now drop the done_definition column
ALTER TABLE public.mission_tasks 
DROP COLUMN done_definition;
