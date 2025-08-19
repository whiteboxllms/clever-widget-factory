import { supabase } from '@/integrations/supabase/client';
import { Tool } from '@/hooks/tools/useToolsData';

export const toolsService = {
  // Fetch tools with issues
  async fetchToolsWithIssues(): Promise<Set<string>> {
    try {
      const { data: issuesData, error } = await supabase
        .from('tool_issues')
        .select('tool_id')
        .eq('status', 'active');

      if (error) throw error;

      return new Set(issuesData?.map(issue => issue.tool_id) || []);
    } catch (error) {
      console.error('Error fetching tools with issues:', error);
      return new Set();
    }
  },

};