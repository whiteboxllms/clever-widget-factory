import { apiService, getApiData } from '@/lib/apiService';
import { Tool } from '@/hooks/tools/useToolsData';

export const toolsService = {
  // Fetch tools with issues
  async fetchToolsWithIssues(): Promise<Set<string>> {
    try {
      // Use AWS-backed /issues endpoint instead of Supabase
      const response = await apiService.get('/issues?context_type=tool&status=active');
      const payload = getApiData(response as any) || response;
      const issuesData = Array.isArray(payload) ? payload : [];

      return new Set(
        issuesData
          .map((issue: any) => issue.context_id)
          .filter((id: string | null | undefined) => Boolean(id))
      );
    } catch (error) {
      console.error('Error fetching tools with issues:', error);
      return new Set();
    }
  },

};