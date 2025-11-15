// Offline-first database client
import { offlineClient } from './offlineClient';

interface QueryBuilder {
  select(columns?: string): QueryBuilder;
  insert(data: any): Promise<{ data: any; error: any }>;
  update(data: any): Promise<{ data: any; error: any }>;
  delete(): Promise<{ data: any; error: any }>;
  eq(column: string, value: any): QueryBuilder;
  neq(column: string, value: any): QueryBuilder;
  not(column: string, operator: string, value: any): QueryBuilder;
  in(column: string, values: any[]): QueryBuilder;
  or(conditions: string): QueryBuilder;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder;
  range(start: number, end: number): QueryBuilder;
  single(): Promise<{ data: any; error: any }>;
  maybeSingle(): Promise<{ data: any; error: any }>;
}

class DatabaseQueryBuilder implements QueryBuilder {
  private table: string;
  private selectColumns: string = '*';
  private whereConditions: Record<string, any> = {};
  private orConditions: string = '';
  private orderBy: string = '';
  private limitValue?: number;
  private offsetValue?: number;

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

  not(column: string, operator: string, value: any): QueryBuilder {
    this.whereConditions[column] = { op: 'not', operator, value };
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

  async maybeSingle(): Promise<{ data: any; error: any }> {
    try {
      // Set limit to 1 for single record query
      this.limitValue = 1;
      const result = await this.execute();
      return { 
        data: result.data?.[0] || null, 
        error: null  // maybeSingle never returns error for no results
      };
    } catch (error) {
      return { data: null, error };
    }
  }

  async insert(data: any): Promise<{ data: any; error: any }> {
    return offlineClient.create(this.table, data);
  }

  async update(data: any): Promise<{ data: any; error: any }> {
    // For updates, we need the ID from where conditions
    const id = this.whereConditions.id?.value;
    if (!id) {
      return { data: null, error: new Error('Update requires ID') };
    }
    return offlineClient.update(this.table, id, data);
  }

  async delete(): Promise<{ data: any; error: any }> {
    // Implementation for delete operations
    return { data: null, error: new Error('Delete not implemented yet') };
  }

  private async execute(): Promise<{ data: any; error: any }> {
    const options = {
      select: this.selectColumns,
      where: this.whereConditions,
      order: this.orderBy,
      limit: this.limitValue,
      offset: this.offsetValue
    };

    return offlineClient.get(this.table, options);
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
