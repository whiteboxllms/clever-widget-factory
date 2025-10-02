-- Add legacy_storage_vicinity column to parts table
ALTER TABLE public.parts 
ADD COLUMN legacy_storage_vicinity TEXT;

-- Copy current storage_vicinity values to legacy column for existing records
UPDATE public.parts 
SET legacy_storage_vicinity = storage_vicinity 
WHERE legacy_storage_vicinity IS NULL;

-- Create a function to map storage vicinity names to parent structure IDs
CREATE OR REPLACE FUNCTION public.map_vicinity_name_to_structure_id(vicinity_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    structure_id UUID;
BEGIN
    -- Direct name match first
    SELECT id INTO structure_id
    FROM tools 
    WHERE category IN ('Infrastructure', 'Container') 
    AND name = vicinity_name
    AND status != 'removed'
    LIMIT 1;
    
    -- If no direct match, try case-insensitive match
    IF structure_id IS NULL THEN
        SELECT id INTO structure_id
        FROM tools 
        WHERE category IN ('Infrastructure', 'Container') 
        AND LOWER(name) = LOWER(vicinity_name)
        AND status != 'removed'
        LIMIT 1;
    END IF;
    
    -- If still no match, try partial match
    IF structure_id IS NULL THEN
        SELECT id INTO structure_id
        FROM tools 
        WHERE category IN ('Infrastructure', 'Container') 
        AND (name ILIKE '%' || vicinity_name || '%' OR vicinity_name ILIKE '%' || name || '%')
        AND status != 'removed'
        LIMIT 1;
    END IF;
    
    RETURN structure_id;
END;
$$;

-- Update storage_vicinity to use parent structure IDs instead of names
UPDATE public.parts 
SET storage_vicinity = (
    SELECT COALESCE(
        map_vicinity_name_to_structure_id(storage_vicinity),
        -- If no mapping found, set to NULL and we'll handle manually
        NULL
    )::TEXT
)
WHERE storage_vicinity IS NOT NULL 
AND storage_vicinity != '';

-- Clean up the mapping function as it's no longer needed
DROP FUNCTION IF EXISTS public.map_vicinity_name_to_structure_id(TEXT);