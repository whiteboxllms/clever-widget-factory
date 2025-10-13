-- Add action_id to checkouts table to link tool checkouts with actions
ALTER TABLE public.checkouts 
ADD COLUMN action_id UUID REFERENCES public.actions(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_checkouts_action_id ON public.checkouts(action_id);

-- Add comment for documentation
COMMENT ON COLUMN public.checkouts.action_id IS 'Optional link to the action this checkout is associated with - used for automatic checkout/checkin';
