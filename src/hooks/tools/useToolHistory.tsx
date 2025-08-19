import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CheckoutHistory {
  id: string;
  type?: string;
  checkout_date: string;
  expected_return_date?: string;
  user_name: string;
  intended_usage?: string;
  notes?: string;
  is_returned: boolean;
  checkin?: {
    id: string;
    checkin_date: string;
    problems_reported?: string;
    notes?: string;
    user_name?: string;
    hours_used?: number;
    after_image_urls?: string[];
    sop_best_practices?: string;
    what_did_you_do?: string;
    checkin_reason?: string;
  };
}

export const useToolHistory = () => {
  const [toolHistory, setToolHistory] = useState<CheckoutHistory[]>([]);
  const [currentCheckout, setCurrentCheckout] = useState<{user_name: string} | null>(null);
  const { toast } = useToast();

  const fetchToolHistory = async (toolId: string) => {
    try {
      // Fetch all checkouts (both returned and not returned)
      const { data: checkoutsData, error: checkoutsError } = await supabase
        .from('checkouts')
        .select(`
          *,
          checkins(
            id,
            checkin_date,
            problems_reported,
            notes,
            user_name,
            hours_used,
            after_image_urls,
            sop_best_practices,
            what_did_you_do,
            checkin_reason
          )
        `)
        .eq('tool_id', toolId)
        .order('checkout_date', { ascending: false });

      if (checkoutsError) throw checkoutsError;

      // Fetch standalone check-ins (not linked to any checkout)
      const { data: standaloneCheckins, error: checkinsError } = await supabase
        .from('checkins')
        .select('*')
        .eq('tool_id', toolId)
        .is('checkout_id', null)
        .order('checkin_date', { ascending: false });

      if (checkinsError) throw checkinsError;
      
      // Find current checkout (not returned)
      const activeCheckout = checkoutsData?.find(checkout => !checkout.is_returned);
      setCurrentCheckout(activeCheckout ? { user_name: activeCheckout.user_name } : null);
      
      // Combine checkouts and standalone check-ins into history
      const processedCheckouts = (checkoutsData || []).map(checkout => ({
        ...checkout,
        checkin: checkout.checkins && checkout.checkins.length > 0 ? checkout.checkins[0] : null
      }));
      
      const allHistory = [
        ...processedCheckouts,
        ...(standaloneCheckins || []).map(checkin => ({
          id: checkin.id,
          type: 'checkin',
          checkout_date: checkin.checkin_date,
          user_name: checkin.user_name,
          is_returned: true,
          checkin: checkin
        }))
      ].sort((a, b) => new Date(b.checkout_date).getTime() - new Date(a.checkout_date).getTime());
      
      setToolHistory(allHistory);
    } catch (error) {
      console.error('Error fetching tool history:', error);
      toast({
        title: "Error",
        description: "Failed to load tool history",
        variant: "destructive"
      });
    }
  };

  return {
    toolHistory,
    currentCheckout,
    fetchToolHistory,
    setCurrentCheckout
  };
};