-- First, let's remove any trailing/leading spaces and handle duplicates
UPDATE storage_vicinities 
SET name = trim(name)
WHERE name != trim(name);

-- Handle potential duplicates by keeping the oldest record and removing newer ones
DELETE FROM storage_vicinities a
USING storage_vicinities b
WHERE a.id > b.id 
AND initcap(trim(a.name)) = initcap(trim(b.name));

-- Now update existing storage vicinity names to title case
UPDATE storage_vicinities 
SET name = initcap(trim(name))
WHERE name != initcap(trim(name));

-- Create function to capitalize vicinity names
CREATE OR REPLACE FUNCTION public.capitalize_vicinity_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Capitalize each word in the vicinity name and trim whitespace
  IF NEW.name IS NOT NULL THEN
    NEW.name = initcap(trim(NEW.name));
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for automatic capitalization on insert and update
CREATE TRIGGER capitalize_vicinity_name_trigger
  BEFORE INSERT OR UPDATE ON storage_vicinities
  FOR EACH ROW
  EXECUTE FUNCTION capitalize_vicinity_name();