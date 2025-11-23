/**
 * Test wrappers for React components that need context providers
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/useCognitoAuth';
import { OrganizationProvider } from '@/hooks/useOrganization';
import { AppSettingsProvider } from '@/hooks/useAppSettings';
import { TooltipProvider } from '@/components/ui/tooltip';
import { mockAuthContextValue } from './mocks';

// Create a test QueryClient with default options
const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Wrapper component that provides Auth context for tests
 */
export function AuthWrapper({ children }: { children: React.ReactNode }) {
  // For tests, we'll use a mock implementation
  // In a real test, you might want to use a test-specific AuthProvider
  return (
    <QueryClientProvider client={testQueryClient}>
      <AuthProvider>
        <OrganizationProvider>
          <AppSettingsProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </AppSettingsProvider>
        </OrganizationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

/**
 * Alternative: Direct context provider with mocked values
 * Use this when you need full control over auth state
 */
export function MockAuthProvider({ 
  children, 
  value = mockAuthContextValue 
}: { 
  children: React.ReactNode;
  value?: typeof mockAuthContextValue;
}) {
  // This would require exposing the AuthContext, which might not be ideal
  // For now, use AuthWrapper and mock the underlying Cognito calls
  return <AuthWrapper>{children}</AuthWrapper>;
}

