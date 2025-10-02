-- Add QA feedback field to mission_tasks table
ALTER TABLE public.mission_tasks 
ADD COLUMN qa_feedback text;

-- Add index for better performance when filtering by QA feedback status
CREATE INDEX idx_mission_tasks_qa_feedback ON public.mission_tasks(qa_feedback);

-- Update RLS policies to allow QA users to provide feedback
-- (keeping existing policies and adding specific QA feedback policy)
CREATE POLICY "QA can provide feedback on tasks" 
ON public.mission_tasks 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role IN ('leadership', 'qa')
  )
);