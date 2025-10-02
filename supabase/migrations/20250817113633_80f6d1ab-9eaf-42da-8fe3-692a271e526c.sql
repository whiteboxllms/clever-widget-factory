-- Create parts_orders table for tracking inventory orders
CREATE TABLE public.parts_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID NOT NULL,
  quantity_ordered NUMERIC NOT NULL,
  quantity_received NUMERIC NOT NULL DEFAULT 0,
  supplier_name TEXT,
  supplier_id UUID,
  estimated_cost NUMERIC,
  order_details TEXT,
  notes TEXT,
  expected_delivery_date DATE,
  ordered_by UUID NOT NULL,
  ordered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_quantities CHECK (quantity_ordered > 0 AND quantity_received >= 0),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'partially_received', 'completed', 'cancelled'))
);

-- Enable RLS on parts_orders
ALTER TABLE public.parts_orders ENABLE ROW LEVEL SECURITY;

-- Create policies for parts_orders
CREATE POLICY "Authenticated users can view parts orders" 
ON public.parts_orders 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create parts orders" 
ON public.parts_orders 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND ordered_by = auth.uid());

CREATE POLICY "Authenticated users can update parts orders" 
ON public.parts_orders 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Add order_id to parts_history table to link inventory additions to orders
ALTER TABLE public.parts_history 
ADD COLUMN order_id UUID REFERENCES public.parts_orders(id);

-- Create trigger for automatic timestamp updates on parts_orders
CREATE TRIGGER update_parts_orders_updated_at
BEFORE UPDATE ON public.parts_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_parts_orders_part_id ON public.parts_orders(part_id);
CREATE INDEX idx_parts_orders_status ON public.parts_orders(status);
CREATE INDEX idx_parts_history_order_id ON public.parts_history(order_id);