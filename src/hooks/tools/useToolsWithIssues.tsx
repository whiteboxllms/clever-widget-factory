import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useToolsWithIssues = () => {
  const [toolsWithIssues, setToolsWithIssues] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchToolsWithIssues = async () => {
    setLoading(true);
    try {
      const { data: issuesData, error } = await supabase
        .from('tool_issues')
        .select('tool_id')
        .eq('status', 'active');

      if (error) throw error;

      const toolIdsWithIssues = new Set(issuesData?.map(issue => issue.tool_id) || []);
      setToolsWithIssues(toolIdsWithIssues);
    } catch (error) {
      console.error('Error fetching tools with issues:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    toolsWithIssues,
    loading,
    fetchToolsWithIssues
  };
};