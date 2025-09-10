import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { StrategicAttributeType } from '@/hooks/useStrategicAttributes';
import { useOrganizationId } from '@/hooks/useOrganizationId';

export interface OrganizationValues {
  strategic_attributes: StrategicAttributeType[];
}

export function useOrganizationValues() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const organizationId = useOrganizationId();

  const getOrganizationValues = useCallback(async (): Promise<StrategicAttributeType[]> => {
    if (!organizationId) return [];

    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('settings')
        .eq('id', organizationId)
        .single();

      if (error) throw error;

      const settings = data?.settings as any;
      return settings?.strategic_attributes || [];
    } catch (error) {
      console.error('Error fetching organization values:', error);
      return [];
    }
  }, [organizationId]);

  const updateOrganizationValues = useCallback(async (selectedAttributes: StrategicAttributeType[]): Promise<boolean> => {
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