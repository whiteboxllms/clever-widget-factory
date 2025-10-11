-- Add created_by and updated_by audit fields to actions table
-- This follows best practices for tracking who created and last modified records

-- Add the audit fields
ALTER TABLE public.actions 
ADD COLUMN created_by UUID REFERENCES auth.users(id),
ADD COLUMN updated_by UUID REFERENCES auth.users(id);

-- Create indexes for performance
CREATE INDEX idx_actions_created_by ON public.actions(created_by);
CREATE INDEX idx_actions_updated_by ON public.actions(updated_by);

-- Create a function to automatically set updated_by on updates
CREATE OR REPLACE FUNCTION set_updated_by_for_actions()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-set updated_by on updates
CREATE TRIGGER trigger_set_updated_by_actions
  BEFORE UPDATE ON public.actions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_by_for_actions();

-- Create a function to automatically set created_by and updated_by on inserts
CREATE OR REPLACE FUNCTION set_audit_fields_for_actions()
RETURNS TRIGGER AS $$
BEGIN
  NEW.created_by = auth.uid();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-set audit fields on inserts
CREATE TRIGGER trigger_set_audit_fields_actions
  BEFORE INSERT ON public.actions
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields_for_actions();

-- Populate created_by and updated_by for existing actions
-- Set to Stefan's user ID for all existing actions
UPDATE public.actions 
SET created_by = 'b8006f2b-0ec7-4107-b05a-b4c6b49541fd',
    updated_by = 'b8006f2b-0ec7-4107-b05a-b4c6b49541fd'
WHERE created_by IS NULL;

-- Add comment
COMMENT ON COLUMN public.actions.created_by IS 'User who created this action';
COMMENT ON COLUMN public.actions.updated_by IS 'User who last updated this action';
