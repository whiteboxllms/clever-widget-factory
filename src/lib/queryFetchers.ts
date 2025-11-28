import { apiService, getApiData } from '@/lib/apiService';

export async function fetchOrganizationMembers() {
  const response = await apiService.get('/organization_members');
  return getApiData(response) || [];
}

export async function fetchActions() {
  const response = await apiService.get('/actions');
  return getApiData(response) || [];
}

export async function fetchActionScores(params?: { startDate?: string; endDate?: string }) {
  const queryParams: Record<string, string> = {};
  if (params?.startDate) {
    queryParams.start_date = params.startDate;
  }
  if (params?.endDate) {
    queryParams.end_date = params.endDate;
  }

  const response = await apiService.get('/action_scores', {
    params: queryParams,
  });
  return getApiData(response) || [];
}

