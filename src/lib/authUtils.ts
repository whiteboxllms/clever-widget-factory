// This file has been migrated to use Cognito authentication
// The functionality is now handled by useCognitoAuth hook

export interface AuthValidationResult {
  isValid: boolean;
  session: any | null;
  user: any | null;
  error?: string;
}

/**
 * Legacy function - now handled by Cognito
 * @deprecated Use useCognitoAuth hook instead
 */
export async function validateAndRefreshSession(): Promise<AuthValidationResult> {
  console.warn('validateAndRefreshSession is deprecated - use useCognitoAuth hook instead');
  return {
    isValid: false,
    session: null,
    user: null,
    error: 'Use Cognito authentication instead'
  };
}

/**
 * Legacy function - now handled by Cognito
 * @deprecated Use useCognitoAuth hook instead
 */
export async function withAuth<T>(
  operation: (session: any) => Promise<T>,
  operationName: string = 'database operation'
): Promise<{ data: T | null; error: string | null }> {
  console.warn('withAuth is deprecated - use useCognitoAuth hook instead');
  return {
    data: null,
    error: 'Use Cognito authentication instead'
  };
}

/**
 * Legacy function - now handled by Cognito
 * @deprecated Use useCognitoAuth hook instead
 */
export async function checkUserRole(requiredRole: string): Promise<{ hasRole: boolean; error?: string }> {
  console.warn('checkUserRole is deprecated - use useCognitoAuth hook instead');
  return { hasRole: false, error: 'Use Cognito authentication instead' };
}