-- Drop the restrictive policy that only allows assigned users to update
DROP POLICY "Assigned users can update their tasks" ON public.mission_tasks;

-- Create a new policy that allows any authenticated user to update tasks
CREATE POLICY "Authenticated users can update tasks" 
ON public.mission_tasks 
FOR UPDATE 
TO authenticated
USING (true);