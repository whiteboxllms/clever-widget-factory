-- Create storage_vicinities table to track locations and who created them
CREATE TABLE public.storage_vicinities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

-- Enable Row Level Security
ALTER TABLE public.storage_vicinities ENABLE ROW LEVEL SECURITY;

-- Create policies for storage vicinities
CREATE POLICY "Anyone can view active storage vicinities" 
ON public.storage_vicinities 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Authenticated users can create storage vicinities" 
ON public.storage_vicinities 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Authenticated users can update storage vicinities" 
ON public.storage_vicinities 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_storage_vicinities_updated_at
BEFORE UPDATE ON public.storage_vicinities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Populate existing vicinities from tools table
INSERT INTO public.storage_vicinities (name, created_by)
SELECT DISTINCT storage_vicinity, 
  (SELECT user_id FROM public.profiles LIMIT 1) -- Use first available user as creator
FROM public.tools 
WHERE storage_vicinity IS NOT NULL AND storage_vicinity != ''
ON CONFLICT (name) DO NOTHING;