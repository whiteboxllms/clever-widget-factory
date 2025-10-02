-- First, remove defaults that will conflict with the enum changes
ALTER TABLE public.tools ALTER COLUMN condition DROP DEFAULT;
ALTER TABLE public.tools ALTER COLUMN status DROP DEFAULT;

-- Update tool_condition enum to use "good" instead of "optimal"
ALTER TYPE tool_condition RENAME TO tool_condition_old;

CREATE TYPE tool_condition AS ENUM ('good', 'functional_but_not_efficient', 'not_functional');

-- Update tools table to use new enum
ALTER TABLE public.tools 
ALTER COLUMN condition TYPE tool_condition 
USING CASE 
  WHEN condition::text = 'optimal' THEN 'good'
  WHEN condition::text = 'functional_but_not_efficient' THEN 'functional_but_not_efficient'
  WHEN condition::text = 'not_functional' THEN 'not_functional'
  ELSE 'good'
END::tool_condition;

-- Update checkins table to use new enum
ALTER TABLE public.checkins 
ALTER COLUMN condition_after TYPE tool_condition 
USING CASE 
  WHEN condition_after::text = 'optimal' THEN 'good'
  WHEN condition_after::text = 'functional_but_not_efficient' THEN 'functional_but_not_efficient'
  WHEN condition_after::text = 'not_functional' THEN 'not_functional'
  ELSE 'good'
END::tool_condition;

-- Update tool_status enum to simplified version
ALTER TYPE tool_status RENAME TO tool_status_old;

CREATE TYPE tool_status AS ENUM ('available', 'checked_out', 'unavailable');

-- Update tools table status column
ALTER TABLE public.tools 
ALTER COLUMN status TYPE tool_status 
USING CASE 
  WHEN status::text = 'available' THEN 'available'
  WHEN status::text = 'checked_out' THEN 'checked_out'
  WHEN status::text = 'not_functional' THEN 'unavailable'
  WHEN status::text = 'maintenance' THEN 'unavailable'
  ELSE 'available'
END::tool_status;

-- Add Stargazer SOP field to tools table
ALTER TABLE public.tools ADD COLUMN stargazer_sop text;

-- Set new defaults after enum changes
ALTER TABLE public.tools ALTER COLUMN condition SET DEFAULT 'good'::tool_condition;
ALTER TABLE public.tools ALTER COLUMN status SET DEFAULT 'available'::tool_status;

-- Drop old enums
DROP TYPE tool_condition_old;
DROP TYPE tool_status_old;