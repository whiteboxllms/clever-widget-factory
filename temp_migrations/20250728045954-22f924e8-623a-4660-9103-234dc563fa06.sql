-- Update parts table to have vicinity (required) and specific location (optional)
ALTER TABLE public.parts 
RENAME COLUMN intended_storage_location TO storage_vicinity;

ALTER TABLE public.parts 
ADD COLUMN storage_location TEXT;

-- Update tools table to match the same pattern
ALTER TABLE public.tools 
RENAME COLUMN intended_storage_location TO storage_vicinity;

ALTER TABLE public.tools 
ADD COLUMN storage_location TEXT;