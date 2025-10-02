-- Phase 1: Database Schema Updates for Tool Condition Tracking

-- Add new tool statuses to the existing enum
ALTER TYPE tool_status ADD VALUE 'needs_attention';
ALTER TYPE tool_status ADD VALUE 'under_repair';

-- Create enum for action required
CREATE TYPE action_required_type AS ENUM ('repair', 'replace_part', 'not_fixable', 'remove');

-- Create enum for workflow status
CREATE TYPE workflow_status_type AS ENUM ('reported', 'diagnosed', 'in_progress', 'completed');

-- Add new fields to tool_issues table
ALTER TABLE tool_issues 
ADD COLUMN action_required action_required_type,
ADD COLUMN workflow_status workflow_status_type NOT NULL DEFAULT 'reported',
ADD COLUMN diagnosed_by uuid,
ADD COLUMN diagnosed_at timestamp with time zone;

-- Update existing issues to new workflow (all existing issues are already "reported")
-- No need to update as the default 'reported' status is appropriate

-- Add indexes for better performance
CREATE INDEX idx_tool_issues_workflow_status ON tool_issues(workflow_status);
CREATE INDEX idx_tool_issues_action_required ON tool_issues(action_required);
CREATE INDEX idx_tools_status ON tools(status);