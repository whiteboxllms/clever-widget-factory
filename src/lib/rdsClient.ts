// Direct RDS PostgreSQL connection via API Gateway
// Production-ready API endpoints with monitoring and logging

const API_GATEWAY_BASE_URL = 'https://0720au267k.execute-api.us-west-2.amazonaws.com/dev/api';

class RDSClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_GATEWAY_BASE_URL;
  }

  async query(sql: string, params: any[] = []): Promise<any> {
    const response = await fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    });

    if (!response.ok) {
      throw new Error(`Query failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Actions API
  async getActions(filters: { assigned_to?: string; status?: string; limit?: number; offset?: number } = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) params.append(key, value.toString());
    });

    const response = await fetch(`${this.baseUrl}/actions?${params}`);
    if (!response.ok) throw new Error('Failed to fetch actions');
    return response.json();
  }

  async getMyActions(cognitoUserId: string) {
    const response = await fetch(`${this.baseUrl}/actions/my-actions?cognitoUserId=${cognitoUserId}`);
    if (!response.ok) throw new Error('Failed to fetch my actions');
    return response.json();
  }

  // Organization Members API
  async getOrganizationMembers(organizationId?: string) {
    const params = organizationId ? `?organization_id=${organizationId}` : '';
    const response = await fetch(`${this.baseUrl}/organization_members${params}`);
    if (!response.ok) throw new Error('Failed to fetch organization members');
    return response.json();
  }

  // Action Implementation Updates API
  async getActionUpdates(actionId: string) {
    const response = await fetch(`${this.baseUrl}/action_implementation_updates?action_id=${actionId}`);
    if (!response.ok) throw new Error('Failed to fetch action updates');
    return response.json();
  }

  // Parts API
  async getParts() {
    const response = await fetch(`${this.baseUrl}/parts`);
    if (!response.ok) throw new Error('Failed to fetch parts');
    return response.json();
  }

  // Tools API
  async getTools() {
    const response = await fetch(`${this.baseUrl}/tools`);
    if (!response.ok) throw new Error('Failed to fetch tools');
    return response.json();
  }
}

export const rdsClient = new RDSClient();
export default rdsClient;
