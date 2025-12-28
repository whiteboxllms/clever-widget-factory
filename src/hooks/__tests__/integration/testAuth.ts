/**
 * Test Authentication Service
 * 
 * Provides authentication for integration tests using test user credentials
 */

import { Amplify } from 'aws-amplify';
import { signIn, signOut, fetchAuthSession } from 'aws-amplify/auth';

export interface TestAuthConfig {
  username: string;
  password: string;
  userPoolId: string;
  userPoolClientId: string;
  region: string;
}

// Test user credentials - these should be environment variables in production
const defaultTestAuthConfig: TestAuthConfig = {
  username: process.env.INTEGRATION_TEST_USERNAME || 'integration-test-user',
  password: process.env.INTEGRATION_TEST_PASSWORD || 'TempPassword123!',
  userPoolId: process.env.VITE_AWS_COGNITO_USER_POOL_ID || '',
  userPoolClientId: process.env.VITE_AWS_COGNITO_CLIENT_ID || '',
  region: process.env.VITE_AWS_REGION || 'us-west-2'
};

export class TestAuthService {
  private config: TestAuthConfig;
  private isConfigured: boolean = false;
  private isAuthenticated: boolean = false;

  constructor(config: TestAuthConfig = defaultTestAuthConfig) {
    this.config = config;
  }

  /**
   * Configure Amplify for testing
   */
  async configureAmplify(): Promise<void> {
    if (this.isConfigured) return;

    try {
      Amplify.configure({
        Auth: {
          Cognito: {
            userPoolId: this.config.userPoolId,
            userPoolClientId: this.config.userPoolClientId,
            loginWith: {
              email: true,
            },
          }
        }
      });

      this.isConfigured = true;
      console.log('✅ Amplify configured for integration tests');
    } catch (error) {
      console.error('❌ Failed to configure Amplify:', error);
      throw new Error(`Failed to configure Amplify: ${error}`);
    }
  }

  /**
   * Sign in the test user
   */
  async signInTestUser(): Promise<void> {
    if (this.isAuthenticated) return;

    try {
      await this.configureAmplify();

      console.log(`🔐 Signing in test user: ${this.config.username}`);
      console.log(`🔐 Debug - Environment variables:`);
      console.log(`   INTEGRATION_TEST_USERNAME: ${process.env.INTEGRATION_TEST_USERNAME}`);
      console.log(`   Config username: ${this.config.username}`);
      
      const signInResult = await signIn({
        username: this.config.username,
        password: this.config.password
      });

      if (signInResult.isSignedIn) {
        this.isAuthenticated = true;
        console.log('✅ Test user signed in successfully');
      } else {
        throw new Error('Sign in did not complete successfully');
      }
    } catch (error) {
      console.error('❌ Failed to sign in test user:', error);
      throw new Error(`Failed to sign in test user: ${error}`);
    }
  }

  /**
   * Get current auth session for API calls
   */
  async getAuthSession(): Promise<any> {
    if (!this.isAuthenticated) {
      await this.signInTestUser();
    }

    try {
      const session = await fetchAuthSession({ forceRefresh: false });
      return session;
    } catch (error) {
      console.error('❌ Failed to get auth session:', error);
      throw new Error(`Failed to get auth session: ${error}`);
    }
  }

  /**
   * Get ID token for API authorization
   */
  async getIdToken(): Promise<string> {
    const session = await this.getAuthSession();
    const idToken = session.tokens?.idToken?.toString();
    
    if (!idToken) {
      throw new Error('No ID token available');
    }

    return idToken;
  }

  /**
   * Sign out the test user
   */
  async signOutTestUser(): Promise<void> {
    if (!this.isAuthenticated) return;

    try {
      await signOut();
      this.isAuthenticated = false;
      console.log('✅ Test user signed out');
    } catch (error) {
      console.error('❌ Failed to sign out test user:', error);
      // Don't throw here, cleanup should be best effort
    }
  }

  /**
   * Check if test user credentials are configured
   */
  isConfigurationValid(): boolean {
    return !!(
      this.config.username &&
      this.config.password &&
      this.config.userPoolId &&
      this.config.userPoolClientId &&
      this.config.region
    );
  }

  /**
   * Get configuration status for debugging
   */
  getConfigurationStatus(): any {
    return {
      hasUsername: !!this.config.username,
      hasPassword: !!this.config.password,
      hasUserPoolId: !!this.config.userPoolId,
      hasUserPoolClientId: !!this.config.userPoolClientId,
      hasRegion: !!this.config.region,
      isConfigured: this.isConfigured,
      isAuthenticated: this.isAuthenticated
    };
  }
}

// Global test auth service instance
export const testAuthService = new TestAuthService();

/**
 * Setup test authentication for integration tests
 */
export async function setupTestAuth(): Promise<void> {
  if (!testAuthService.isConfigurationValid()) {
    const status = testAuthService.getConfigurationStatus();
    console.error('❌ Test authentication not properly configured:', status);
    throw new Error('Test authentication configuration incomplete. Check environment variables.');
  }

  await testAuthService.signInTestUser();
}

/**
 * Cleanup test authentication
 */
export async function cleanupTestAuth(): Promise<void> {
  await testAuthService.signOutTestUser();
}

/**
 * Create an authenticated API service for testing
 */
export function createAuthenticatedApiService() {
  // For now, return a simple mock that doesn't override the actual apiService
  // This avoids the module import issues while still providing the interface
  return {
    restore: () => {
      // No-op for now
    }
  };
}