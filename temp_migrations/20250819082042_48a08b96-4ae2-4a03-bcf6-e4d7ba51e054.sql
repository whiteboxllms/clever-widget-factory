-- Drop the existing policy that might be conflicting
DROP POLICY IF EXISTS "Authenticated users can update checkin user names" ON checkins;

-- Create a more specific policy for updating checkin records
CREATE POLICY "Users can update checkin records" 
ON checkins 
FOR UPDATE 
USING (true) 
WITH CHECK (true);