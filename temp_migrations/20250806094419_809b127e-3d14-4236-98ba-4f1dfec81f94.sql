-- Function to capitalize first letter of each word
CREATE OR REPLACE FUNCTION public.capitalize_tool_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Capitalize each word in the tool name
  IF NEW.name IS NOT NULL THEN
    NEW.name = initcap(NEW.name);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for new tools
CREATE TRIGGER capitalize_tool_name_trigger
  BEFORE INSERT OR UPDATE ON public.tools
  FOR EACH ROW
  EXECUTE FUNCTION public.capitalize_tool_name();

-- Update existing tool names to be capitalized
UPDATE public.tools 
SET name = initcap(name) 
WHERE name IS NOT NULL;