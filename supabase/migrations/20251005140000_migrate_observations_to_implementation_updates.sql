-- Migration to move existing observations to implementation updates
-- This will create the first implementation update for each action that has observations

-- Insert existing observations as the first implementation update
-- Use assigned_to if available, otherwise use created_by
INSERT INTO public.action_implementation_updates (
  action_id,
  updated_by,
  update_text,
  update_type,
  created_at
)
SELECT 
  a.id as action_id,
  COALESCE(a.assigned_to, a.created_by) as updated_by,
  a.observations as update_text,
  'progress' as update_type,
  a.created_at as created_at
FROM public.actions a
WHERE a.observations IS NOT NULL 
  AND a.observations != ''
  AND a.observations != 'null'
  AND a.organization_id IS NOT NULL
  AND NOT EXISTS (
    -- Only migrate if no implementation updates already exist for this action
    SELECT 1 FROM public.action_implementation_updates u 
    WHERE u.action_id = a.id
  );

-- Add comment
COMMENT ON TABLE public.action_implementation_updates IS 'Tracks daily implementation updates for actions with full history and accountability. Migrated from observations field.';
