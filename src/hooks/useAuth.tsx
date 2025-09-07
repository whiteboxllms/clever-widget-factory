import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isContributor: boolean;
  isLeadership: boolean;
  isToolKeeper: boolean;
  canEditTools: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (password: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isContributor, setIsContributor] = useState(false);
  const [isLeadership, setIsLeadership] = useState(false);
  const [isToolKeeper, setIsToolKeeper] = useState(false);
  const [canEditTools, setCanEditTools] = useState(false);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Check role when user changes
        if (session?.user) {
          // Use setTimeout to defer Supabase calls and prevent deadlock
          setTimeout(async () => {
            const { data: member } = await supabase
              .from('organization_members')
              .select('role')
              .eq('user_id', session.user.id)
              .single();
            const userRole = member?.role;
            setIsAdmin(userRole === 'admin' || userRole === 'leadership');
            setIsContributor(userRole === 'contributor');
            setIsLeadership(userRole === 'leadership');
            setIsToolKeeper(userRole === 'tool_keeper' || userRole === 'leadership');
            setCanEditTools(userRole === 'admin' || userRole === 'contributor' || userRole === 'leadership' || userRole === 'tool_keeper');
          }, 0);
        } else {
          setIsAdmin(false);
          setIsContributor(false);
          setIsLeadership(false);
          setIsToolKeeper(false);
          setCanEditTools(false);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
        // Check role for existing session
        if (session?.user) {
          const { data: member } = await supabase
            .from('organization_members')
            .select('role')
            .eq('user_id', session.user.id)
            .single();
          const userRole = member?.role;
          setIsAdmin(userRole === 'admin' || userRole === 'leadership');
          setIsContributor(userRole === 'contributor');
          setIsLeadership(userRole === 'leadership');
          setIsToolKeeper(userRole === 'tool_keeper' || userRole === 'leadership');
          setCanEditTools(userRole === 'admin' || userRole === 'contributor' || userRole === 'leadership' || userRole === 'tool_keeper');
      } else {
        setIsAdmin(false);
        setIsContributor(false);
        setIsLeadership(false);
        setIsToolKeeper(false);
        setCanEditTools(false);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        }
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({
      password: password,
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      isAdmin,
      isContributor,
      isLeadership,
      isToolKeeper,
      canEditTools,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      resetPassword,
      updatePassword,
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