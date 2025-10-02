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

-- Phase 3: Drop deprecated tables
DROP TABLE IF EXISTS tool_issue_history;
DROP TABLE IF EXISTS tool_issues;