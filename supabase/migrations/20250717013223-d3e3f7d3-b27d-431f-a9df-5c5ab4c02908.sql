-- Add manual_url column to tools table for storing manual links
ALTER TABLE public.tools 
ADD COLUMN IF NOT EXISTS manual_url TEXT;