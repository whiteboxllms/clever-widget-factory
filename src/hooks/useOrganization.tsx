import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

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
    if (!user) {
      setOrganization(null);
      setOrganizationMember(null);
      setLoading(false);
      return;
    }

    try {
      // Get user's organization membership (take the first one if multiple exist)
      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select(`
          *,
          organization:organizations(*)
        `)
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (memberError) {
        console.error('Error fetching organization membership:', memberError);
        setOrganization(null);
        setOrganizationMember(null);
        setLoading(false);
        return;
      }

      setOrganizationMember(memberData);
      setOrganization(memberData.organization as Organization);
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