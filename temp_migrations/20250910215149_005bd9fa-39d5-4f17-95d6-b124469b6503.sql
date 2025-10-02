-- Add created_by columns to tools and parts tables
ALTER TABLE public.tools ADD COLUMN created_by uuid REFERENCES auth.users(id);
ALTER TABLE public.parts ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- Create tools_history table similar to parts_history
CREATE TABLE public.tools_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_id uuid NOT NULL,
  change_type text NOT NULL,
  changed_by uuid NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  old_value text,
  new_value text,
  change_reason text,
  organization_id uuid NOT NULL
);

-- Enable RLS on tools_history
ALTER TABLE public.tools_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tools_history
CREATE POLICY "Authenticated users can insert tools history" 
ON public.tools_history 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated'::text);

CREATE POLICY "Authenticated users can view tools history" 
ON public.tools_history 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Create triggers to auto-populate created_by and organization_id for tools_history
CREATE TRIGGER set_organization_id_for_tools_history
  BEFORE INSERT ON public.tools_history
  FOR EACH ROW
  EXECUTE FUNCTION public.set_organization_id_for_tools_history();

-- Create triggers to auto-populate created_by on insert for tools and parts
CREATE OR REPLACE FUNCTION public.set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$function$;

-- Add triggers to tools and parts tables
CREATE TRIGGER set_created_by_for_tools
  BEFORE INSERT ON public.tools
  FOR EACH ROW
  EXECUTE FUNCTION public.set_created_by();

CREATE TRIGGER set_created_by_for_parts
  BEFORE INSERT ON public.parts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_created_by();