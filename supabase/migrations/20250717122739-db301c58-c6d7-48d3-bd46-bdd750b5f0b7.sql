-- Create parts_history table to track inventory changes
CREATE TABLE public.parts_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID NOT NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('quantity_add', 'quantity_remove', 'update', 'create')),
  old_quantity INTEGER,
  new_quantity INTEGER,
  quantity_change INTEGER,
  changed_by TEXT NOT NULL,
  change_reason TEXT,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.parts_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view parts history" 
ON public.parts_history 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert parts history" 
ON public.parts_history 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Create index for better performance
CREATE INDEX idx_parts_history_part_id ON public.parts_history(part_id);
CREATE INDEX idx_parts_history_changed_at ON public.parts_history(changed_at DESC);