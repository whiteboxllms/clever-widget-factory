import { supabase } from '@/integrations/supabase/client';
import { Tool } from '@/hooks/tools/useToolsData';

export const toolsService = {
  // Fetch tools with issues
  async fetchToolsWithIssues(): Promise<Set<string>> {
    try {
      const { data: issuesData, error } = await supabase
        .from('issues')
        .select('context_id')
        .eq('context_type', 'tool')
        .eq('status', 'active');

      if (error) throw error;

      return new Set(issuesData?.map(issue => issue.context_id) || []);
    } catch (error) {
      console.error('Error fetching tools with issues:', error);
      return new Set();
    }
  },

};