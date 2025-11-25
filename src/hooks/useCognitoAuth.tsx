import { createContext, useContext, useEffect, useState } from 'react';
import { Amplify } from 'aws-amplify';
import { signIn, signUp, signOut, getCurrentUser, fetchAuthSession, resetPassword, confirmResetPassword, confirmSignIn } from 'aws-amplify/auth';

// Configure Amplify
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_AWS_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_AWS_COGNITO_CLIENT_ID,
      loginWith: {
        email: true,
      },
    },
  },
});

interface User {
  id: string;
  userId: string;
  username: string;
  email?: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  session: any | null;
  idToken: string | null; // Cognito ID token for API requests
  loading: boolean;
  isAdmin: boolean;
  isContributor: boolean;
  isLeadership: boolean;
  canEditTools: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  confirmSignIn: (newPassword: string) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  confirmResetPassword: (email: string, code: string, newPassword: string) => Promise<{ error: any }>;
  updatePassword: (password: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isContributor, setIsContributor] = useState(false);
  const [isLeadership, setIsLeadership] = useState(false);
  const [canEditTools, setCanEditTools] = useState(false);

  const checkUserRole = async (userId: string) => {
    try {
      // TODO: Replace with actual database query to organization_members table
      // For now, set admin role for testing
      console.log('Setting admin role for user:', userId);
      setIsAdmin(true);
      setIsContributor(true);
      setIsLeadership(true);
      setCanEditTools(true);
    } catch (error) {
      console.error('Failed to check user role:', error);
    }
  };

  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const currentUser = await getCurrentUser();
        const session = await fetchAuthSession();
        
        // Fetch user's full name from profiles table (the correct source)
        let fullName: string | undefined = undefined;
        try {
          // Get ID token from session for authenticated request
          const idToken = session.tokens?.idToken?.toString();
          const headers: HeadersInit = { 'Content-Type': 'application/json' };
          if (idToken) {
            headers['Authorization'] = `Bearer ${idToken}`;
          }
          
          // Use profiles endpoint instead of organization_members
          // Profiles is the correct source for user display names
          const response = await fetch(
            `${import.meta.env.VITE_API_BASE_URL}/profiles?user_id=${currentUser.userId}`,
            { headers }
          );
          if (response.ok) {
            const result = await response.json();
            const profiles = Array.isArray(result) ? result : (result?.data || []);
            const profile = profiles[0]; // Get first profile
            if (profile?.full_name) {
              fullName = profile.full_name;
            }
          }
        } catch (error) {
          console.warn('Could not fetch user full name from profiles:', error);
        }
        
        // Use email as username if available, otherwise use Cognito username
        const email = currentUser.signInDetails?.loginId || currentUser.username;
        const username = email.includes('@') ? email : currentUser.username;
        
        const userData: User = {
          id: currentUser.userId,
          userId: currentUser.userId,
          username: username,
          email: email,
          name: fullName || email || currentUser.username
        };
        
        setUser(userData);
        setSession(session);
        await checkUserRole(currentUser.userId);
      } catch (error) {
        setUser(null);
        setSession(null);
        setIdToken(null);
        setIsAdmin(false);
        setIsContributor(false);
        setIsLeadership(false);
        setCanEditTools(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuthState();
  }, []);

  const handleSignUp = async (email: string, password: string, fullName: string) => {
    try {
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            name: fullName,
          },
        },
      });
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const handleSignIn = async (email: string, password: string) => {
    try {
      const result = await signIn({ username: email, password });
      
      if (result.isSignedIn) {
        const currentUser = await getCurrentUser();
        const session = await fetchAuthSession();
        
        // Fetch user's full name from profiles table (the correct source)
        let fullName: string | undefined = undefined;
        try {
          // Get ID token from session for authenticated request
          const idToken = session.tokens?.idToken?.toString();
          const headers: HeadersInit = { 'Content-Type': 'application/json' };
          if (idToken) {
            headers['Authorization'] = `Bearer ${idToken}`;
          }
          
          // Use profiles endpoint instead of organization_members
          // Profiles is the correct source for user display names
          const response = await fetch(
            `${import.meta.env.VITE_API_BASE_URL}/profiles?user_id=${currentUser.userId}`,
            { headers }
          );
          if (response.ok) {
            const result = await response.json();
            const profiles = Array.isArray(result) ? result : (result?.data || []);
            const profile = profiles[0]; // Get first profile
            if (profile?.full_name) {
              fullName = profile.full_name;
            }
          }
        } catch (error) {
          console.warn('Could not fetch user full name from profiles:', error);
        }
        
        // Use email as username if available, otherwise use Cognito username
        const emailValue = currentUser.signInDetails?.loginId || currentUser.username;
        const username = emailValue.includes('@') ? emailValue : currentUser.username;
        
        const userData: User = {
          id: currentUser.userId,
          userId: currentUser.userId,
          username: username,
          email: emailValue,
          name: fullName || emailValue || currentUser.username
        };
        
        setUser(userData);
        setSession(session);
        await checkUserRole(currentUser.userId);
      } else if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        // Return a specific error for password change requirement
        return { error: { message: 'Password change required', code: 'NEW_PASSWORD_REQUIRED' } };
      }
      
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const handleConfirmSignIn = async (newPassword: string) => {
    try {
      const result = await confirmSignIn({ challengeResponse: newPassword });
      
      if (result.isSignedIn) {
        const currentUser = await getCurrentUser();
        const session = await fetchAuthSession();
        
        const userData: User = {
          id: currentUser.userId,
          userId: currentUser.userId,
          username: currentUser.username,
          email: currentUser.signInDetails?.loginId,
          name: currentUser.username
        };
        
        setUser(userData);
        setSession(session);
        await checkUserRole(currentUser.userId);
      }
      
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      setIsContributor(false);
      setIsLeadership(false);
      setCanEditTools(false);
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      await resetPassword({ username: email });
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const handleConfirmResetPassword = async (email: string, code: string, newPassword: string) => {
    try {
      await confirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword: newPassword,
      });
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  const handleUpdatePassword = async (password: string) => {
    try {
      await confirmResetPassword({
        username: user?.username || '',
        confirmationCode: '', // This would come from the reset flow
        newPassword: password,
      });
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      idToken,
      loading,
      isAdmin,
      isContributor,
      isLeadership,
      canEditTools,
      signUp: handleSignUp,
      signIn: handleSignIn,
      confirmSignIn: handleConfirmSignIn,
      signOut: handleSignOut,
      resetPassword: handleResetPassword,
      confirmResetPassword: handleConfirmResetPassword,
      updatePassword: handleUpdatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
