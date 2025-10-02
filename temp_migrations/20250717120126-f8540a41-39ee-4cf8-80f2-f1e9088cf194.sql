-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  contact_info JSONB DEFAULT '{}',
  quality_rating NUMERIC DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on suppliers table
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for suppliers
CREATE POLICY "Anyone can view suppliers" 
ON public.suppliers 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can manage suppliers" 
ON public.suppliers 
FOR ALL 
USING (auth.role() = 'authenticated'::text);

-- Create trigger for suppliers updated_at
CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert existing suppliers from parts table
INSERT INTO public.suppliers (name)
SELECT DISTINCT supplier
FROM public.parts
WHERE supplier IS NOT NULL AND supplier != ''
ON CONFLICT (name) DO NOTHING;

-- Add supplier_id column to parts table
ALTER TABLE public.parts ADD COLUMN supplier_id UUID;

-- Update parts table to reference supplier_id
UPDATE public.parts 
SET supplier_id = suppliers.id
FROM public.suppliers
WHERE parts.supplier = suppliers.name;

-- Add foreign key constraint
ALTER TABLE public.parts 
ADD CONSTRAINT fk_parts_supplier 
FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);

-- Create index for better performance
CREATE INDEX idx_parts_supplier_id ON public.parts(supplier_id);