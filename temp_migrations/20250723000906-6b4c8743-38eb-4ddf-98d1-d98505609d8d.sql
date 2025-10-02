-- Remove QA feedback from mission_tasks table
ALTER TABLE public.mission_tasks 
DROP COLUMN qa_feedback;

-- Drop the index we created for task-level QA feedback
DROP INDEX IF EXISTS idx_mission_tasks_qa_feedback;

-- Add QA feedback to missions table
ALTER TABLE public.missions 
ADD COLUMN qa_feedback text;

-- Add index for mission-level QA feedback
CREATE INDEX idx_missions_qa_feedback ON public.missions(qa_feedback);

-- Update the QA policy to work at mission level
DROP POLICY IF EXISTS "QA can provide feedback on tasks" ON public.mission_tasks;

CREATE POLICY "QA can provide feedback on missions" 
ON public.missions 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role IN ('leadership', 'qa')
  )
);