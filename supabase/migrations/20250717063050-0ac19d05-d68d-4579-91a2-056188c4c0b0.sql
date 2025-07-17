-- Update tool_condition enum to use more objective terminology
ALTER TYPE tool_condition RENAME TO tool_condition_old;

CREATE TYPE tool_condition AS ENUM ('optimal', 'functional_but_not_efficient', 'not_functional');

-- Update tools table to use new enum
ALTER TABLE public.tools 
ALTER COLUMN condition TYPE tool_condition 
USING CASE 
  WHEN condition::text = 'excellent' THEN 'optimal'
  WHEN condition::text = 'good' THEN 'optimal'
  WHEN condition::text = 'fair' THEN 'functional_but_not_efficient'
  WHEN condition::text = 'poor' THEN 'functional_but_not_efficient'
  WHEN condition::text = 'broken' THEN 'not_functional'
  ELSE 'optimal'
END::tool_condition;

-- Update checkins table to use new enum
ALTER TABLE public.checkins 
ALTER COLUMN condition_after TYPE tool_condition 
USING CASE 
  WHEN condition_after::text = 'excellent' THEN 'optimal'
  WHEN condition_after::text = 'good' THEN 'optimal'
  WHEN condition_after::text = 'fair' THEN 'functional_but_not_efficient'
  WHEN condition_after::text = 'poor' THEN 'functional_but_not_efficient'
  WHEN condition_after::text = 'broken' THEN 'not_functional'
  ELSE 'optimal'
END::tool_condition;

-- Update tool_status enum to use new terminology
ALTER TYPE tool_status RENAME TO tool_status_old;

CREATE TYPE tool_status AS ENUM ('available', 'checked_out', 'not_functional', 'maintenance');

-- Update tools table status column
ALTER TABLE public.tools 
ALTER COLUMN status TYPE tool_status 
USING CASE 
  WHEN status::text = 'broken' THEN 'not_functional'
  ELSE status::text
END::tool_status;

-- Drop old enums
DROP TYPE tool_condition_old;
DROP TYPE tool_status_old;