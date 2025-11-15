import { useState, useEffect } from 'react';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { useToast } from '@/hooks/use-toast';

export interface OrganizationMember {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

export function useOrganizationMembers() {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const organizationId = useOrganizationId();

  const fetchMembers = async () => {
    try {
      setLoading(true);
      
      // Use API directly to get organization members with proper filtering
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/organization_members?organization_id=${organizationId || '00000000-0000-0000-0000-000000000001'}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch organization members: ${response.status}`);
      }
      
      const result = await response.json();
      const data = result.data || [];

      // Transform to match OrganizationMember interface
      const organizationMembers: OrganizationMember[] = data.map((member: any) => ({
        id: member.user_id,
        user_id: member.user_id,
        full_name: member.full_name,
        role: member.role,
        favorite_color: member.favorite_color
      }));

      setMembers(organizationMembers);
    } catch (error) {
      console.error('Error in fetchMembers:', error);
      toast({
        title: "Error",
        description: "Failed to load organization members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organizationId) {
      fetchMembers();
    }
  }, [organizationId]);

  return {
    members,
    loading,
    refetch: fetchMembers
  };
}
