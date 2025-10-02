-- Add participants column to actions table to store multiple support individuals
ALTER TABLE public.actions 
ADD COLUMN participants UUID[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.actions.participants IS 'Array of user IDs representing support individuals for this action';