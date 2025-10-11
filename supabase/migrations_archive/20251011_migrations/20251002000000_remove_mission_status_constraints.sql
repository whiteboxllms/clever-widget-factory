-- Remove mission status constraints to allow flexible status values
-- This migration removes the CHECK constraints on mission statuses to allow for more flexible status management

-- Remove the CHECK constraint on missions.status (if it exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'missions_status_check' 
        AND table_name = 'missions' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.missions DROP CONSTRAINT missions_status_check;
    END IF;
END $$;

-- Remove the CHECK constraint on actions.status (if constraint exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'mission_tasks_status_check' 
        AND table_name = 'actions' 
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.actions DROP CONSTRAINT mission_tasks_status_check;
    END IF;
END $$;

-- Add comments to document the change (safe to run multiple times)
COMMENT ON COLUMN public.missions.status IS 'Mission status - no longer constrained to specific values for flexibility';

-- Comment on actions table status column
COMMENT ON COLUMN public.actions.status IS 'Action status - no longer constrained to specific values for flexibility';
