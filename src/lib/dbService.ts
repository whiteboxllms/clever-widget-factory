// Database service abstraction using API gateway
import { apiService } from './apiService';

// Supabase-compatible interface for easy migration
export const supabase = {
  from(table: string) {
    return {
      select(columns: string = '*') {
        return {
          async then(resolve: any) {
            try {
              let result;
              if (table === 'parts') {
                result = await apiService.getParts();
              } else if (table === 'actions') {
                result = await apiService.getActions();
              } else if (table === 'issues') {
                result = await apiService.getIssues();
              } else if (table === 'tools') {
                result = await apiService.getTools();
              } else if (table === 'checkouts') {
                result = await apiService.getCheckouts();
              } else {
                // Fallback to generic query for other tables
                result = await apiService.query(`SELECT ${columns} FROM ${table}`);
              }
              resolve({ data: result.data, error: null });
            } catch (error) {
              resolve({ data: null, error });
            }
          },
          
          in(column: string, values: any[]) {
            return {
              neq(column2: string, value2: any) {
                return {
                  async then(resolve: any) {
                    try {
                      const placeholders = values.map((_, i) => `$${i + 2}`).join(',');
                      const result = await apiService.query(
                        `SELECT ${columns} FROM ${table} WHERE ${column} IN (${placeholders}) AND ${column2} != $1`,
                        [value2, ...values]
                      );
                      resolve({ data: result.data, error: null });
                    } catch (error) {
                      resolve({ data: null, error });
                    }
                  }
                };
              },
              async then(resolve: any) {
                try {
                  const placeholders = values.map((_, i) => `$${i + 1}`).join(',');
                  const result = await apiService.query(
                    `SELECT ${columns} FROM ${table} WHERE ${column} IN (${placeholders})`,
                    values
                  );
                  resolve({ data: result.data, error: null });
                } catch (error) {
                  resolve({ data: null, error });
                }
              }
            };
          },
          
          neq(column: string, value: any) {
            return {
              order(orderColumn: string, options?: { ascending?: boolean }) {
                const direction = options?.ascending === false ? 'DESC' : 'ASC';
                return {
                  range(start: number, end: number) {
                    return {
                      async then(resolve: any) {
                        try {
                          const limit = end - start + 1;
                          let result;
                          if (table === 'tools') {
                            result = await apiService.getTools(limit, start);
                          } else if (table === 'parts') {
                            result = await apiService.getParts(limit, start);
                          } else {
                            result = await apiService.query(
                              `SELECT ${columns} FROM ${table} WHERE ${column} != $1 ORDER BY ${orderColumn} ${direction} LIMIT ${limit} OFFSET ${start}`,
                              [value]
                            );
                          }
                          resolve({ data: result.data, error: null });
                        } catch (error) {
                          resolve({ data: null, error });
                        }
                      }
                    };
                  },
                  async then(resolve: any) {
                    try {
                      const result = await apiService.query(
                        `SELECT ${columns} FROM ${table} WHERE ${column} != $1 ORDER BY ${orderColumn} ${direction}`,
                        [value]
                      );
                      resolve({ data: result.data, error: null });
                    } catch (error) {
                      resolve({ data: null, error });
                    }
                  }
                };
              },
              async then(resolve: any) {
                try {
                  const result = await apiService.query(
                    `SELECT ${columns} FROM ${table} WHERE ${column} != $1`,
                    [value]
                  );
                  resolve({ data: result.data, error: null });
                } catch (error) {
                  resolve({ data: null, error });
                }
              }
            };
          },
          
          eq(column: string, value: any) {
            return {
              eq(column2: string, value2: any) {
                return {
                  async then(resolve: any) {
                    try {
                      const result = await apiService.query(
                        `SELECT ${columns} FROM ${table} WHERE ${column} = $1 AND ${column2} = $2`,
                        [value, value2]
                      );
                      resolve({ data: result.data, error: null });
                    } catch (error) {
                      resolve({ data: null, error });
                    }
                  },
                  
                  async single() {
                    try {
                      const result = await apiService.query(
                        `SELECT ${columns} FROM ${table} WHERE ${column} = $1 AND ${column2} = $2 LIMIT 1`,
                        [value, value2]
                      );
                      return { data: result.data[0], error: null };
                    } catch (error) {
                      return { data: null, error };
                    }
                  }
                };
              },
              
              async then(resolve: any) {
                try {
                  const result = await apiService.query(
                    `SELECT ${columns} FROM ${table} WHERE ${column} = $1`,
                    [value]
                  );
                  resolve({ data: result.data, error: null });
                } catch (error) {
                  resolve({ data: null, error });
                }
              },
              
              async single() {
                try {
                  const result = await apiService.query(
                    `SELECT ${columns} FROM ${table} WHERE ${column} = $1 LIMIT 1`,
                    [value]
                  );
                  return { data: result.data[0], error: null };
                } catch (error) {
                  return { data: null, error };
                }
              }
            };
          },
          
          order(column: string, options?: { ascending?: boolean }) {
            const direction = options?.ascending === false ? 'DESC' : 'ASC';
            return {
              range(start: number, end: number) {
                return {
                  async then(resolve: any) {
                    try {
                      const limit = end - start + 1;
                      let result;
                      if (table === 'tools') {
                        result = await apiService.getTools(limit, start);
                      } else if (table === 'parts') {
                        result = await apiService.getParts(limit, start);
                      } else {
                        result = await apiService.query(
                          `SELECT ${columns} FROM ${table} ORDER BY ${column} ${direction} LIMIT ${limit} OFFSET ${start}`
                        );
                      }
                      resolve({ data: result.data, error: null });
                    } catch (error) {
                      resolve({ data: null, error });
                    }
                  }
                };
              },
              async then(resolve: any) {
                try {
                  const result = await apiService.query(
                    `SELECT ${columns} FROM ${table} ORDER BY ${column} ${direction}`
                  );
                  resolve({ data: result.data, error: null });
                } catch (error) {
                  resolve({ data: null, error });
                }
              }
            };
          }
        };
      },
      
      insert(data: any) {
        return {
          async then(resolve: any) {
            try {
              const columns = Object.keys(data).join(', ');
              const placeholders = Object.keys(data).map((_, i) => `$${i + 1}`).join(', ');
              const values = Object.values(data);
              
              const result = await apiService.query(
                `INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`,
                values
              );
              resolve({ data: result.data, error: null });
            } catch (error) {
              resolve({ data: null, error });
            }
          }
        };
      },
      
      update(data: any) {
        return {
          eq(column: string, value: any) {
            return {
              async then(resolve: any) {
                try {
                  const setClause = Object.keys(data).map((key, i) => `${key} = $${i + 2}`).join(', ');
                  const values = [value, ...Object.values(data)];
                  
                  const result = await apiService.query(
                    `UPDATE ${table} SET ${setClause} WHERE ${column} = $1 RETURNING *`,
                    values
                  );
                  resolve({ data: result.data, error: null });
                } catch (error) {
                  resolve({ data: null, error });
                }
              }
            };
          }
        };
      }
    };
  }
};

// Legacy export for compatibility
export { supabase as default };
export const db = supabase;
