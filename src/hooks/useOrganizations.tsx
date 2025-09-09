import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Organization {
  id: string;
  name: string;
  subdomain: string | null;
  settings: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

interface OrganizationWithMembers extends Organization {
  organization_members: Array<{
    id: string;
    user_id: string;
    role: string;
    profiles: {
      full_name: string | null;
    } | null;
  }>;
}

export function useOrganizations() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const getAllOrganizations = async (): Promise<Organization[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select(`
          *,
          organization_members(count)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching organizations:', error);
        toast({
          title: "Error",
          description: "Failed to fetch organizations",
          variant: "destructive",
        });
        return [];
      }

      return (data || []).map(org => ({
        ...org,
        member_count: org.organization_members?.[0]?.count || 0
      }));
    } catch (error) {
      console.error('Error in getAllOrganizations:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getOrganizationWithMembers = async (orgId: string): Promise<OrganizationWithMembers | null> => {
    try {
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

      if (orgError) {
        console.error('Error fetching organization:', orgError);
        return null;
      }

      const { data: membersData, error: membersError } = await supabase
        .from('organization_members')
        .select('id, user_id, role')
        .eq('organization_id', orgId);

      if (membersError) {
        console.error('Error fetching members:', membersError);
        return null;
      }

      // Get profile data for each member
      const membersWithProfiles = await Promise.all(
        (membersData || []).map(async (member) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', member.user_id)
            .single();
          
          return {
            ...member,
            profiles: profile || { full_name: null }
          };
        })
      );

      return {
        ...orgData,
        organization_members: membersWithProfiles
      } as OrganizationWithMembers;
    } catch (error) {
      console.error('Error in getOrganizationWithMembers:', error);
      return null;
    }
  };

  const createOrganization = async (name: string, subdomain?: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_organization_with_admin', {
        org_name: name,
        org_subdomain: subdomain || null
      });

      if (error) {
        console.error('Error creating organization:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to create organization",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Success",
        description: "Organization created successfully",
      });
      return true;
    } catch (error) {
      console.error('Error in createOrganization:', error);
      toast({
        title: "Error",
        description: "Failed to create organization",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateOrganization = async (
    orgId: string, 
    updates: Partial<Pick<Organization, 'name' | 'subdomain' | 'is_active' | 'settings'>>
  ): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', orgId);

      if (error) {
        console.error('Error updating organization:', error);
        toast({
          title: "Error",
          description: "Failed to update organization",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Success",
        description: "Organization updated successfully",
      });
      return true;
    } catch (error) {
      console.error('Error in updateOrganization:', error);
      toast({
        title: "Error",
        description: "Failed to update organization",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    getAllOrganizations,
    getOrganizationWithMembers,
    createOrganization,
    updateOrganization,
    loading,
  };
}