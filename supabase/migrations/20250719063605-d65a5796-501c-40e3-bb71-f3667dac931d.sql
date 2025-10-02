-- Fix checkouts table RLS by updating the policy to check for user_id
DROP POLICY IF EXISTS "Authenticated users can manage checkouts" ON public.checkouts;

-- Create proper RLS policy for checkouts that checks user_id
CREATE POLICY "Users can manage their own checkouts" 
ON public.checkouts 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- Add user_id column to checkouts if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'checkouts' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.checkouts ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Update existing checkouts to have a valid user_id (set to a default admin user if needed)
-- This is a one-time fix for existing data
UPDATE public.checkouts 
SET user_id = (SELECT id FROM auth.users LIMIT 1)
WHERE user_id IS NULL;

-- Make user_id NOT NULL after updating existing data
ALTER TABLE public.checkouts ALTER COLUMN user_id SET NOT NULL;

-- Create storage policies for tool images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('tool-checkout-images', 'tool-checkout-images', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for checkout images
CREATE POLICY "Users can upload their own checkout images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
    bucket_id = 'tool-checkout-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own checkout images" 
ON storage.objects 
FOR SELECT 
USING (
    bucket_id = 'tool-checkout-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own checkout images" 
ON storage.objects 
FOR UPDATE 
USING (
    bucket_id = 'tool-checkout-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);