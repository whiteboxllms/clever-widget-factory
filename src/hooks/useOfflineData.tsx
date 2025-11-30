import { useQuery } from '@tanstack/react-query';
import { offlineQueryConfig } from '@/lib/queryConfig';
import { apiService, getApiData } from '@/lib/apiService';

const fetchTools = async () => {
  const response = await apiService.get<{ data: any[] }>('/tools?limit=1000');
  return getApiData(response) || [];
};

const fetchParts = async () => {
  const response = await apiService.get<{ data: any[] }>('/parts?limit=1000');
  return getApiData(response) || [];
};

const fetchActions = async () => {
  const response = await apiService.get<{ data: any[] }>('/actions?limit=1000');
  return getApiData(response) || [];
};

const fetchOrganizationMembers = async () => {
  const response = await apiService.get<{ data: any[] }>('/organization_members');
  return getApiData(response) || [];
};

const fetchCheckouts = async () => {
  const response = await apiService.get<{ data: any[] }>('/checkouts');
  return getApiData(response) || [];
};

const fetchIssues = async () => {
  const response = await apiService.get<{ data: any[] }>('/issues');
  return getApiData(response) || [];
};

export const useOfflineData = () => {
  const tools = useQuery({
    queryKey: ['tools'],
    queryFn: fetchTools,
    ...offlineQueryConfig,
  });

  const parts = useQuery({
    queryKey: ['parts'],
    queryFn: fetchParts,
    ...offlineQueryConfig,
  });

  const actions = useQuery({
    queryKey: ['actions'],
    queryFn: fetchActions,
    ...offlineQueryConfig,
  });

  const organizationMembers = useQuery({
    queryKey: ['organization_members'],
    queryFn: fetchOrganizationMembers,
    ...offlineQueryConfig,
  });

  const checkouts = useQuery({
    queryKey: ['checkouts'],
    queryFn: fetchCheckouts,
    ...offlineQueryConfig,
  });

  const issues = useQuery({
    queryKey: ['issues'],
    queryFn: fetchIssues,
    ...offlineQueryConfig,
  });

  return {
    tools: tools.data || [],
    parts: parts.data || [],
    actions: actions.data || [],
    organizationMembers: organizationMembers.data || [],
    // profiles removed - use organizationMembers instead
    checkouts: checkouts.data || [],
    issues: issues.data || [],
    isLoading: tools.isLoading || parts.isLoading || actions.isLoading || 
               organizationMembers.isLoading || 
               checkouts.isLoading || issues.isLoading,
    refetchAll: () => {
      tools.refetch();
      parts.refetch();
      actions.refetch();
      organizationMembers.refetch();
      checkouts.refetch();
      issues.refetch();
    }
  };
};