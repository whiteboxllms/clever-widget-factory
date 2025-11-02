import { createSupabaseClient, validateOrganizationAccess } from '../lib/supabase.ts';
import { 
  QueryToolsAssetsSchema, 
  GetSopForAssetSchema 
} from '../lib/schemas.ts';
import { logToolInvocation, createSuccessResponse, createErrorResponse, formatError, buildSearchQuery } from '../lib/utils.ts';

export async function queryToolsAssets(params: any) {
  const validatedParams = QueryToolsAssetsSchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('query_tools_assets', validatedParams.organization_id, undefined, validatedParams);

    // Build query
    let query = supabase
      .from('tools')
      .select(`
        id,
        name,
        description,
        category,
        status,
        storage_location,
        actual_location,
        serial_number,
        has_motor,
        known_issues,
        last_audited_at,
        last_maintenance,
        image_url,
        manual_url,
        accountable_person_id
      `)
      .eq('organization_id', validatedParams.organization_id)
      .order('name', { ascending: true })
      .limit(validatedParams.limit);

    // Apply filters
    if (validatedParams.search_term) {
      query = query.or(`name.ilike.%${validatedParams.search_term}%,description.ilike.%${validatedParams.search_term}%,serial_number.ilike.%${validatedParams.search_term}%`);
    }
    if (validatedParams.category) {
      query = query.eq('category', validatedParams.category);
    }
    if (validatedParams.status) {
      query = query.eq('status', validatedParams.status);
    }
    if (validatedParams.storage_location) {
      query = query.eq('storage_location', validatedParams.storage_location);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error querying tools/assets:', error);
      return createErrorResponse('Failed to query tools/assets', 'DATABASE_ERROR');
    }

    // Add additional metadata
    const toolsWithMetadata = (data || []).map(tool => ({
      ...tool,
      needs_attention: tool.status === 'needs_attention' || tool.status === 'under_repair',
      is_available: tool.status === 'available',
      has_issues: !!tool.known_issues,
      maintenance_overdue: tool.last_maintenance ? 
        new Date(tool.last_maintenance) < new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) : false
    }));

    return createSuccessResponse({
      tools: toolsWithMetadata,
      count: toolsWithMetadata.length,
      filters_applied: {
        search_term: validatedParams.search_term,
        category: validatedParams.category,
        status: validatedParams.status,
        storage_location: validatedParams.storage_location
      },
      summary: {
        total_tools: toolsWithMetadata.length,
        available_count: toolsWithMetadata.filter(t => t.is_available).length,
        needs_attention_count: toolsWithMetadata.filter(t => t.needs_attention).length,
        has_issues_count: toolsWithMetadata.filter(t => t.has_issues).length,
        maintenance_overdue_count: toolsWithMetadata.filter(t => t.maintenance_overdue).length
      }
    });

  } catch (error) {
    console.error('Error in queryToolsAssets:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}

export async function getSopForAsset(params: any) {
  const validatedParams = GetSopForAssetSchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('get_sop_for_asset', validatedParams.organization_id, undefined, validatedParams);

    // Get asset details including SOP
    const { data: asset, error: assetError } = await supabase
      .from('tools')
      .select(`
        id,
        name,
        description,
        category,
        status,
        stargazer_sop,
        manual_url,
        known_issues,
        last_audited_at,
        last_maintenance
      `)
      .eq('id', validatedParams.asset_id)
      .eq('organization_id', validatedParams.organization_id)
      .single();

    if (assetError || !asset) {
      return createErrorResponse('Asset not found', 'NOT_FOUND');
    }

    // Get recent checkouts/checkins for context
    const { data: recentActivity, error: activityError } = await supabase
      .from('checkouts')
      .select(`
        id,
        checkout_date,
        user_name,
        intended_usage,
        is_returned,
        notes
      `)
      .eq('tool_id', validatedParams.asset_id)
      .eq('organization_id', validatedParams.organization_id)
      .order('checkout_date', { ascending: false })
      .limit(5);

    // Get recent issues for this asset
    const { data: recentIssues, error: issuesError } = await supabase
      .from('issues')
      .select(`
        id,
        description,
        issue_type,
        status,
        workflow_status,
        reported_at,
        root_cause
      `)
      .eq('context_id', validatedParams.asset_id)
      .eq('context_type', 'tool')
      .eq('organization_id', validatedParams.organization_id)
      .order('reported_at', { ascending: false })
      .limit(5);

    return createSuccessResponse({
      asset: {
        ...asset,
        has_sop: !!asset.stargazer_sop,
        has_manual: !!asset.manual_url,
        has_issues: !!asset.known_issues
      },
      sop_content: asset.stargazer_sop || null,
      manual_url: asset.manual_url || null,
      recent_activity: recentActivity || [],
      recent_issues: recentIssues || [],
      metadata: {
        activity_count: recentActivity?.length || 0,
        issues_count: recentIssues?.length || 0,
        last_audit: asset.last_audited_at,
        last_maintenance: asset.last_maintenance
      }
    });

  } catch (error) {
    console.error('Error in getSopForAsset:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}
