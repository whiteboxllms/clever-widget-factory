import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { BaseIssue, ContextType, ToolIssue, OrderIssue } from "@/types/issues";

export interface GenericIssuesFilters {
  contextType?: ContextType;
  contextId?: string;
  status?: 'active' | 'resolved' | 'removed';
}

export function useGenericIssues(filters: GenericIssuesFilters = {}) {
  const organizationId = useOrganizationId();
  const [issues, setIssues] = useState<BaseIssue[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchIssues = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('issues')
        .select('*')
        .order('reported_at', { ascending: false });

      // Apply filters
      if (filters.contextType) {
        query = query.eq('context_type', filters.contextType);
      }
      if (filters.contextId) {
        query = query.eq('context_id', filters.contextId);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      } else {
        // For tool issues, include both active and resolved for management view
        if (filters.contextType === 'tool') {
          query = query.in('status', ['active', 'resolved']);
        } else {
          // Default to active issues only for other contexts
          query = query.eq('status', 'active');
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      setIssues((data || []) as BaseIssue[]);
    } catch (error) {
      console.error('Error fetching issues:', error);
      toast({
        title: "Error loading issues",
        description: "Could not load issues. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createIssue = async (issueData: Partial<BaseIssue>) => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('Not authenticated');

      const insertData = {
        context_type: issueData.context_type!,
        context_id: issueData.context_id!,
        description: issueData.description!,
        issue_type: issueData.issue_type || 'other',
        status: issueData.status || 'active',
        workflow_status: issueData.workflow_status || 'reported',
        issue_metadata: issueData.issue_metadata || {},
        report_photo_urls: issueData.report_photo_urls || [],
        reported_by: user.data.user.id
      };

      const { data, error } = await supabase
        .from('issues')
        .insert({
          ...insertData
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Create history record
      await supabase
        .from('issue_history')
        .insert({
          issue_id: data.id,
          old_status: null,
          new_status: 'active',
          changed_by: user.data.user.id,
          notes: `Issue reported: "${issueData.description?.substring(0, 50)}${issueData.description && issueData.description.length > 50 ? '...' : ''}"`
        } as any);

      toast({
        title: "Issue reported",
        description: "The issue has been added successfully."
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

  const updateIssue = async (issueId: string, updates: Partial<BaseIssue>) => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('Not authenticated');

      // Get current issue data to track changes
      const { data: currentIssue, error: fetchError } = await supabase
        .from('issues')
        .select('*')
        .eq('id', issueId)
        .single();

      if (fetchError) throw fetchError;

      // Update the issue
      const { error: updateError } = await supabase
        .from('issues')
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
              .from('issue_history')
              .insert({
                issue_id: issueId,
                old_status: currentIssue.status,
                new_status: updates.status || currentIssue.status,
                changed_by: user.data.user.id,
                field_changed: field,
                old_value: oldValue ? String(oldValue) : null,
                new_value: newValue ? String(newValue) : null,
                notes: `Field '${field}' updated during issue edit`
              } as any)
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

  const resolveIssue = async (
    issueId: string, 
    resolutionData: {
      root_cause?: string;
      resolution_notes?: string;
      resolution_photo_urls?: string[];
    }
  ) => {
    return updateIssue(issueId, {
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      ...resolutionData
    });
  };

  const removeIssue = async (issueId: string) => {
    return updateIssue(issueId, { 
      status: 'removed' 
    });
  };

  useEffect(() => {
    fetchIssues();
  }, [filters.contextType, filters.contextId, filters.status]);

  return {
    issues,
    isLoading,
    fetchIssues,
    createIssue,
    updateIssue,
    resolveIssue,
    removeIssue
  };
}

// Specialized hooks for specific contexts
export function useToolIssues(toolId: string | null) {
  return useGenericIssues({ 
    contextType: 'tool', 
    contextId: toolId || undefined,
    // Include both active and resolved issues for tool management
    status: undefined // This will bypass the default active-only filter
  });
}

export function useOrderIssues(orderId: string | null) {
  return useGenericIssues({ 
    contextType: 'order', 
    contextId: orderId || undefined 
  });
}

export function useInventoryIssues(stockId: string | null) {
  return useGenericIssues({ 
    contextType: 'inventory', 
    contextId: stockId || undefined,
    // Include both active and resolved issues for inventory management
    status: undefined // This will bypass the default active-only filter
  });
}