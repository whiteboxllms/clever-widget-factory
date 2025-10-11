-- Add DELETE policy for action_implementation_updates table
-- Users can only delete their own implementation updates

CREATE POLICY "Users can delete their own implementation updates" 
ON public.action_implementation_updates 
FOR DELETE 
USING (auth.uid() = updated_by);

-- Add UPDATE policy for action_implementation_updates table  
-- Users can only update their own implementation updates

CREATE POLICY "Users can update their own implementation updates" 
ON public.action_implementation_updates 
FOR UPDATE 
USING (auth.uid() = updated_by)
WITH CHECK (auth.uid() = updated_by);
