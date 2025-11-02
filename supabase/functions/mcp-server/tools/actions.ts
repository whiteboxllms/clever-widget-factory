import { createSupabaseClient, validateOrganizationAccess } from '../lib/supabase.ts';
import { 
  ListActionsSchema, 
  GetActionDetailsSchema, 
  CreateActionSchema, 
  UpdateActionStatusSchema,
  AddActionUpdateSchema 
} from '../lib/schemas.ts';
import { logToolInvocation, createSuccessResponse, createErrorResponse, formatError } from '../lib/utils.ts';

export async function listActions(params: any) {
  const validatedParams = ListActionsSchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('list_actions', validatedParams.organization_id, undefined, validatedParams);

    // Build query
    let query = supabase
      .from('actions')
      .select(`
        id,
        title,
        description,
        status,
        assigned_to,
        asset_id,
        mission_id,
        linked_issue_id,
        created_at,
        completed_at,
        estimated_duration,
        actual_duration,
        score,
        required_stock,
        required_tools
      `)
      .eq('organization_id', validatedParams.organization_id)
      .order('created_at', { ascending: false })
      .limit(validatedParams.limit);

    // Apply filters
    if (validatedParams.status) {
      query = query.eq('status', validatedParams.status);
    }
    if (validatedParams.assigned_to) {
      query = query.eq('assigned_to', validatedParams.assigned_to);
    }
    if (validatedParams.asset_id) {
      query = query.eq('asset_id', validatedParams.asset_id);
    }
    if (validatedParams.mission_id) {
      query = query.eq('mission_id', validatedParams.mission_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error listing actions:', error);
      return createErrorResponse('Failed to list actions', 'DATABASE_ERROR');
    }

    return createSuccessResponse({
      actions: data || [],
      count: data?.length || 0,
      filters_applied: {
        status: validatedParams.status,
        assigned_to: validatedParams.assigned_to,
        asset_id: validatedParams.asset_id,
        mission_id: validatedParams.mission_id
      }
    });

  } catch (error) {
    console.error('Error in listActions:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}

export async function getActionDetails(params: any) {
  const validatedParams = GetActionDetailsSchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('get_action_details', validatedParams.organization_id, undefined, validatedParams);

    // Get action details
    const { data: action, error: actionError } = await supabase
      .from('actions')
      .select('*')
      .eq('id', validatedParams.action_id)
      .eq('organization_id', validatedParams.organization_id)
      .single();

    if (actionError || !action) {
      return createErrorResponse('Action not found', 'NOT_FOUND');
    }

    // Get implementation updates
    const { data: updates, error: updatesError } = await supabase
      .from('action_implementation_updates')
      .select('*')
      .eq('action_id', validatedParams.action_id)
      .order('created_at', { ascending: false });

    // Get action scores if available
    const { data: scores, error: scoresError } = await supabase
      .from('action_scores')
      .select('*')
      .eq('action_id', validatedParams.action_id)
      .order('created_at', { ascending: false });

    return createSuccessResponse({
      action,
      implementation_updates: updates || [],
      scores: scores || [],
      metadata: {
        updates_count: updates?.length || 0,
        scores_count: scores?.length || 0
      }
    });

  } catch (error) {
    console.error('Error in getActionDetails:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}

export async function createAction(params: any) {
  const validatedParams = CreateActionSchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('create_action', validatedParams.organization_id, validatedParams.created_by, validatedParams);

    // Create the action
    const { data, error } = await supabase
      .from('actions')
      .insert({
        organization_id: validatedParams.organization_id,
        title: validatedParams.title,
        description: validatedParams.description,
        assigned_to: validatedParams.assigned_to,
        linked_issue_id: validatedParams.linked_issue_id,
        asset_id: validatedParams.asset_id,
        status: validatedParams.status,
        required_stock: validatedParams.required_stock,
        required_tools: validatedParams.required_tools,
        estimated_duration: validatedParams.estimated_duration,
        created_by: validatedParams.created_by,
        updated_by: validatedParams.created_by
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating action:', error);
      return createErrorResponse('Failed to create action', 'DATABASE_ERROR');
    }

    return createSuccessResponse({
      action: data,
      message: 'Action created successfully'
    });

  } catch (error) {
    console.error('Error in createAction:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}

export async function updateActionStatus(params: any) {
  const validatedParams = UpdateActionStatusSchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('update_action_status', validatedParams.organization_id, validatedParams.updated_by, validatedParams);

    // Update the action
    const updateData: any = {
      status: validatedParams.status,
      updated_at: new Date().toISOString(),
      updated_by: validatedParams.updated_by
    };

    if (validatedParams.completed_at !== undefined) {
      updateData.completed_at = validatedParams.completed_at;
    }
    if (validatedParams.actual_duration !== undefined) {
      updateData.actual_duration = validatedParams.actual_duration;
    }
    if (validatedParams.observations !== undefined) {
      updateData.observations = validatedParams.observations;
    }

    const { data, error } = await supabase
      .from('actions')
      .update(updateData)
      .eq('id', validatedParams.action_id)
      .eq('organization_id', validatedParams.organization_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating action status:', error);
      return createErrorResponse('Failed to update action status', 'DATABASE_ERROR');
    }

    return createSuccessResponse({
      action: data,
      message: 'Action status updated successfully'
    });

  } catch (error) {
    console.error('Error in updateActionStatus:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}

export async function addActionUpdate(params: any) {
  const validatedParams = AddActionUpdateSchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('add_action_update', validatedParams.organization_id, validatedParams.updated_by, validatedParams);

    // Add the implementation update
    const { data, error } = await supabase
      .from('action_implementation_updates')
      .insert({
        action_id: validatedParams.action_id,
        update_text: validatedParams.update_text,
        update_type: validatedParams.update_type,
        updated_by: validatedParams.updated_by
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding action update:', error);
      return createErrorResponse('Failed to add action update', 'DATABASE_ERROR');
    }

    // Update the action's updated_at timestamp
    await supabase
      .from('actions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', validatedParams.action_id)
      .eq('organization_id', validatedParams.organization_id);

    return createSuccessResponse({
      update: data,
      message: 'Action update added successfully'
    });

  } catch (error) {
    console.error('Error in addActionUpdate:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}
