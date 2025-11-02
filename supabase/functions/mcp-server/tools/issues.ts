import { createSupabaseClient, validateOrganizationAccess } from '../lib/supabase.ts';
import { 
  ListIssuesSchema, 
  GetIssueDetailsSchema, 
  CreateIssueSchema, 
  UpdateIssueRootCauseSchema,
  UpdateIssueWorkflowSchema 
} from '../lib/schemas.ts';
import { logToolInvocation, createSuccessResponse, createErrorResponse, formatError } from '../lib/utils.ts';

export async function listIssues(params: any) {
  const validatedParams = ListIssuesSchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('list_issues', validatedParams.organization_id, undefined, validatedParams);

    // Build query
    let query = supabase
      .from('issues')
      .select(`
        id,
        description,
        issue_type,
        status,
        workflow_status,
        context_type,
        context_id,
        reported_at,
        reported_by,
        assigned_to,
        root_cause,
        ai_analysis,
        next_steps,
        is_misuse,
        materials_needed
      `)
      .eq('organization_id', validatedParams.organization_id)
      .order('reported_at', { ascending: false })
      .limit(validatedParams.limit);

    // Apply filters
    if (validatedParams.status) {
      query = query.eq('status', validatedParams.status);
    }
    if (validatedParams.context_type) {
      query = query.eq('context_type', validatedParams.context_type);
    }
    if (validatedParams.assigned_to) {
      query = query.eq('assigned_to', validatedParams.assigned_to);
    }
    if (validatedParams.date_from) {
      query = query.gte('reported_at', validatedParams.date_from);
    }
    if (validatedParams.date_to) {
      query = query.lte('reported_at', validatedParams.date_to);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error listing issues:', error);
      return createErrorResponse('Failed to list issues', 'DATABASE_ERROR');
    }

    return createSuccessResponse({
      issues: data || [],
      count: data?.length || 0,
      filters_applied: {
        status: validatedParams.status,
        context_type: validatedParams.context_type,
        assigned_to: validatedParams.assigned_to,
        date_range: validatedParams.date_from && validatedParams.date_to ? 
          `${validatedParams.date_from} to ${validatedParams.date_to}` : undefined
      }
    });

  } catch (error) {
    console.error('Error in listIssues:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}

export async function getIssueDetails(params: any) {
  const validatedParams = GetIssueDetailsSchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('get_issue_details', validatedParams.organization_id, undefined, validatedParams);

    // Get issue details
    const { data: issue, error: issueError } = await supabase
      .from('issues')
      .select('*')
      .eq('id', validatedParams.issue_id)
      .eq('organization_id', validatedParams.organization_id)
      .single();

    if (issueError || !issue) {
      return createErrorResponse('Issue not found', 'NOT_FOUND');
    }

    // Get issue history
    const { data: history, error: historyError } = await supabase
      .from('issue_history')
      .select('*')
      .eq('issue_id', validatedParams.issue_id)
      .eq('organization_id', validatedParams.organization_id)
      .order('changed_at', { ascending: false });

    // Get related actions
    const { data: actions, error: actionsError } = await supabase
      .from('actions')
      .select(`
        id,
        title,
        description,
        status,
        assigned_to,
        created_at,
        completed_at
      `)
      .eq('linked_issue_id', validatedParams.issue_id)
      .eq('organization_id', validatedParams.organization_id)
      .order('created_at', { ascending: false });

    return createSuccessResponse({
      issue,
      history: history || [],
      related_actions: actions || [],
      metadata: {
        history_count: history?.length || 0,
        actions_count: actions?.length || 0
      }
    });

  } catch (error) {
    console.error('Error in getIssueDetails:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}

export async function createIssue(params: any) {
  const validatedParams = CreateIssueSchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('create_issue', validatedParams.organization_id, validatedParams.reported_by, validatedParams);

    // Create the issue
    const { data, error } = await supabase
      .from('issues')
      .insert({
        organization_id: validatedParams.organization_id,
        context_id: validatedParams.context_id,
        context_type: validatedParams.context_type,
        description: validatedParams.description,
        reported_by: validatedParams.reported_by,
        issue_type: validatedParams.issue_type,
        is_misuse: validatedParams.is_misuse,
        report_photo_urls: validatedParams.report_photo_urls,
        materials_needed: validatedParams.materials_needed,
        status: 'open',
        workflow_status: 'reported',
        responsibility_assigned: false
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating issue:', error);
      return createErrorResponse('Failed to create issue', 'DATABASE_ERROR');
    }

    return createSuccessResponse({
      issue: data,
      message: 'Issue created successfully'
    });

  } catch (error) {
    console.error('Error in createIssue:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}

export async function updateIssueRootCause(params: any) {
  const validatedParams = UpdateIssueRootCauseSchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('update_issue_root_cause', validatedParams.organization_id, validatedParams.updated_by, validatedParams);

    // Update the issue
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (validatedParams.root_cause !== undefined) {
      updateData.root_cause = validatedParams.root_cause;
    }
    if (validatedParams.ai_analysis !== undefined) {
      updateData.ai_analysis = validatedParams.ai_analysis;
    }
    if (validatedParams.next_steps !== undefined) {
      updateData.next_steps = validatedParams.next_steps;
    }

    const { data, error } = await supabase
      .from('issues')
      .update(updateData)
      .eq('id', validatedParams.issue_id)
      .eq('organization_id', validatedParams.organization_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating issue root cause:', error);
      return createErrorResponse('Failed to update issue root cause', 'DATABASE_ERROR');
    }

    return createSuccessResponse({
      issue: data,
      message: 'Issue root cause analysis updated successfully'
    });

  } catch (error) {
    console.error('Error in updateIssueRootCause:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}

export async function updateIssueWorkflow(params: any) {
  const validatedParams = UpdateIssueWorkflowSchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('update_issue_workflow', validatedParams.organization_id, validatedParams.updated_by, validatedParams);

    // Update the issue
    const updateData: any = {
      workflow_status: validatedParams.workflow_status,
      updated_at: new Date().toISOString()
    };

    if (validatedParams.assigned_to !== undefined) {
      updateData.assigned_to = validatedParams.assigned_to;
      updateData.responsibility_assigned = true;
    }

    const { data, error } = await supabase
      .from('issues')
      .update(updateData)
      .eq('id', validatedParams.issue_id)
      .eq('organization_id', validatedParams.organization_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating issue workflow:', error);
      return createErrorResponse('Failed to update issue workflow', 'DATABASE_ERROR');
    }

    // Log the workflow change in issue_history
    await supabase
      .from('issue_history')
      .insert({
        issue_id: validatedParams.issue_id,
        organization_id: validatedParams.organization_id,
        changed_by: validatedParams.updated_by,
        changed_at: new Date().toISOString(),
        field_changed: 'workflow_status',
        old_value: data.workflow_status,
        new_value: validatedParams.workflow_status,
        new_status: validatedParams.workflow_status,
        notes: `Workflow status updated to ${validatedParams.workflow_status}`
      });

    return createSuccessResponse({
      issue: data,
      message: 'Issue workflow updated successfully'
    });

  } catch (error) {
    console.error('Error in updateIssueWorkflow:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}
