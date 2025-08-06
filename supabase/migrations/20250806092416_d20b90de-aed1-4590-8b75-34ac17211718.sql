-- Update all existing tools to have capitalized serial numbers
UPDATE public.tools 
SET serial_number = UPPER(serial_number) 
WHERE serial_number IS NOT NULL;

-- Create function to automatically capitalize serial numbers
CREATE OR REPLACE FUNCTION public.capitalize_serial_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Capitalize serial_number if it's not null
  IF NEW.serial_number IS NOT NULL THEN
    NEW.serial_number = UPPER(NEW.serial_number);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically capitalize serial numbers on insert and update
CREATE TRIGGER capitalize_tools_serial_number
  BEFORE INSERT OR UPDATE ON public.tools
  FOR EACH ROW
  EXECUTE FUNCTION public.capitalize_serial_number();