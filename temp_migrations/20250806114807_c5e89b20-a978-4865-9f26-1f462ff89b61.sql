-- Update existing storage vicinity names to title case
UPDATE storage_vicinities 
SET name = initcap(name)
WHERE name != initcap(name);

-- Create function to capitalize vicinity names
CREATE OR REPLACE FUNCTION public.capitalize_vicinity_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Capitalize each word in the vicinity name
  IF NEW.name IS NOT NULL THEN
    NEW.name = initcap(NEW.name);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for automatic capitalization on insert and update
CREATE TRIGGER capitalize_vicinity_name_trigger
  BEFORE INSERT OR UPDATE ON storage_vicinities
  FOR EACH ROW
  EXECUTE FUNCTION capitalize_vicinity_name();