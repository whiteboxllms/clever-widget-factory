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

  // Migrate check-in issues to tool_issues table
  async migrateCheckinIssuesToToolIssues(toolId: string, fetchIssues: () => Promise<void>) {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Find all check-ins with reported issues for this tool
      const { data: checkinsWithIssues, error: checkinsError } = await supabase
        .from('checkins')
        .select('*')
        .eq('tool_id', toolId)
        .not('problems_reported', 'is', null)
        .not('problems_reported', 'eq', '');

      if (checkinsError) throw checkinsError;

      for (const checkin of checkinsWithIssues || []) {
        if (checkin.problems_reported) {
          // Check if this issue already exists in tool_issues using the raw problem text or formatted description
          const formattedDescription = `[Reported by ${checkin.user_name} during check-in]: ${checkin.problems_reported.trim()}`;
          
          const { data: existingIssue } = await supabase
            .from('tool_issues')
            .select('id')
            .eq('tool_id', toolId)
            .or(`description.eq.${checkin.problems_reported.trim()},description.eq.${formattedDescription}`)
            .maybeSingle();

          if (!existingIssue) {
            // Create new tool issue from check-in report
            const { error: insertError } = await supabase
              .from('tool_issues')
              .insert({
                tool_id: toolId,
                description: formattedDescription,
                issue_type: 'efficiency',
                blocks_checkout: false,
                reported_by: user.id,
                related_checkout_id: checkin.checkout_id
              });

            if (insertError) {
              console.error('Error migrating issue:', insertError);
            }
          }
        }
      }
      
      // Refresh issues list
      await fetchIssues();
    } catch (error) {
      console.error('Error migrating check-in issues:', error);
    }
  }
};