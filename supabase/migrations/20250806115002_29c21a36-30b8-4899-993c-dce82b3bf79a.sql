-- Create a temporary table to map old names to new standardized names
CREATE TEMP TABLE vicinity_mapping AS
SELECT 
  DISTINCT ON (initcap(trim(name))) 
  initcap(trim(name)) as new_name,
  (array_agg(id ORDER BY created_at))[1] as keep_id
FROM storage_vicinities 
GROUP BY initcap(trim(name));

-- Update tools table to reference the standardized vicinity names before we clean up
UPDATE tools 
SET storage_vicinity = vm.new_name
FROM vicinity_mapping vm, storage_vicinities sv
WHERE tools.storage_vicinity = sv.name 
AND sv.id != vm.keep_id
AND initcap(trim(sv.name)) = vm.new_name;

-- Update parts table to reference the standardized vicinity names before we clean up  
UPDATE parts 
SET storage_vicinity = vm.new_name
FROM vicinity_mapping vm, storage_vicinities sv
WHERE parts.storage_vicinity = sv.name 
AND sv.id != vm.keep_id
AND initcap(trim(sv.name)) = vm.new_name;

-- Delete duplicate storage vicinities, keeping only the oldest one
DELETE FROM storage_vicinities 
WHERE id NOT IN (SELECT keep_id FROM vicinity_mapping);

-- Update the remaining vicinity names to be properly capitalized
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