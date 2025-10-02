-- Add supplier tracking columns to parts_history for dynamic supplier tracking per stock addition
ALTER TABLE public.parts_history 
ADD COLUMN supplier_name text,
ADD COLUMN supplier_url text;

-- Update RLS policies to allow updates to these new columns
-- The existing policies should handle this, but let's ensure INSERT policy covers new columns
DROP POLICY IF EXISTS "Authenticated users can insert parts history" ON public.parts_history;
CREATE POLICY "Authenticated users can insert parts history" 
ON public.parts_history 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated'::text);