import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/hooks/useOrganization';
import { apiService, getApiData } from '@/lib/apiService';

export interface OrganizationValues {
  strategic_attributes: string[];
}

export function useOrganizationValues(org?: any) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { organization: contextOrg } = useOrganization();
  const organization = org || contextOrg;

  const getOrganizationValues = useCallback(async (): Promise<string[]> => {
    // If organization already has settings, use them directly
    if (organization?.settings?.strategic_attributes) {
      return organization.settings.strategic_attributes;
    }

    try {
      const response = await apiService.get('/organizations');
      const orgs = getApiData(response) || [];
      
      // Use first org if no specific org ID
      const currentOrg = organization?.id 
        ? orgs.find((o: any) => o.id === organization.id)
        : orgs[0];
      console.log('[useOrganizationValues] Current org:', currentOrg);
      
      const values = currentOrg?.settings?.strategic_attributes || [];
      console.log('[useOrganizationValues] Values:', values);
      
      // If no values exist, return defaults
      if (values.length === 0) {
        console.log('[useOrganizationValues] Returning defaults');
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
  }, [organization?.id, organization?.settings]);

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