import { useQuery } from '@tanstack/react-query';
import { offlineQueryConfig } from '@/lib/queryConfig';

const fetchTools = async () => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/tools?limit=1000`);
  const result = await response.json();
  return result.data || [];
};

const fetchParts = async () => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/parts?limit=1000`);
  const result = await response.json();
  return result.data || [];
};

const fetchActions = async () => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/actions?limit=1000`);
  const result = await response.json();
  return result.data || [];
};

const fetchOrganizationMembers = async () => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/organization_members`);
  const result = await response.json();
  return result.data || [];
};

const fetchProfiles = async () => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/profiles`);
  const result = await response.json();
  return result.data || [];
};

const fetchCheckouts = async () => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/checkouts`);
  const result = await response.json();
  return result.data || [];
};

const fetchIssues = async () => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/issues`);
  const result = await response.json();
  return result.data || [];
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

  const profiles = useQuery({
    queryKey: ['profiles'],
    queryFn: fetchProfiles,
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
    profiles: profiles.data || [],
    checkouts: checkouts.data || [],
    issues: issues.data || [],
    isLoading: tools.isLoading || parts.isLoading || actions.isLoading || 
               organizationMembers.isLoading || profiles.isLoading || 
               checkouts.isLoading || issues.isLoading,
    refetchAll: () => {
      tools.refetch();
      parts.refetch();
      actions.refetch();
      organizationMembers.refetch();
      profiles.refetch();
      checkouts.refetch();
      issues.refetch();
    }
  };
};