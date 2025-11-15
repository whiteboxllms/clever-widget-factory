import { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from "@/hooks/useCognitoAuth";
import { UserMappingService } from '@/lib/userMappingService';

interface Organization {
  id: string;
  name: string;
  subdomain: string | null;
  settings: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  invited_by: string | null;
}

interface OrganizationContextType {
  organization: Organization | null;
  organizationMember: OrganizationMember | null;
  isAdmin: boolean;
  loading: boolean;
  refreshOrganization: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizationMember, setOrganizationMember] = useState<OrganizationMember | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = organizationMember?.role === 'admin';

  const fetchOrganizationData = async () => {
    console.log('🔍 fetchOrganizationData called with user:', user);
    
    if (!user) {
      console.log('❌ No user, skipping organization fetch');
      setOrganization(null);
      setOrganizationMember(null);
      setLoading(false);
      return;
    }

    console.log('🔍 Setting up Stargazer Farm organization for user:', user.userId);

    try {
      const mockMember = {
        id: 'f6583e34-45f7-4523-aecd-5f62c8abb7b5',
        organization_id: '00000000-0000-0000-0000-000000000001',
        user_id: user.userId, // Use actual Cognito user ID
        role: 'admin',
        invited_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const mockOrganization = {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Stargazer Farm',
        subdomain: 'stargazer-farm',
        settings: {},
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('✅ Using Cognito user ID for clean architecture');
      setOrganizationMember(mockMember);
      setOrganization(mockOrganization);
    } catch (error) {
      console.error('Error in fetchOrganizationData:', error);
      setOrganization(null);
      setOrganizationMember(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshOrganization = async () => {
    setLoading(true);
    await fetchOrganizationData();
  };

  useEffect(() => {
    if (!authLoading) {
      fetchOrganizationData();
    }
  }, [user, authLoading]);

  return (
    <OrganizationContext.Provider value={{
      organization,
      organizationMember,
      isAdmin,
      loading,
      refreshOrganization,
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}