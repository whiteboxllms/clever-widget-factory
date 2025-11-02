import type { Database } from '../../../../src/integrations/supabase/types.ts';

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function logToolInvocation(
  toolName: string,
  organizationId: string,
  userId?: string,
  params?: Record<string, any>,
  success: boolean = true,
  error?: string
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    tool: toolName,
    organization_id: organizationId,
    user_id: userId,
    success,
    error,
    params: params ? JSON.stringify(params) : undefined
  };
  
  console.log('MCP Tool Invocation:', JSON.stringify(logEntry));
}

export function createSuccessResponse(data: any) {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString()
  };
}

export function createErrorResponse(error: string, code?: string) {
  return {
    success: false,
    error,
    code,
    timestamp: new Date().toISOString()
  };
}

export function validateRequiredFields<T extends Record<string, any>>(
  data: T,
  requiredFields: (keyof T)[]
): { valid: boolean; missingFields?: string[] } {
  const missingFields = requiredFields.filter(field => 
    data[field] === undefined || data[field] === null || data[field] === ''
  );
  
  return {
    valid: missingFields.length === 0,
    missingFields: missingFields.length > 0 ? missingFields.map(f => String(f)) : undefined
  };
}

export function sanitizeForLogging(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const sanitized = { ...data };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'key', 'secret'];
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

export function buildSearchQuery(searchTerm: string): string {
  // Convert search term to PostgreSQL full-text search format
  return searchTerm
    .split(' ')
    .filter(term => term.length > 0)
    .map(term => `${term}:*`)
    .join(' & ');
}
