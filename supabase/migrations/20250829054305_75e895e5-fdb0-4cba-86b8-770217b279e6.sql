-- Create context type enum for generic issues system
CREATE TYPE public.context_type AS ENUM ('tool', 'order', 'inventory', 'facility');

-- Create new generic issues table
CREATE TABLE public.issues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  context_type context_type NOT NULL DEFAULT 'tool',
  context_id uuid NOT NULL,
  reported_by uuid NOT NULL,
  reported_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved_by uuid NULL,
  resolved_at timestamp with time zone NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_misuse boolean NOT NULL DEFAULT false,
  related_checkout_id uuid NULL,
  responsibility_assigned boolean NOT NULL DEFAULT false,
  efficiency_loss_percentage numeric NULL,
  action_required USER-DEFINED NULL,
  workflow_status USER-DEFINED NOT NULL DEFAULT 'reported'::workflow_status_type,
  diagnosed_by uuid NULL,
  diagnosed_at timestamp with time zone NULL,
  assigned_to uuid NULL,
  ready_to_work boolean NULL DEFAULT false,
  materials_needed jsonb NULL DEFAULT '[]'::jsonb,
  can_self_claim boolean NULL DEFAULT false,
  estimated_hours numeric NULL,
  actual_hours numeric NULL,
  issue_type text NOT NULL DEFAULT 'efficiency'::text,
  status text NOT NULL DEFAULT 'active'::text,
  report_photo_urls text[] NULL DEFAULT '{}'::text[],
  root_cause text NULL,
  resolution_notes text NULL,
  resolution_photo_urls text[] NULL DEFAULT '{}'::text[],
  next_steps text NULL,
  ai_analysis text NULL,
  damage_assessment text NULL,
  work_progress text NULL,
  description text NOT NULL,
  issue_metadata jsonb NULL DEFAULT '{}'::jsonb
);

-- Enable RLS on issues table
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

-- Migrate data from tool_issues to issues
INSERT INTO public.issues (
  id, context_type, context_id, reported_by, reported_at, resolved_by, resolved_at,
  created_at, updated_at, is_misuse, related_checkout_id, responsibility_assigned,
  efficiency_loss_percentage, action_required, workflow_status, diagnosed_by,
  diagnosed_at, assigned_to, ready_to_work, materials_needed, can_self_claim,
  estimated_hours, actual_hours, issue_type, status, report_photo_urls,
  root_cause, resolution_notes, resolution_photo_urls, next_steps,
  ai_analysis, damage_assessment, work_progress, description, issue_metadata
)
SELECT 
  id, 'tool'::context_type, tool_id, reported_by, reported_at, resolved_by, resolved_at,
  created_at, updated_at, is_misuse, related_checkout_id, responsibility_assigned,
  efficiency_loss_percentage, action_required, workflow_status, diagnosed_by,
  diagnosed_at, assigned_to, ready_to_work, materials_needed, can_self_claim,
  estimated_hours, actual_hours, issue_type, status, report_photo_urls,
  root_cause, resolution_notes, resolution_photo_urls, next_steps,
  ai_analysis, damage_assessment, work_progress, description, '{}'::jsonb
FROM tool_issues;

-- Create RLS policies for issues table
CREATE POLICY "Any authenticated user can create issues" 
ON public.issues 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view issues" 
ON public.issues 
FOR SELECT 
TO authenticated 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update issues" 
ON public.issues 
FOR UPDATE 
TO authenticated 
USING (auth.uid() IS NOT NULL);

-- Create new issue_history table for generic context
CREATE TABLE public.issue_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  changed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  new_status text NOT NULL,
  field_changed text NULL,
  old_value text NULL,
  notes text NULL,
  new_value text NULL,
  old_status text NULL
);

-- Enable RLS on issue_history
ALTER TABLE public.issue_history ENABLE ROW LEVEL SECURITY;

-- Migrate tool_issue_history to issue_history
INSERT INTO public.issue_history
SELECT * FROM tool_issue_history;

-- Create RLS policies for issue_history
CREATE POLICY "Authenticated users can create issue history" 
ON public.issue_history 
FOR INSERT 
TO authenticated 
WITH CHECK ((auth.uid() IS NOT NULL) AND (changed_by = auth.uid()));

CREATE POLICY "Authenticated users can view issue history" 
ON public.issue_history 
FOR SELECT 
TO authenticated 
USING (auth.uid() IS NOT NULL);

-- Add new statuses to parts_orders
ALTER TYPE parts_order_status ADD VALUE IF NOT EXISTS 'receiving_in_progress';
ALTER TYPE parts_order_status ADD VALUE IF NOT EXISTS 'problem_reported';
ALTER TYPE parts_order_status ADD VALUE IF NOT EXISTS 'partially_received';

-- Update updated_at trigger for issues table
CREATE TRIGGER update_issues_updated_at
  BEFORE UPDATE ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Drop old tables after migration is confirmed working
-- DROP TABLE public.tool_issues CASCADE;
-- DROP TABLE public.tool_issue_history CASCADE;