import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from "@/hooks/use-toast";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useAuth } from "@/hooks/useCognitoAuth";
import { BaseIssue, ContextType, ToolIssue, OrderIssue } from "@/types/issues";
import { apiService } from "@/lib/apiService";
import { offlineQueryConfig } from '@/lib/queryConfig';
import { issuesQueryKey, IssuesQueryFilters } from '@/lib/queryKeys';

export interface GenericIssuesFilters {
  contextType?: ContextType;
  contextId?: string;
  status?: 'active' | 'resolved' | 'removed';
}

export function useGenericIssues(filters: GenericIssuesFilters = {}) {
  const organizationId = useOrganizationId();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Build query key based on filters
  const queryKey = issuesQueryKey({
    contextType: filters.contextType,
    contextId: filters.contextId,
    status: filters.status,
  });

  // Use TanStack Query for caching
  const issuesQuery = useQuery({
    queryKey,
    queryFn: async () => {
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
      return (data.data || []) as BaseIssue[];
    },
    ...offlineQueryConfig,
    staleTime: 5 * 60 * 1000, // 5 minutes - issues don't change frequently
  });

  // Mutations for create/update/delete
  const createMutation = useMutation({
    mutationFn: async (issueData: Partial<BaseIssue>) => {
      const insertData = {
        context_type: issueData.context_type!,
        context_id: issueData.context_id!,
        description: issueData.description!,
        issue_type: issueData.issue_type || 'other',
        status: issueData.status || 'active',
        workflow_status: issueData.workflow_status || 'reported',
        issue_metadata: issueData.issue_metadata || {},
        report_photo_urls: issueData.report_photo_urls || [],
        damage_assessment: issueData.damage_assessment,
        reported_by: user?.userId
      };

      // Optimistic update
      const tempIssue = {
        id: `temp-${Date.now()}`,
        ...insertData,
        reported_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      queryClient.setQueryData(queryKey, (prev: BaseIssue[] = []) => [tempIssue as BaseIssue, ...prev]);

      try {
        const data = await apiService.post(`/issues`, insertData);
        
        // Invalidate only the specific query that was affected
        queryClient.invalidateQueries({ queryKey });
        
        toast({
          title: "Issue reported",
          description: "The issue has been added successfully."
        });
        
        return data;
      } catch (error) {
        // Rollback on error
        queryClient.setQueryData(queryKey, (prev: BaseIssue[] = []) => prev.filter(i => i.id !== tempIssue.id));
        
        console.error('Error creating issue:', error);
        toast({
          title: "Error reporting issue",
          description: "Could not save the issue. Please try again.",
          variant: "destructive"
        });
        throw error;
      }
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ issueId, updates }: { issueId: string; updates: Partial<BaseIssue> }) => {
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

      return true;
    },
    onSuccess: () => {
      // Invalidate only the specific query that was affected
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (error) => {
      console.error('Error updating issue:', error);
      toast({
        title: "Error updating issue",
        description: "Could not update the issue. Please try again.",
        variant: "destructive"
      });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({
      issueId,
      resolutionData,
    }: {
      issueId: string;
      resolutionData?: {
        root_cause?: string;
        resolution_notes?: string;
        resolution_photo_urls?: string[];
      };
    }) => {
      return updateMutation.mutateAsync({
        issueId,
        updates: {
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          ...(resolutionData || {}),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (issueId: string) => {
      return updateMutation.mutateAsync({
        issueId,
        updates: { status: 'removed' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

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
      await createMutation.mutateAsync({
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

  return {
    issues: issuesQuery.data || [],
    isLoading: issuesQuery.isLoading,
    fetchIssues: () => issuesQuery.refetch(),
    createIssue: createMutation.mutateAsync,
    createIssuesFromText,
    updateIssue: (issueId: string, updates: Partial<BaseIssue>) => 
      updateMutation.mutateAsync({ issueId, updates }),
    resolveIssue: (
      issueId: string,
      resolutionData?: {
        root_cause?: string;
        resolution_notes?: string;
        resolution_photo_urls?: string[];
      }
    ) => resolveMutation.mutateAsync({ issueId, resolutionData }),
    removeIssue: (issueId: string) => removeMutation.mutateAsync(issueId),
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