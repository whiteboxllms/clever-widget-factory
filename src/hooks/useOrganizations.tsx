import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiService, getApiData } from '@/lib/apiService';

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
      const response = await apiService.get('/api/organizations');
      const data = getApiData(response) || [];
      return data;
    } catch (error) {
      console.error('Error in getAllOrganizations:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const getOrganizationWithMembers = async (orgId: string): Promise<OrganizationWithMembers | null> => {
    try {
      const orgData = await apiService.get(`/api/organizations/${orgId}`);
      const membersResponse = await apiService.get(`/api/organization_members?organization_id=${orgId}`);
      const membersData = getApiData(membersResponse) || [];

      const membersWithProfiles = membersData.map((member: any) => ({
        id: member.id,
        user_id: member.user_id,
        role: member.role,
        profiles: { full_name: member.full_name || null }
      }));

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
      await apiService.post('/api/organizations', {
        name,
        subdomain: subdomain || null
      });

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
      await apiService.put(`/api/organizations/${orgId}`, updates);

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