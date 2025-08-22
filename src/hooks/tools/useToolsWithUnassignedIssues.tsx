import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useToolsWithUnassignedIssues = () => {
  const [toolsWithUnassignedIssues, setToolsWithUnassignedIssues] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchToolsWithUnassignedIssues = async () => {
    setLoading(true);
    try {
      const { data: issuesData, error } = await supabase
        .from('tool_issues')
        .select('tool_id')
        .eq('status', 'active')
        .is('assigned_to', null);

      if (error) throw error;

      const toolIdsWithUnassignedIssues = new Set(issuesData?.map(issue => issue.tool_id) || []);
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