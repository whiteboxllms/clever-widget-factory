-- Phase 1: Migrate existing tool_issues data to issues table
INSERT INTO issues (
  id,
  context_type,
  context_id,
  description,
  issue_type,
  status,
  reported_by,
  reported_at,
  resolved_by,
  resolved_at,
  root_cause,
  resolution_notes,
  resolution_photo_urls,
  report_photo_urls,
  is_misuse,
  related_checkout_id,
  damage_assessment,
  responsibility_assigned,
  efficiency_loss_percentage,
  action_required,
  workflow_status,
  diagnosed_by,
  diagnosed_at,
  assigned_to,
  ready_to_work,
  ai_analysis,
  materials_needed,
  work_progress,
  can_self_claim,
  estimated_hours,
  actual_hours,
  next_steps,
  created_at,
  updated_at
)
SELECT 
  id,
  'tool'::context_type,
  tool_id,
  description,
  issue_type,
  status,
  reported_by,
  reported_at,
  resolved_by,
  resolved_at,
  root_cause,
  resolution_notes,
  resolution_photo_urls,
  report_photo_urls,
  is_misuse,
  related_checkout_id,
  damage_assessment,
  responsibility_assigned,
  efficiency_loss_percentage,
  action_required,
  workflow_status,
  diagnosed_by,
  diagnosed_at,
  assigned_to,
  ready_to_work,
  ai_analysis,
  materials_needed,
  work_progress,
  can_self_claim,
  estimated_hours,
  actual_hours,
  next_steps,
  created_at,
  updated_at
FROM tool_issues
WHERE id NOT IN (SELECT id FROM issues);

-- Phase 2: Migrate tool_issue_history to issue_history
INSERT INTO issue_history (
  id,
  issue_id,
  changed_by,
  changed_at,
  old_status,
  new_status,
  field_changed,
  old_value,
  new_value,
  notes,
  created_at
)
SELECT 
  id,
  issue_id,
  changed_by,
  changed_at,
  old_status,
  new_status,
  field_changed,
  old_value,
  new_value,
  notes,
  created_at
FROM tool_issue_history
WHERE id NOT IN (SELECT id FROM issue_history);

-- Phase 3: Update foreign key constraints to point to issues table
-- First update issue_requirements to reference issues table
UPDATE issue_requirements 
SET issue_id = (SELECT id FROM issues WHERE issues.id = issue_requirements.issue_id);

-- Update worker_performance to reference issues table  
UPDATE worker_performance 
SET issue_id = (SELECT id FROM issues WHERE issues.id = worker_performance.issue_id);

-- Update actions to reference issues table
UPDATE actions 
SET linked_issue_id = (SELECT id FROM issues WHERE issues.id = actions.linked_issue_id);

-- Phase 4: Drop deprecated tables with CASCADE to handle remaining dependencies
DROP TABLE IF EXISTS tool_issue_history CASCADE;
DROP TABLE IF EXISTS tool_issues CASCADE;