import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganizationId } from '@/hooks/useOrganizationId';

export interface OrganizationValues {
  strategic_attributes: string[];
}

export function useOrganizationValues() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const organizationId = useOrganizationId();

  const getOrganizationValues = useCallback(async (): Promise<string[]> => {
    if (!organizationId) return [];

    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', organizationId)
        .single();

      if (error) throw error;

      const settings = data?.settings as any;
      const values = settings?.strategic_attributes || [];
      
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
  }, [organizationId]);

  const updateOrganizationValues = useCallback(async (selectedAttributes: string[]): Promise<boolean> => {
    if (!organizationId) return false;

    setIsLoading(true);
    try {
      // Get current settings
      const { data: currentData, error: fetchError } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', organizationId)
        .single();

      if (fetchError) throw fetchError;

      const currentSettings = currentData?.settings || {};
      const updatedSettings = {
        ...(currentSettings as Record<string, any>),
        strategic_attributes: selectedAttributes
      };

      const { error: updateError } = await supabase
        .from('organizations')
        .update({ settings: updatedSettings })
        .eq('id', organizationId);

      if (updateError) throw updateError;

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
  }, [organizationId, toast]);

  return {
    getOrganizationValues,
    updateOrganizationValues,
    isLoading
  };
}