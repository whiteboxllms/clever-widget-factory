-- Enable planned checkouts by making checkout_date nullable
-- This allows creating checkouts for future use (planned) vs actual usage

-- Make checkout_date nullable for planned tools
ALTER TABLE public.checkouts 
ALTER COLUMN checkout_date DROP NOT NULL;

-- Add index for efficient planned tools queries
CREATE INDEX idx_checkouts_planned ON public.checkouts(action_id) 
WHERE checkout_date IS NULL;

-- Add index for active checkouts (actual usage)
CREATE INDEX idx_checkouts_active ON public.checkouts(action_id) 
WHERE checkout_date IS NOT NULL AND is_returned = false;

-- Add comment for documentation
COMMENT ON COLUMN public.checkouts.checkout_date IS 'When tool was actually checked out. NULL means planned for future use.';
