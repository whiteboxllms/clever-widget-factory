import { supabase } from '@/integrations/supabase/client';

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
  organizationId: string;
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

    // Get the action and its required tool serial numbers
    const { data: action, error: actionError } = await supabase
      .from('actions')
      .select('id, title, required_tool_serial_numbers, assigned_to')
      .eq('id', actionId)
      .single();

    if (actionError) throw actionError;
    if (!action?.required_tool_serial_numbers || action.required_tool_serial_numbers.length === 0) {
      return; // No tools required
    }

    // Get tools by serial numbers
    const { data: tools, error: toolsError } = await supabase
      .from('tools')
      .select('id, name, serial_number, status')
      .in('serial_number', action.required_tool_serial_numbers)
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
        toolSerialNumber: tool.serial_number!,
        userId: user.id,
        userName: user.user_metadata?.full_name || 'Unknown User',
        actionId,
        organizationId,
        missionId,
        taskId,
        intendedUsage: intendedUsage || `For action: ${action.title}`,
        notes: notes || `Planned for action: ${action.title}`
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
export async function activatePlannedCheckoutsForAction(actionId: string, organizationId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('checkouts')
      .update({ 
        checkout_date: new Date().toISOString(),
        notes: 'Auto-checked out when first implementation note was added'
      })
      .eq('action_id', actionId)
      .eq('organization_id', organizationId)
      .is('checkout_date', null)
      .eq('is_returned', false);

    if (error) throw error;
    console.log(`Activated planned checkouts for action ${actionId}`);
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
  const { actionId, organizationId, checkinReason, notes } = options;

  try {
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      throw new Error('User must be authenticated to checkin tools');
    }

    // Get all unreturned checkouts for this action (both planned and active)
    const { data: checkouts, error: checkoutsError } = await supabase
      .from('checkouts')
      .select(`
        id,
        tool_id,
        user_id,
        user_name,
        intended_usage,
        notes,
        action_id,
        checkout_date,
        tools!inner(id, name, has_motor, status)
      `)
      .eq('is_returned', false)
      .eq('action_id', actionId)
      .eq('organization_id', organizationId);

    if (checkoutsError) throw checkoutsError;
    if (!checkouts || checkouts.length === 0) {
      return; // No active checkouts for this action
    }

    // Check in each tool
    for (const checkout of checkouts) {
      if (checkout.checkout_date) {
        // This is an active checkout - create a proper checkin record
        await autoCheckinSingleTool({
          checkoutId: checkout.id,
          toolId: checkout.tool_id,
          toolName: checkout.tools.name,
          hasMotor: checkout.tools.has_motor,
          userId: user.id,
          userName: user.user_metadata?.full_name || 'Unknown User',
          organizationId: organizationId,
          checkinReason: checkinReason || 'Action completed',
          notes: notes || `Auto-checked in - action completed`
        });
      } else {
        // This is a planned checkout - create a checkin record and mark as returned
        const checkinData = {
          checkout_id: checkout.id,
          tool_id: checkout.tool_id,
          user_name: user.user_metadata?.full_name || 'Unknown User',
          problems_reported: '',
          notes: notes || `Auto-checked in - planned checkout completed`,
          sop_best_practices: '',
          what_did_you_do: '',
          checkin_reason: checkinReason || 'Action completed - planned checkout',
          after_image_urls: [],
          organization_id: organizationId
        };

        const { error: checkinError } = await supabase
          .from('checkins')
          .insert(checkinData);

        if (checkinError) throw checkinError;

        // Mark checkout as returned
        const { error: updateError } = await supabase
          .from('checkouts')
          .update({ 
            is_returned: true,
            notes: `${checkout.notes || ''}\n\nAction completed - planned checkout completed`.trim()
          })
          .eq('id', checkout.id);

        if (updateError) throw updateError;

        // Update tool status back to available
        const { error: toolError } = await supabase
          .from('tools')
          .update({ status: 'available' })
          .eq('id', checkout.tool_id);

        if (toolError) throw toolError;

        console.log(`Completed planned checkout for tool ${checkout.tools.name} (action completed)`);
      }
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
export async function hasPlannedCheckouts(actionId: string, organizationId: string): Promise<boolean> {
  try {
    const { data: checkouts, error: checkoutsError } = await supabase
      .from('checkouts')
      .select('id')
      .eq('action_id', actionId)
      .eq('organization_id', organizationId)
      .is('checkout_date', null)
      .eq('is_returned', false)
      .limit(1);

    if (checkoutsError) return false;
    return (checkouts && checkouts.length > 0);
  } catch (error) {
    console.error('Error checking for planned checkouts:', error);
    return false;
  }
}

/**
 * Activates planned checkouts for an action when tools are added/removed or implementation progresses
 * This is called whenever the tool assignment changes or when implementation moves to actual work
 */
export async function activatePlannedCheckoutsIfNeeded(actionId: string, organizationId: string): Promise<void> {
  try {
    // Check if there are any planned checkouts to activate
    const hasPlanned = await hasPlannedCheckouts(actionId, organizationId);
    if (!hasPlanned) {
      return; // No planned checkouts to activate
    }

    // Check if action has 2+ implementation updates (past the agreement phase)
    const { data: updates, error: updatesError } = await supabase
      .from('action_implementation_updates')
      .select('id')
      .eq('action_id', actionId)
      .order('created_at', { ascending: true });

    if (updatesError) {
      console.error('Error checking implementation updates:', updatesError);
      return;
    }

    // Only activate if we have 2 or more updates (past the agreement phase)
    if (updates && updates.length >= 2) {
      await activatePlannedCheckoutsForAction(actionId, organizationId);
      console.log(`Activated planned checkouts for action ${actionId} (${updates.length} implementation updates)`);
    }
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