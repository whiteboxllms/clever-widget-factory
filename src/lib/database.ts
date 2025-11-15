// Clean database client that mimics Supabase API
import { apiService } from './apiService';

interface QueryBuilder {
  select(columns?: string): QueryBuilder;
  insert(data: any): Promise<{ data: any; error: any }>;
  update(data: any): Promise<{ data: any; error: any }>;
  delete(): Promise<{ data: any; error: any }>;
  eq(column: string, value: any): QueryBuilder;
  neq(column: string, value: any): QueryBuilder;
  in(column: string, values: any[]): QueryBuilder;
  or(conditions: string): QueryBuilder;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder;
  range(start: number, end: number): QueryBuilder;
  single(): Promise<{ data: any; error: any }>;
}

class DatabaseQueryBuilder implements QueryBuilder {
  private table: string;
  private selectColumns: string = '*';
  private whereConditions: Record<string, any> = {};
  private orConditions: string = '';
  private orderBy: string = '';
  private limitValue?: number;
  private offsetValue?: number;
  private rangeStart?: number;
  private rangeEnd?: number;

  constructor(table: string) {
    this.table = table;
  }

  select(columns: string = '*'): QueryBuilder {
    this.selectColumns = columns;
    return this;
  }

  eq(column: string, value: any): QueryBuilder {
    this.whereConditions[column] = { op: 'eq', value };
    return this;
  }

  neq(column: string, value: any): QueryBuilder {
    this.whereConditions[column] = { op: 'neq', value };
    return this;
  }

  in(column: string, values: any[]): QueryBuilder {
    this.whereConditions[column] = { op: 'in', value: values };
    return this;
  }

  or(conditions: string): QueryBuilder {
    this.orConditions = conditions;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): QueryBuilder {
    const direction = options?.ascending === false ? 'desc' : 'asc';
    this.orderBy = `${column}:${direction}`;
    return this;
  }

  range(start: number, end: number): QueryBuilder {
    this.rangeStart = start;
    this.rangeEnd = end;
    this.limitValue = end - start + 1;
    this.offsetValue = start;
    return this;
  }

  async single(): Promise<{ data: any; error: any }> {
    try {
      const result = await this.execute();
      return { 
        data: result.data?.[0] || null, 
        error: result.data?.length === 0 ? new Error('No rows found') : null 
      };
    } catch (error) {
      return { data: null, error };
    }
  }

  async insert(data: any): Promise<{ data: any; error: any }> {
    try {
      const result = await apiService.insert(this.table, data);
      return { data: result.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async update(data: any): Promise<{ data: any; error: any }> {
    try {
      // For updates, we need to handle the where conditions
      const result = await apiService.update(this.table, 'bulk', { 
        data, 
        where: this.whereConditions 
      });
      return { data: result.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async delete(): Promise<{ data: any; error: any }> {
    try {
      const result = await apiService.delete(this.table, 'bulk');
      return { data: result.data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  private async execute(): Promise<{ data: any; error: any }> {
    try {
      let result;
      
      if (this.orConditions) {
        // Handle search with OR conditions - fallback to client-side search
        const searchTerm = this.extractSearchTerm(this.orConditions);
        try {
          result = await apiService.search(this.table, searchTerm, {
            select: this.selectColumns,
            limit: this.limitValue,
            offset: this.offsetValue,
            order: this.orderBy
          });
        } catch (error) {
          if (error.message.includes('Cannot GET')) {
            // Fallback: get all data and filter client-side
            const allData = await apiService.select(this.table, {
              select: this.selectColumns,
              order: this.orderBy
            });
            
            const filtered = this.clientSideSearch(allData.data || [], searchTerm);
            const start = this.offsetValue || 0;
            const end = start + (this.limitValue || filtered.length);
            
            result = { data: filtered.slice(start, end) };
          } else {
            throw error;
          }
        }
      } else {
        result = await apiService.select(this.table, {
          select: this.selectColumns,
          where: this.whereConditions,
          order: this.orderBy,
          limit: this.limitValue,
          offset: this.offsetValue
        });
      }
      
      return { data: result.data, error: null };
    } catch (error) {
      // Return empty data for missing endpoints instead of throwing
      if (error.message.includes('Cannot GET')) {
        console.warn(`Endpoint not found for table: ${this.table}, returning empty data`);
        return { data: [], error: null };
      }
      return { data: null, error };
    }
  }

  private clientSideSearch(data: any[], searchTerm: string): any[] {
    const term = searchTerm.toLowerCase();
    return data.filter(item => 
      Object.values(item).some(value => 
        value && String(value).toLowerCase().includes(term)
      )
    );
  }

  private extractSearchTerm(orConditions: string): string {
    // Extract search term from OR conditions like "name.ilike.%term%"
    const match = orConditions.match(/\.ilike\.%(.+?)%/);
    return match ? match[1] : '';
  }

  // Make the query builder thenable for backward compatibility
  then(resolve: (value: { data: any; error: any }) => void) {
    return this.execute().then(resolve);
  }
}

export const database = {
  from(table: string): QueryBuilder {
    return new DatabaseQueryBuilder(table);
  }
};
