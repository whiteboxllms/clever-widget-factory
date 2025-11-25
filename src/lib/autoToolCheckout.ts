import { supabase } from '@/lib/client';
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
 * Creates planned checkouts for tools assigned to an action
 * These are "planned" checkouts with checkout_date = NULL
 */
/**
 * Creates a single planned checkout for a specific tool and action
 */
export async function createSinglePlannedCheckout(options: {
  toolId: string;
  toolSerialNumber: string;
  actionId: string;
  organizationId: string;
  userId: string;
  userName: string;
  actionTitle: string;
}): Promise<void> {
  const { toolId, toolSerialNumber, actionId, organizationId, userId, userName, actionTitle } = options;

  try {
    // Check if planned checkout already exists
    const { data: existingCheckout } = await supabase
      .from('checkouts')
      .select('id')
      .eq('tool_id', toolId)
      .eq('action_id', actionId)
      .is('checkout_date', null)
      .eq('is_returned', false)
      .single();

    if (existingCheckout) {
      console.log(`Planned checkout already exists for tool ${toolSerialNumber} and action ${actionId}`);
      return;
    }

    // Create planned checkout (checkout_date = NULL)
    const checkoutData = {
      tool_id: toolId,
      user_id: userId,
      user_name: userName,
      intended_usage: actionTitle,
      notes: `Planned for action: ${actionTitle}`,
      checkout_date: null, // NULL = planned
      is_returned: false,
      action_id: actionId,
      organization_id: organizationId
    };

    const { error: checkoutError } = await supabase
      .from('checkouts')
      .insert(checkoutData);

    if (checkoutError) throw checkoutError;

    // Update tool status to 'checked_out' (reserved)
    const { error: toolError } = await supabase
      .from('tools')
      .update({ status: 'checked_out' })
      .eq('id', toolId);

    if (toolError) throw toolError;

    console.log(`Created planned checkout for tool ${toolSerialNumber} (${actionTitle}) for action ${actionId}`);
  } catch (error) {
    console.error('Error creating planned checkout:', error);
    throw error;
  }
}

export async function createPlannedCheckoutsForAction(options: AutoCheckoutOptions): Promise<void> {
  const { actionId, organizationId, missionId, taskId, intendedUsage, notes } = options;

  try {
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      throw new Error('User must be authenticated to create planned checkouts');
    }

    // Get the action and its required tools
    const { data: action, error: actionError } = await supabase
      .from('actions')
      .select('id, title, required_tools, assigned_to')
      .eq('id', actionId)
      .single();

    if (actionError) throw actionError;
    if (!action?.required_tools || action.required_tools.length === 0) {
      return; // No tools required
    }

    // Get tools by IDs (required_tools contains tool UUIDs)
    const { data: tools, error: toolsError } = await supabase
      .from('tools')
      .select('id, name, serial_number, status')
      .in('id', action.required_tools)
      .eq('status', 'available');

    if (toolsError) throw toolsError;
    if (!tools || tools.length === 0) {
      return; // No tools available
    }

    // Create planned checkouts for each tool
    for (const tool of tools) {
      await createPlannedCheckout({
        toolId: tool.id,
        toolName: tool.name,
        toolSerialNumber: tool.serial_number || tool.id,
        userId: user.id,
        userName: user.user_metadata?.full_name || 'Unknown User',
        actionId,
        organizationId,
        missionId,
        taskId,
        intendedUsage: intendedUsage || `For action: ${action?.title || 'Unknown'}`,
        notes: notes || `Planned for action: ${action?.title || 'Unknown'}`
      });
    }

    console.log(`Created planned checkouts for ${tools.length} tools for action ${actionId}`);
  } catch (error) {
    console.error('Error creating planned checkouts:', error);
    throw error;
  }
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
 * Creates a single planned checkout record
 */
async function createPlannedCheckout(options: {
  toolId: string;
  toolName: string;
  toolSerialNumber: string;
  userId: string;
  userName: string;
  actionId: string;
  organizationId: string;
  missionId?: string;
  taskId?: string;
  intendedUsage: string;
  notes: string;
}): Promise<void> {
  const { 
    toolId, 
    toolName, 
    toolSerialNumber, 
    userId, 
    userName, 
    actionId, 
    organizationId, 
    missionId, 
    taskId, 
    intendedUsage, 
    notes 
  } = options;

  try {
    // Check if planned checkout already exists
    const { data: existingCheckout } = await supabase
      .from('checkouts')
      .select('id')
      .eq('tool_id', toolId)
      .eq('action_id', actionId)
      .is('checkout_date', null)
      .eq('is_returned', false)
      .single();

    if (existingCheckout) {
      console.log(`Planned checkout already exists for tool ${toolSerialNumber} and action ${actionId}`);
      return;
    }

    // Get action details for better checkout information
    const { data: action, error: actionError } = await supabase
      .from('actions')
      .select('id, title, policy')
      .eq('id', actionId)
      .single();

    if (actionError) throw actionError;

    // Create planned checkout (checkout_date = NULL)
    const checkoutData = {
      tool_id: toolId,
      user_id: userId,
      user_name: userName,
      intended_usage: action?.title || intendedUsage, // Use action title as intended usage
      notes: action?.policy || notes, // Use action policy as notes
      checkout_date: null, // NULL = planned
      is_returned: false,
      action_id: actionId,
      organization_id: organizationId
    };

    const { error: checkoutError } = await supabase
      .from('checkouts')
      .insert(checkoutData);

    if (checkoutError) throw checkoutError;

    // Update tool status to 'checked_out' even for planned checkouts
    const { error: toolError } = await supabase
      .from('tools')
      .update({ status: 'checked_out' })
      .eq('id', toolId);

    if (toolError) throw toolError;

    console.log(`Created planned checkout for tool ${toolSerialNumber} (${toolName}) for action ${actionId}`);
  } catch (error) {
    console.error('Error creating planned checkout:', error);
    throw error;
  }
}

/**
 * Checks in a single tool
 */
async function autoCheckinSingleTool(options: {
  checkoutId: string;
  toolId: string;
  toolName: string;
  hasMotor: boolean;
  userId: string;
  userName: string;
  organizationId: string;
  checkinReason: string;
  notes: string;
}): Promise<void> {
  const { checkoutId, toolId, toolName, hasMotor, userId, userName, organizationId, checkinReason, notes } = options;

  try {
    // Create checkin record
    const checkinData = {
      checkout_id: checkoutId,
      tool_id: toolId,
      user_name: userName,
      problems_reported: '',
      notes: notes,
      sop_best_practices: '',
      what_did_you_do: '',
      checkin_reason: checkinReason,
      after_image_urls: [],
      organization_id: organizationId
    };

    const { error: checkinError } = await supabase
      .from('checkins')
      .insert(checkinData);

    if (checkinError) throw checkinError;

    // Update checkout as returned
    const { error: checkoutError } = await supabase
      .from('checkouts')
      .update({ is_returned: true })
      .eq('id', checkoutId);

    if (checkoutError) throw checkoutError;

    // Update tool status back to available
    const { error: toolError } = await supabase
      .from('tools')
      .update({ status: 'available' })
      .eq('id', toolId);

    if (toolError) throw toolError;

    console.log(`Checked in tool ${toolName} (checkout ${checkoutId})`);
  } catch (error) {
    console.error('Error checking in tool:', error);
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

/**
 * Checks if an action has any active tool checkouts that could be auto-checked in
 */
export async function hasActiveToolCheckouts(actionId: string, organizationId: string): Promise<boolean> {
  try {
    const { data: checkouts, error: checkoutsError } = await supabase
      .from('checkouts')
      .select('id')
      .eq('action_id', actionId)
      .eq('organization_id', organizationId)
      .eq('is_returned', false)
      .not('checkout_date', 'is', null) // Only actual checkouts, not planned
      .limit(1);

    if (checkoutsError) return false;
    return (checkouts && checkouts.length > 0);
  } catch (error) {
    console.error('Error checking for active tool checkouts:', error);
    return false;
  }
}

/**
 * Gets planned tools for an action (tools assigned but not yet checked out)
 */
export async function getPlannedToolsForAction(actionId: string, organizationId: string) {
  try {
    const { data: checkouts, error } = await supabase
      .from('checkouts')
      .select(`
        id,
        tool_id,
        user_name,
        intended_usage,
        notes,
        created_at,
        tools!inner(id, name, serial_number, status)
      `)
      .eq('action_id', actionId)
      .eq('organization_id', organizationId)
      .is('checkout_date', null)
      .eq('is_returned', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return checkouts || [];
  } catch (error) {
    console.error('Error getting planned tools:', error);
    return [];
  }
}

/**
 * Gets active tools for an action (tools currently checked out)
 */
export async function getActiveToolsForAction(actionId: string, organizationId: string) {
  try {
    const { data: checkouts, error } = await supabase
      .from('checkouts')
      .select(`
        id,
        tool_id,
        user_name,
        intended_usage,
        notes,
        checkout_date,
        created_at,
        tools!inner(id, name, serial_number, status)
      `)
      .eq('action_id', actionId)
      .eq('organization_id', organizationId)
      .not('checkout_date', 'is', null)
      .eq('is_returned', false)
      .order('checkout_date', { ascending: false });

    if (error) throw error;
    return checkouts || [];
  } catch (error) {
    console.error('Error getting active tools:', error);
    return [];
  }
}