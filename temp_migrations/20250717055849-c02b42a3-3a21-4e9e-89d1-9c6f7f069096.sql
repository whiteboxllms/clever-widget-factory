-- Add known_issues column to tools table
ALTER TABLE public.tools 
ADD COLUMN known_issues TEXT;