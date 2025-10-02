-- First, let's clean up the duplicate issues by keeping only the first one for each unique description
-- and setting the others to 'removed' status
WITH ranked_issues AS (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY tool_id, description 
           ORDER BY reported_at ASC
         ) as rn
  FROM tool_issues 
  WHERE status = 'active'
)
UPDATE tool_issues 
SET status = 'removed', 
    updated_at = now()
WHERE id IN (
  SELECT id 
  FROM ranked_issues 
  WHERE rn > 1
);