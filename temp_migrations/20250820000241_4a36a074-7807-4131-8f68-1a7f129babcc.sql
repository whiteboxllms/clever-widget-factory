-- Create storage bucket for check-in photos if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('checkin-photos', 'checkin-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for check-in photos
CREATE POLICY "Users can upload their own check-in photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'checkin-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Check-in photos are publicly viewable" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'checkin-photos');

CREATE POLICY "Users can update their own check-in photos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'checkin-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own check-in photos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'checkin-photos' AND auth.uid() IS NOT NULL);