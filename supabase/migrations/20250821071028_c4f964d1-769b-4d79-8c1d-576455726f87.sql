-- Add DELETE policy for mission_attachments table
-- Users should be able to delete attachments they uploaded or if they have leadership role

CREATE POLICY "Users can delete their own attachments or leadership can delete any"
ON mission_attachments
FOR DELETE
USING (
  uploaded_by = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE user_id = auth.uid() 
    AND role = 'leadership'
  )
);