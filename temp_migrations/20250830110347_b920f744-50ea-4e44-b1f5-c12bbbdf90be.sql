-- Fix the wheelbarrow status that should be checked out
UPDATE tools 
SET status = 'checked_out' 
WHERE serial_number = 'SF071925WB01' 
  AND id IN (
    SELECT tool_id 
    FROM checkouts 
    WHERE is_returned = false 
      AND tool_id = tools.id
  );