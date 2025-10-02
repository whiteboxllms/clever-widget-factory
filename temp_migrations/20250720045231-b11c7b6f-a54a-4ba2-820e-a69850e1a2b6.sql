-- Storage policies for mission-attachments bucket
CREATE POLICY "Anyone can view mission attachments" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'mission-attachments');

CREATE POLICY "Authenticated users can upload mission attachments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'mission-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update mission attachments" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'mission-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete mission attachments" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'mission-attachments' AND auth.role() = 'authenticated');

-- Storage policies for mission-evidence bucket
CREATE POLICY "Anyone can view mission evidence" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'mission-evidence');

CREATE POLICY "Authenticated users can upload mission evidence" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'mission-evidence' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update mission evidence" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'mission-evidence' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete mission evidence" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'mission-evidence' AND auth.role() = 'authenticated');