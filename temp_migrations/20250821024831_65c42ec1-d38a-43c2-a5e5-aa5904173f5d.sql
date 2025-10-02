-- Add standardization fields to mission_tasks table
ALTER TABLE public.mission_tasks 
ADD COLUMN estimated_duration text,
ADD COLUMN actual_duration text,
ADD COLUMN required_tools text[],
ADD COLUMN phase text NOT NULL DEFAULT 'execution';

-- Add check constraint for phase values
ALTER TABLE public.mission_tasks 
ADD CONSTRAINT mission_tasks_phase_check 
CHECK (phase IN ('planning', 'execution', 'verification', 'documentation'));

-- Create indices for better performance
CREATE INDEX idx_mission_tasks_phase ON public.mission_tasks(phase);
CREATE INDEX idx_mission_tasks_status_phase ON public.mission_tasks(status, phase);

-- Add comments for documentation
COMMENT ON COLUMN public.mission_tasks.estimated_duration IS 'Estimated time to complete this task (e.g., "2 hours", "30 minutes")';
COMMENT ON COLUMN public.mission_tasks.actual_duration IS 'Actual time taken to complete this task';
COMMENT ON COLUMN public.mission_tasks.required_tools IS 'Array of tool names/IDs required for this task';
COMMENT ON COLUMN public.mission_tasks.phase IS 'Task phase: planning, execution, verification, or documentation';