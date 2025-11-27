import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/hooks/useOrganization';
import { apiService, getApiData } from '@/lib/apiService';

export interface OrganizationValues {
  strategic_attributes: string[];
}

export function useOrganizationValues() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { organization } = useOrganization();

  const getOrganizationValues = useCallback(async (): Promise<string[]> => {
    if (!organization?.id) return [];

    try {
      const response = await apiService.get('/organizations');
      const orgs = getApiData(response) || [];
      const currentOrg = orgs.find((o: any) => o.id === organization.id);
      
      const values = currentOrg?.settings?.strategic_attributes || [];
      
      // If no values exist, return defaults
      if (values.length === 0) {
        return [
          "Growth Mindset", 
          "Quality",
          "Teamwork and Transparent Communication"
        ];
      }
      
      return values;
    } catch (error) {
      console.error('Error fetching organization values:', error);
      return [
        "Growth Mindset", 
        "Quality",
        "Teamwork and Transparent Communication"
      ];
    }
  }, [organization?.id]);

  const updateOrganizationValues = useCallback(async (selectedAttributes: string[]): Promise<boolean> => {
    if (!organization?.id) return false;

    setIsLoading(true);
    try {
      await apiService.put(`/organizations/${organization.id}`, {
        strategic_attributes: selectedAttributes
      });

      toast({
        title: "Success",
        description: "Organization values updated successfully",
      });

      return true;
    } catch (error) {
      console.error('Error updating organization values:', error);
      toast({
        title: "Error",
        description: "Failed to update organization values",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [organization?.id, toast]);

  return {
    getOrganizationValues,
    updateOrganizationValues,
    isLoading
  };
}