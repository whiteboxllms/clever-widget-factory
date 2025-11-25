import { useState, useEffect } from 'react';
import { useOrganizationId } from '@/hooks/useOrganizationId';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/lib/apiService';

export interface OrganizationMember {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
  favorite_color?: string;
  cognito_user_id?: string;
}

export function useOrganizationMembers() {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const organizationId = useOrganizationId();

  const fetchMembers = async () => {
    try {
      setLoading(true);
      
      const result = await apiService.get('/organization_members');
      const data = result.data || [];

      // Transform to match OrganizationMember interface
      const organizationMembers: OrganizationMember[] = data.map((member: any) => ({
        id: member.user_id,
        user_id: member.user_id,
        full_name: member.full_name,
        role: member.role,
        favorite_color: member.favorite_color,
        cognito_user_id: member.cognito_user_id
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
    fetchMembers();
  }, []);

  return {
    members,
    loading,
    refetch: fetchMembers
  };
}
