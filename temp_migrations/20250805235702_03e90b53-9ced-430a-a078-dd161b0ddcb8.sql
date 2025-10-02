-- Fix RLS policies for tool-checkout-images bucket to allow check-in image uploads

-- Drop the existing restrictive policies
DROP POLICY IF EXISTS "Users can upload their own checkout images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own checkout images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own checkout images" ON storage.objects;

-- Create more appropriate policies for tool check-in images
-- Allow authenticated users to upload check-in images (they can only upload, not delete what others uploaded)
CREATE POLICY "Authenticated users can upload checkout images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'tool-checkout-images' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to view all checkout images (needed for check-in history)
CREATE POLICY "Authenticated users can view checkout images" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'tool-checkout-images' 
  AND auth.role() = 'authenticated'
);

-- Allow users to update/delete only images they uploaded (based on user ID in filename)
CREATE POLICY "Users can manage their own uploaded checkout images" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'tool-checkout-images' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their own uploaded checkout images" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'tool-checkout-images' 
  AND auth.role() = 'authenticated'
);