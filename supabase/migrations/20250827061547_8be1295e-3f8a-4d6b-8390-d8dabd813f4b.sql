-- Add plan_commitment column to actions table
ALTER TABLE public.actions 
ADD COLUMN plan_commitment boolean DEFAULT false;