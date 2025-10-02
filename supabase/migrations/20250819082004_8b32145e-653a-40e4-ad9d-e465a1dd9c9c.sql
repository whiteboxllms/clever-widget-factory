-- Allow authenticated users to update checkin records for correcting who performed the checkin
CREATE POLICY "Authenticated users can update checkin user names" 
ON checkins 
FOR UPDATE 
USING (auth.uid() IS NOT NULL) 
WITH CHECK (auth.uid() IS NOT NULL);