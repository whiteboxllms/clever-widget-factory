// Clean auth service that mimics Supabase auth API
import { signIn, signUp, signOut, getCurrentUser, fetchAuthSession, resetPassword } from 'aws-amplify/auth';

interface AuthUser {
  id: string;
  email?: string;
  user_metadata?: any;
}

interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

class AuthService {
  async getUser(): Promise<{ data: { user: AuthUser | null }; error: any }> {
    try {
      const user = await getCurrentUser();
      return {
        data: {
          user: {
            id: user.userId,
            email: user.signInDetails?.loginId,
            user_metadata: {}
          }
        },
        error: null
      };
    } catch (error) {
      return { data: { user: null }, error };
    }
  }

  async getSession(): Promise<{ data: { session: AuthSession | null }; error: any }> {
    try {
      const session = await fetchAuthSession();
      const user = await getCurrentUser();
      
      if (session.tokens) {
        return {
          data: {
            session: {
              access_token: session.tokens.accessToken.toString(),
              refresh_token: session.tokens.refreshToken?.toString() || '',
              user: {
                id: user.userId,
                email: user.signInDetails?.loginId,
                user_metadata: {}
              }
            }
          },
          error: null
        };
      }
      
      return { data: { session: null }, error: null };
    } catch (error) {
      return { data: { session: null }, error };
    }
  }

  async signInWithPassword(credentials: { email: string; password: string }) {
    try {
      await signIn({ username: credentials.email, password: credentials.password });
      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  async signUp(credentials: { email: string; password: string }) {
    try {
      await signUp({ username: credentials.email, password: credentials.password });
      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  async signOut() {
    try {
      await signOut();
      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  async resetPasswordForEmail(email: string) {
    try {
      await resetPassword({ username: email });
      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  onAuthStateChange(callback: (event: string, session: any) => void) {
    // Implement auth state change listener
    // This would need to be implemented based on your Cognito setup
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
}

export const auth = new AuthService();
