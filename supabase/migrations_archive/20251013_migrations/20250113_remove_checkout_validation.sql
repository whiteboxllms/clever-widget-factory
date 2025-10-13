-- Remove restrictive checkout validation trigger
-- This allows more flexible tool checkout operations and supports planned checkouts

-- Drop all validation triggers and function
DROP TRIGGER IF EXISTS validate_checkout_operation_trigger ON checkouts;
DROP TRIGGER IF EXISTS trigger_validate_checkout ON checkouts;
DROP FUNCTION IF EXISTS validate_checkout_operation() CASCADE;

-- Update the organization_id trigger to handle NULL cases
CREATE OR REPLACE FUNCTION set_organization_id_for_checkouts()
RETURNS TRIGGER AS $$
BEGIN
  -- Try to get organization_id from auth context
  NEW.organization_id = get_user_organization_id();
  
  -- If that fails (returns NULL), use a default organization
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id = '00000000-0000-0000-0000-000000000001';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add helpful indexes instead of restrictive constraints
-- Unique constraint to prevent true duplicates (same tool, same user, same time)
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkouts_unique_active 
ON checkouts (tool_id, user_id) 
WHERE is_returned = false AND checkout_date IS NOT NULL;

-- Partial index for active checkouts (for performance)
CREATE INDEX IF NOT EXISTS idx_checkouts_active 
ON checkouts (tool_id, checkout_date) 
WHERE is_returned = false AND checkout_date IS NOT NULL;

-- Add comment explaining the change
COMMENT ON TABLE public.checkouts IS 'Tool checkouts - flexible checkout system with frontend validation';
