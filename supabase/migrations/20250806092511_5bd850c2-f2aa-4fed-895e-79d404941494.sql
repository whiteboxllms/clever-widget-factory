-- Fix security warnings: Set search_path for database functions
CREATE OR REPLACE FUNCTION public.capitalize_serial_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Capitalize serial_number if it's not null
  IF NEW.serial_number IS NOT NULL THEN
    NEW.serial_number = UPPER(NEW.serial_number);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Also fix the other functions
CREATE OR REPLACE FUNCTION public.generate_mission_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.mission_number IS NULL THEN
    NEW.mission_number = nextval('mission_number_seq');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$;