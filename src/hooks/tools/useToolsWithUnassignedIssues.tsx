import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useToolsWithUnassignedIssues = () => {
  const [toolsWithUnassignedIssues, setToolsWithUnassignedIssues] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchToolsWithUnassignedIssues = async () => {
    setLoading(true);
    try {
      // Get all active issues that are unassigned
      const { data: issuesData, error } = await supabase
        .from('tool_issues')
        .select('id, tool_id')
        .eq('status', 'active')
        .is('assigned_to', null);

      if (error) throw error;

      if (!issuesData || issuesData.length === 0) {
        setToolsWithUnassignedIssues(new Set());
        return;
      }

      // Get all actions linked to these issues
      const issueIds = issuesData.map(issue => issue.id);
      const { data: actionsData, error: actionsError } = await supabase
        .from('mission_actions')
        .select('linked_issue_id, status')
        .in('linked_issue_id', issueIds);

      if (actionsError) throw actionsError;

      // Filter out tools that have actions assigned or all actions completed
      const toolsNeedingAction = issuesData.filter(issue => {
        const issueActions = actionsData?.filter(action => action.linked_issue_id === issue.id) || [];
        
        // If no actions exist for this issue, it needs toolkeeper action
        if (issueActions.length === 0) {
          return true;
        }
        
        // If all actions are completed, issue is resolved - no toolkeeper action needed
        const allActionsCompleted = issueActions.every(action => action.status === 'completed');
        if (allActionsCompleted) {
          return false;
        }
        
        // If actions exist but not all completed, toolkeeper action is not needed
        return false;
      });

      const toolIdsWithUnassignedIssues = new Set(toolsNeedingAction.map(issue => issue.tool_id));
      setToolsWithUnassignedIssues(toolIdsWithUnassignedIssues);
    } catch (error) {
      console.error('Error fetching tools with unassigned issues:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    toolsWithUnassignedIssues,
    loading,
    fetchToolsWithUnassignedIssues
  };
};