import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthValidationResult {
  isValid: boolean;
  session: Session | null;
  user: User | null;
  error?: string;
}

/**
 * Validates the current session and refreshes if needed
 * This should be called before any authenticated operations
 */
export async function validateAndRefreshSession(): Promise<AuthValidationResult> {
  try {
    // First, try to get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Session validation error:', sessionError);
      return {
        isValid: false,
        session: null,
        user: null,
        error: 'Session validation failed'
      };
    }

    if (!session) {
      return {
        isValid: false,
        session: null,
        user: null,
        error: 'No active session found'
      };
    }

    // Check if the session is expired or about to expire (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = session.expires_at || 0;
    const isExpiringSoon = (expiresAt - now) < 300; // 5 minutes

    if (isExpiringSoon) {
      console.log('Session expiring soon, refreshing...');
      
      // Try to refresh the session
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshedSession) {
        console.error('Session refresh failed:', refreshError);
        return {
          isValid: false,
          session: null,
          user: null,
          error: 'Session refresh failed - please log in again'
        };
      }

      return {
        isValid: true,
        session: refreshedSession,
        user: refreshedSession.user,
      };
    }

    // Session is valid and not expiring soon
    return {
      isValid: true,
      session,
      user: session.user,
    };

  } catch (error) {
    console.error('Session validation unexpected error:', error);
    return {
      isValid: false,
      session: null,
      user: null,
      error: 'Unexpected authentication error'
    };
  }
}

/**
 * Wrapper for authenticated database operations
 * Automatically validates session before executing the operation
 */
export async function withAuth<T>(
  operation: (session: Session) => Promise<T>,
  operationName: string = 'database operation'
): Promise<{ data: T | null; error: string | null }> {
  const validation = await validateAndRefreshSession();
  
  if (!validation.isValid || !validation.session) {
    console.error(`Authentication failed for ${operationName}:`, validation.error);
    return {
      data: null,
      error: validation.error || 'Authentication required'
    };
  }

  try {
    const result = await operation(validation.session);
    return { data: result, error: null };
  } catch (error) {
    console.error(`Error in ${operationName}:`, error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Operation failed'
    };
  }
}

/**
 * Checks if user has specific role
 * Uses the validated session to ensure auth context is correct
 */
export async function checkUserRole(requiredRole: string): Promise<{ hasRole: boolean; error?: string }> {
  const validation = await validateAndRefreshSession();
  
  if (!validation.isValid || !validation.session) {
    return { hasRole: false, error: validation.error };
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', validation.session.user.id)
      .single();

    if (error) {
      console.error('Role check error:', error);
      return { hasRole: false, error: 'Failed to verify user role' };
    }

    return { hasRole: profile?.role === requiredRole };
  } catch (error) {
    console.error('Role check unexpected error:', error);
    return { hasRole: false, error: 'Unexpected error checking role' };
  }
}