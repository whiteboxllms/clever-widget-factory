import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ToolIssue {
  id: string;
  tool_id: string;
  description: string;
  severity: 'safety' | 'functional' | 'cosmetic' | 'maintenance';
  status: 'active' | 'resolved' | 'removed';
  reported_by: string;
  reported_at: string;
  resolved_by?: string;
  resolved_at?: string;
  root_cause?: string;
  resolution_notes?: string;
  resolution_photo_urls?: string[];
}

export function useToolIssues(toolId: string | null) {
  const [issues, setIssues] = useState<ToolIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchIssues = async () => {
    if (!toolId) {
      setIssues([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tool_issues')
        .select('*')
        .eq('tool_id', toolId)
        .eq('status', 'active')
        .order('reported_at', { ascending: false });

      if (error) throw error;

      setIssues((data || []) as ToolIssue[]);
    } catch (error) {
      console.error('Error fetching tool issues:', error);
      toast({
        title: "Error loading issues",
        description: "Could not load tool issues. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createIssue = async (description: string, severity: ToolIssue['severity'] = 'functional') => {
    if (!toolId) return null;

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('tool_issues')
        .insert({
          tool_id: toolId,
          description: description.trim(),
          severity,
          reported_by: user.data.user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Create history record
      await supabase
        .from('tool_issue_history')
        .insert({
          issue_id: data.id,
          old_status: null,
          new_status: 'active',
          changed_by: user.data.user.id,
          notes: 'Issue reported during check-in'
        });

      toast({
        title: "Issue reported",
        description: "The issue has been added to the tool record."
      });

      await fetchIssues();
      return data;

    } catch (error) {
      console.error('Error creating issue:', error);
      toast({
        title: "Error reporting issue",
        description: "Could not save the issue. Please try again.",
        variant: "destructive"
      });
      return null;
    }
  };

  const createIssuesFromText = async (issuesText: string) => {
    if (!issuesText.trim() || !toolId) return;

    // Split text by lines and create individual issues
    const issueDescriptions = issuesText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    for (const description of issueDescriptions) {
      await createIssue(description);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [toolId]);

  return {
    issues,
    isLoading,
    fetchIssues,
    createIssue,
    createIssuesFromText
  };
}