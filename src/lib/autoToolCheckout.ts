import { apiService } from './apiService';

export interface AutoCheckoutOptions {
  actionId: string;
  organizationId: string;
  missionId?: string;
  taskId?: string;
  intendedUsage?: string;
  notes?: string;
}

export interface AutoCheckinOptions {
  actionId: string;
  organizationId?: string; // Optional - backend gets it from authorizer context
  checkinReason?: string;
  notes?: string;
}

/**
 * Converts planned checkouts to actual checkouts when implementation begins
 * This sets checkout_date to the current timestamp
 */
export async function activatePlannedCheckoutsForAction(actionId: string, organizationId?: string): Promise<void> {
  // organizationId is not needed - backend gets it from authorizer context
  try {
    // Get planned checkouts for this action
    const result = await apiService.get(`/checkouts?action_id=${actionId}&is_returned=false`);
    
    if (!result.data || result.data.length === 0) {
      console.log('No planned checkouts to activate');
      return;
    }
    
    // Filter for planned checkouts (checkout_date is null)
    const plannedCheckouts = result.data.filter((c: any) => !c.checkout_date);
    
    if (plannedCheckouts.length === 0) {
      console.log('No planned checkouts to activate');
      return;
    }
    
    // Update each checkout to set checkout_date and tool status
    for (const checkout of plannedCheckouts) {
      await apiService.put(`/checkouts/${checkout.id}`, { checkout_date: new Date().toISOString() });
      // Update tool status to checked_out
      await apiService.put(`/tools/${checkout.tool_id}`, { status: 'checked_out' });
    }
    
    console.log(`Activated ${plannedCheckouts.length} planned checkouts for action ${actionId}`);
  } catch (error) {
    console.error('Error activating planned checkouts:', error);
    throw error;
  }
}

/**
 * Automatically checks in tools for a completed action
 * Only checks in tools that are currently checked out for this action
 */
export async function autoCheckinToolsForAction(options: AutoCheckinOptions): Promise<void> {
  const { actionId, checkinReason, notes } = options;
  // organizationId is not needed - backend gets it from authorizer context

  try {

    // Get all unreturned checkouts for this action
    const result = await apiService.get(`/checkouts?action_id=${actionId}&is_returned=false`);
    const checkouts = result.data || [];

    if (checkouts.length === 0) {
      return; // No active checkouts for this action
    }

    // Check in each tool
    for (const checkout of checkouts) {
      if (checkout.checkout_date) {
        // This is an active checkout - create a proper checkin record
        await apiService.post('/checkins', {
          checkout_id: checkout.id,
          tool_id: checkout.tool_id,
          user_name: checkout.user_name || 'Unknown User',
          problems_reported: '',
          notes: notes || 'Auto-checked in - action completed',
          sop_best_practices: '',
          what_did_you_do: '',
          checkin_reason: checkinReason || 'Action completed',
          after_image_urls: [],
        });
      } else {
        // This is a planned checkout - create a checkin record for planned checkout
        await apiService.post('/checkins', {
          checkout_id: checkout.id,
          tool_id: checkout.tool_id,
          user_name: checkout.user_name || 'Unknown User',
          problems_reported: '',
          notes: notes || 'Auto-checked in - planned checkout completed',
          sop_best_practices: '',
          what_did_you_do: '',
          checkin_reason: checkinReason || 'Action completed - planned checkout',
          after_image_urls: []
        });
      }

      // Mark checkout as returned and update tool status
      await apiService.put(`/checkouts/${checkout.id}`, { is_returned: true });

      await apiService.put(`/tools/${checkout.tool_id}`, { status: 'available' });

      console.log(`Checked in tool ${checkout.tool_id} for action ${actionId}`);
    }

    console.log(`Auto-checked in ${checkouts.length} tools for action ${actionId}`);
  } catch (error) {
    console.error('Error auto-checking in tools:', error);
    throw error;
  }
}

/**
 * Checks if an action has any planned checkouts that could be activated
 */
export async function hasPlannedCheckouts(actionId: string, organizationId?: string): Promise<boolean> {
  // organizationId is optional - backend filters by organization from authorizer context
  try {
    // Backend will filter by organization from authorizer, so we don't need to pass it
    const result = await apiService.get(`/checkouts?action_id=${actionId}&is_returned=false`);
    // Filter for planned checkouts (checkout_date is null) on the client side
    const plannedCheckouts = (result.data || []).filter((c: any) => !c.checkout_date);
    return plannedCheckouts.length > 0;
  } catch (error) {
    console.error('Error checking for planned checkouts:', error);
    return false;
  }
}

/**
 * Activates planned checkouts when plan is committed
 * This is called when the user commits to the plan and is ready to start work
 */
export async function activatePlannedCheckoutsIfNeeded(actionId: string, organizationId?: string): Promise<void> {
  // organizationId is not needed - backend gets it from authorizer context
  try {
    // Check if there are any planned checkouts to activate
    const hasPlanned = await hasPlannedCheckouts(actionId, organizationId || '');
    if (!hasPlanned) {
      return; // No planned checkouts to activate
    }

    // Activate the checkouts
    await activatePlannedCheckoutsForAction(actionId);
    console.log(`Activated planned checkouts for action ${actionId} (plan committed)`);
  } catch (error) {
    console.error('Error activating planned checkouts if needed:', error);
    // Don't throw - this is a background operation
  }
}

