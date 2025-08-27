-- Step 1: Clean up existing data - mark older Wood Saw checkouts as returned
-- Keep only the most recent checkout (2025-08-26) and mark the older ones as returned
UPDATE checkouts 
SET is_returned = true, 
    updated_at = now()
WHERE tool_id = 'c0f70856-a496-4a42-9b6c-36bcaf161661' 
  AND is_returned = false 
  AND id IN ('acd65130-6659-4f9d-82b3-fcbc3c628ff4', '2ae0beb5-9ba5-4b57-a002-6d170fa2fef0');

-- Step 2: Add database constraint to prevent multiple active checkouts
-- First, create a unique partial index to enforce one active checkout per tool
CREATE UNIQUE INDEX CONCURRENTLY idx_unique_active_checkout_per_tool 
ON checkouts (tool_id) 
WHERE is_returned = false;

-- Step 3: Create a function to validate checkout operations
CREATE OR REPLACE FUNCTION validate_checkout_operation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate on INSERT operations for new checkouts
  IF TG_OP = 'INSERT' THEN
    -- Check if tool already has an active checkout
    IF EXISTS (
      SELECT 1 FROM checkouts 
      WHERE tool_id = NEW.tool_id 
        AND is_returned = false 
        AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'Tool already has an active checkout. Tool ID: %', NEW.tool_id;
    END IF;
    
    -- Ensure tool status is available before allowing checkout
    IF NOT EXISTS (
      SELECT 1 FROM tools 
      WHERE id = NEW.tool_id 
        AND status = 'available'
    ) THEN
      RAISE EXCEPTION 'Tool is not available for checkout. Current status must be "available".';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;