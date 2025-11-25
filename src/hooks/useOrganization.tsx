import { createContext, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useCognitoAuth';
import { useProfile } from '@/hooks/useProfile';

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Use useProfile to get real organization data instead of mock data
  const {
    organization,
    organizationMember,
    isAdmin,
    isLoading
  } = useProfile();

  const refreshOrganization = async () => {
    // Invalidate queries to force refetch
    if (user?.userId) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile', user.userId] }),
        queryClient.invalidateQueries({ queryKey: ['organization_memberships', user.userId] }),
      ]);
    }
  };

  return (
    <OrganizationContext.Provider value={{
      organization,
      organizationMember: organizationMember ? {
        id: organizationMember.id,
        organization_id: organizationMember.organization_id,
        user_id: organizationMember.user_id,
        role: organizationMember.role,
        invited_by: null
      } : null,
      isAdmin,
      loading: isLoading,
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