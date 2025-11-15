// Complete API service to replace Supabase client
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

interface QueryOptions {
  select?: string;
  where?: Record<string, any>;
  order?: string;
  limit?: number;
  offset?: number;
}

class ApiService {
  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.statusText} - ${error}`);
    }

    return response.json();
  }

  private buildQuery(options: QueryOptions = {}): string {
    const params = new URLSearchParams();
    if (options.select) params.set('select', options.select);
    if (options.where) params.set('where', JSON.stringify(options.where));
    if (options.order) params.set('order', options.order);
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.offset) params.set('offset', options.offset.toString());
    return params.toString() ? `?${params.toString()}` : '';
  }

  // Generic CRUD operations
  async select(table: string, options: QueryOptions = {}) {
    return this.request(`/${table}${this.buildQuery(options)}`);
  }

  async insert(table: string, data: any) {
    return this.request(`/${table}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async update(table: string, id: string, data: any) {
    return this.request(`/${table}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(table: string, id: string) {
    return this.request(`/${table}/${id}`, {
      method: 'DELETE',
    });
  }

  async search(table: string, searchTerm: string, options: QueryOptions = {}) {
    const params = new URLSearchParams();
    params.set('search', searchTerm);
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.offset) params.set('offset', options.offset.toString());
    return this.request(`/${table}/search?${params.toString()}`);
  }

  // Legacy specific methods (for backward compatibility)
  async getParts(limit?: number, offset?: number) {
    return this.select('parts', { limit, offset });
  }

  async getTools(limit?: number, offset?: number, showRemovedItems?: boolean) {
    const where = showRemovedItems ? {} : { status: { op: 'neq', value: 'removed' } };
    return this.select('tools', { limit, offset, where });
  }

  async getCheckouts() {
    return this.select('checkouts', { where: { is_returned: { op: 'eq', value: false } } });
  }

  async getIssues(params: { context_type?: string; status?: string } = {}) {
    const where: any = {};
    if (params.context_type) where.context_type = { op: 'eq', value: params.context_type };
    if (params.status) where.status = { op: 'eq', value: params.status };
    return this.select('issues', { where });
  }

  async getActions() {
    return this.select('actions');
  }

  async searchTools(searchTerm: string, options: { 
    limit: number; 
    offset: number; 
    includeDescriptions?: boolean; 
    showRemovedItems?: boolean 
  }) {
    return this.search('tools', searchTerm, options);
  }

  async searchParts(searchTerm: string, options: { 
    limit: number; 
    offset: number; 
    includeDescriptions?: boolean; 
  }) {
    return this.search('parts', searchTerm, options);
  }

  // Generic query
  async query(sql: string, params: any[] = []) {
    return this.request('/query', {
      method: 'POST',
      body: JSON.stringify({ sql, params }),
    });
  }
}

export const apiService = new ApiService();
