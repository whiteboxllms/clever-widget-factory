-- Rename 'plan' column to 'policy' in actions table
ALTER TABLE public.actions RENAME COLUMN plan TO policy;