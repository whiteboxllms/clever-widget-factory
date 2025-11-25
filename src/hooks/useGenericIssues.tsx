import { useState, useEffect } from "react";

import { toast } from "@/hooks/use-toast";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { BaseIssue, ContextType, ToolIssue, OrderIssue } from "@/types/issues";
import { apiService } from "@/lib/apiService";

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
      // Build query parameters
      const params = new URLSearchParams();
      if (filters.contextType) params.append('context_type', filters.contextType);
      if (filters.contextId) params.append('context_id', filters.contextId);
      if (filters.status) {
        params.append('status', filters.status);
      } else {
        // For tool issues, include both active and resolved for management view
        if (filters.contextType === 'tool') {
          params.append('status', 'active,resolved');
        } else {
          // Default to active issues only for other contexts
          params.append('status', 'active');
        }
      }

      const data = await apiService.get(`/issues?${params}`);
      setIssues((data.data || []) as BaseIssue[]);
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
      const insertData = {
        context_type: issueData.context_type!,
        context_id: issueData.context_id!,
        description: issueData.description!,
        issue_type: issueData.issue_type || 'other',
        status: issueData.status || 'active',
        workflow_status: issueData.workflow_status || 'reported',
        issue_metadata: issueData.issue_metadata || {},
        report_photo_urls: issueData.report_photo_urls || [],
        damage_assessment: issueData.damage_assessment
      };

      const data = await apiService.post(`/issues`, insertData);

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
      // Get current issue data to track changes
      const currentData = await apiService.get(`/issues/${issueId}`);
      const currentIssue = currentData.data;

      // Update the issue
      await apiService.put(`/issues/${issueId}`, updates);

      // Create history entry for the update
      await apiService.post(`/issue_history`, {
        issue_id: issueId,
        old_status: currentIssue.status,
        new_status: updates.status || currentIssue.status,
        notes: 'Issue updated'
      });

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
    resolutionData?: {
      root_cause?: string;
      resolution_notes?: string;
      resolution_photo_urls?: string[];
    }
  ) => {
    return updateIssue(issueId, {
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      ...(resolutionData || {})
    });
  };

  const removeIssue = async (issueId: string) => {
    return updateIssue(issueId, { 
      status: 'removed' 
    });
  };

  const createIssuesFromText = async (
    issuesText: string, 
    issueType: BaseIssue['issue_type'] = 'efficiency',
    isMisuse: boolean = false,
    checkoutId?: string,
    damageAssessment?: string,
    efficiencyLossPercentage?: number,
    reportPhotoUrls?: string[]
  ) => {
    if (!issuesText.trim() || !filters.contextId) return;

    // Split text by lines and create individual issues
    const issueDescriptions = issuesText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    for (const description of issueDescriptions) {
      await createIssue({
        context_type: filters.contextType!,
        context_id: filters.contextId,
        description,
        issue_type: issueType,
        damage_assessment: damageAssessment,
        efficiency_loss_percentage: efficiencyLossPercentage,
        report_photo_urls: reportPhotoUrls
      });
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [filters.contextType, filters.contextId, filters.status]);

  return {
    issues,
    isLoading,
    fetchIssues,
    createIssue,
    createIssuesFromText,
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