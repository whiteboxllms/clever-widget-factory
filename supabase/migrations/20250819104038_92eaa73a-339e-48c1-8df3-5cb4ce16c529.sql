-- Clean up duplicate issues by keeping only the first one for each unique description
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

-- Migrate all check-in issues to tool_issues table
-- This is a one-time migration to convert historical check-in problems to the new tool_issues system
INSERT INTO tool_issues (
  tool_id,
  description,
  issue_type,
  blocks_checkout,
  reported_by,
  related_checkout_id,
  status,
  reported_at,
  created_at,
  updated_at
)
SELECT DISTINCT
  c.tool_id,
  '[Migrated from check-in by ' || c.user_name || ']: ' || TRIM(c.problems_reported) as description,
  'efficiency' as issue_type,
  false as blocks_checkout,
  COALESCE(co.user_id, '00000000-0000-0000-0000-000000000000'::uuid) as reported_by,
  c.checkout_id as related_checkout_id,
  'active' as status,
  c.checkin_date as reported_at,
  c.created_at,
  now() as updated_at
FROM checkins c
LEFT JOIN checkouts co ON c.checkout_id = co.id
WHERE c.problems_reported IS NOT NULL 
  AND TRIM(c.problems_reported) != ''
  AND NOT EXISTS (
    -- Check if this issue already exists in tool_issues
    SELECT 1 FROM tool_issues ti 
    WHERE ti.tool_id = c.tool_id 
    AND (
      ti.description = TRIM(c.problems_reported) 
      OR ti.description = '[Migrated from check-in by ' || c.user_name || ']: ' || TRIM(c.problems_reported)
      OR ti.description LIKE '%' || TRIM(c.problems_reported) || '%'
    )
    AND ti.status = 'active'
  );