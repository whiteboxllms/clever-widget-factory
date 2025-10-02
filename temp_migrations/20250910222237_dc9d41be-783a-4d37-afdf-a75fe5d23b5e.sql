-- Add parent_structure_id column to parts table to align with tools table
ALTER TABLE public.parts 
ADD COLUMN parent_structure_id uuid;

-- Add comment to clarify the field purpose
COMMENT ON COLUMN public.parts.parent_structure_id IS 'References tools with category Infrastructure or Container for storage hierarchy';