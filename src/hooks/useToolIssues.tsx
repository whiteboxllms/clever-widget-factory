import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ToolIssue {
  id: string;
  tool_id: string;
  description: string;
  issue_type: 'safety' | 'efficiency' | 'cosmetic' | 'preventative_maintenance' | 'functionality';
  status: 'active' | 'resolved' | 'removed';
  reported_by: string;
  reported_at: string;
  resolved_by?: string;
  resolved_at?: string;
  root_cause?: string;
  resolution_notes?: string;
  resolution_photo_urls?: string[];
  report_photo_urls?: string[];
  blocks_checkout?: boolean;
  is_misuse?: boolean;
  related_checkout_id?: string;
  damage_assessment?: string;
  responsibility_assigned?: boolean;
  efficiency_loss_percentage?: number;
  // New workflow fields
  action_required?: 'repair' | 'replace_part' | 'not_fixable' | 'remove';
  workflow_status: 'reported' | 'diagnosed' | 'in_progress' | 'completed';
  diagnosed_by?: string;
  diagnosed_at?: string;
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

  const createIssue = async (
    description: string, 
    issueType: ToolIssue['issue_type'] = 'efficiency', 
    blocksCheckout: boolean = false,
    isMisuse: boolean = false,
    checkoutId?: string,
    damageAssessment?: string,
    efficiencyLossPercentage?: number,
    reportPhotoUrls?: string[]
  ) => {
    if (!toolId) return null;

    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('tool_issues')
        .insert({
          tool_id: toolId,
          description: description.trim(),
          issue_type: issueType,
          blocks_checkout: blocksCheckout,
          is_misuse: isMisuse,
          related_checkout_id: checkoutId,
          damage_assessment: damageAssessment,
          efficiency_loss_percentage: efficiencyLossPercentage,
          report_photo_urls: reportPhotoUrls || [],
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
          notes: `Issue reported: "${description.trim().substring(0, 50)}${description.trim().length > 50 ? '...' : ''}"`
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

  const createIssuesFromText = async (
    issuesText: string, 
    issueType: ToolIssue['issue_type'] = 'efficiency', 
    blocksCheckout: boolean = false,
    isMisuse: boolean = false,
    checkoutId?: string,
    damageAssessment?: string,
    efficiencyLossPercentage?: number,
    reportPhotoUrls?: string[]
  ) => {
    if (!issuesText.trim() || !toolId) return;

    // Split text by lines and create individual issues
    const issueDescriptions = issuesText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    for (const description of issueDescriptions) {
      await createIssue(description, issueType, blocksCheckout, isMisuse, checkoutId, damageAssessment, efficiencyLossPercentage, reportPhotoUrls);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [toolId]);

  const updateIssue = async (
    issueId: string,
    updates: Partial<ToolIssue>
  ) => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('Not authenticated');

      // Get current issue data to track changes
      const { data: currentIssue, error: fetchError } = await supabase
        .from('tool_issues')
        .select('*')
        .eq('id', issueId)
        .single();

      if (fetchError) throw fetchError;

      // Update the issue
      const { error: updateError } = await supabase
        .from('tool_issues')
        .update(updates)
        .eq('id', issueId);

      if (updateError) throw updateError;

      // Create detailed history entries for each changed field
      const historyPromises = [];
      
      for (const [field, newValue] of Object.entries(updates)) {
        const oldValue = currentIssue[field];
        
        // Only create history if value actually changed
        if (oldValue !== newValue) {
          historyPromises.push(
            supabase
              .from('tool_issue_history')
              .insert({
                issue_id: issueId,
                old_status: currentIssue.status,
                new_status: currentIssue.status, // Status didn't change, just other fields
                changed_by: user.data.user.id,
                field_changed: field,
                old_value: oldValue ? String(oldValue) : null,
                new_value: newValue ? String(newValue) : null,
                notes: `Field '${field}' updated during issue edit`
              })
          );
        }
      }

      if (historyPromises.length > 0) {
        await Promise.all(historyPromises);
      }

      toast({
        title: "Issue updated",
        description: "The issue has been successfully updated."
      });

      await fetchIssues();
      return true;

    } catch (error) {
      console.error('Error updating issue:', error);
      toast({
        title: "Error updating issue",
        description: "Could not update the issue. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  };

  return {
    issues,
    isLoading,
    fetchIssues,
    createIssue,
    createIssuesFromText,
    updateIssue
  };
}