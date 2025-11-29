/**
 * @deprecated This file is deprecated. Supabase has been replaced with AWS services.
 * 
 * - For authentication: Use @/hooks/useCognitoAuth
 * - For API calls: Use @/services/apiService
 * - For database operations: Use API Gateway endpoints via apiService
 * 
 * This file is kept temporarily for backwards compatibility but will be removed.
 */

// Throw error if anyone tries to use the old Supabase client
export const supabase = new Proxy({}, {
  get() {
    throw new Error(
      'Supabase client is no longer available. Use AWS Cognito (useCognitoAuth) for auth and apiService for API calls.'
    );
  }
});

export { supabase as client };
