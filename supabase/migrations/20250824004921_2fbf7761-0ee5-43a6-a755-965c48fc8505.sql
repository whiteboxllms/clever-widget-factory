-- Add fields to mission_actions table for linking to issues
ALTER TABLE public.mission_actions 
ADD COLUMN linked_issue_id uuid REFERENCES public.tool_issues(id),
ADD COLUMN issue_reference text,
ADD COLUMN attachments text[] DEFAULT '{}';

-- Add index for better performance when looking up actions by issue
CREATE INDEX idx_mission_actions_linked_issue_id ON public.mission_actions(linked_issue_id);