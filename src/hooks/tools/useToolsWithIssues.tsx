import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useToolsWithIssues = () => {
  const [toolsWithIssues, setToolsWithIssues] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const fetchToolsWithIssues = async () => {
    setLoading(true);
    try {
      const { data: issuesData, error } = await supabase
        .from('issues')
        .select('context_id')
        .eq('context_type', 'tool')
        .eq('status', 'active');

      if (error) throw error;

      const toolIdsWithIssues = new Set(issuesData?.map(issue => issue.context_id) || []);
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