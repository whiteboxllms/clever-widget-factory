import { createSupabaseClient, validateOrganizationAccess } from '../lib/supabase.ts';
import { 
  ListOrganizationMembersSchema, 
  GetMemberAttributesSchema 
} from '../lib/schemas.ts';
import { logToolInvocation, createSuccessResponse, createErrorResponse, formatError } from '../lib/utils.ts';

export async function listOrganizationMembers(params: any) {
  const validatedParams = ListOrganizationMembersSchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('list_organization_members', validatedParams.organization_id, undefined, validatedParams);

    // Build query
    let query = supabase
      .from('organization_members')
      .select(`
        id,
        user_id,
        full_name,
        role,
        is_active,
        super_admin,
        created_at,
        invited_by
      `)
      .eq('organization_id', validatedParams.organization_id)
      .eq('is_active', validatedParams.is_active)
      .order('full_name', { ascending: true });

    // Apply role filter if specified
    if (validatedParams.role) {
      query = query.eq('role', validatedParams.role);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error listing organization members:', error);
      return createErrorResponse('Failed to list organization members', 'DATABASE_ERROR');
    }

    // Get additional member attributes for each member
    const membersWithAttributes = await Promise.all(
      (data || []).map(async (member) => {
        // Get worker attributes
        const { data: attributes } = await supabase
          .from('worker_attributes')
          .select('attribute_type, level, earned_at')
          .eq('user_id', member.user_id)
          .eq('organization_id', validatedParams.organization_id);

        // Get strategic attributes
        const { data: strategicAttributes } = await supabase
          .from('worker_strategic_attributes')
          .select('attribute_type, level, earned_at')
          .eq('user_id', member.user_id)
          .eq('organization_id', validatedParams.organization_id);

        return {
          ...member,
          technical_attributes: attributes || [],
          strategic_attributes: strategicAttributes || [],
          total_attributes: (attributes?.length || 0) + (strategicAttributes?.length || 0)
        };
      })
    );

    return createSuccessResponse({
      members: membersWithAttributes,
      count: membersWithAttributes.length,
      filters_applied: {
        role: validatedParams.role,
        is_active: validatedParams.is_active
      },
      summary: {
        total_members: membersWithAttributes.length,
        super_admins: membersWithAttributes.filter(m => m.super_admin).length,
        by_role: membersWithAttributes.reduce((acc, member) => {
          acc[member.role] = (acc[member.role] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      }
    });

  } catch (error) {
    console.error('Error in listOrganizationMembers:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}

export async function getMemberAttributes(params: any) {
  const validatedParams = GetMemberAttributesSchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('get_member_attributes', validatedParams.organization_id, undefined, validatedParams);

    // Get member basic info
    const { data: member, error: memberError } = await supabase
      .from('organization_members')
      .select(`
        id,
        user_id,
        full_name,
        role,
        is_active,
        super_admin,
        created_at
      `)
      .eq('user_id', validatedParams.user_id)
      .eq('organization_id', validatedParams.organization_id)
      .single();

    if (memberError || !member) {
      return createErrorResponse('Member not found', 'NOT_FOUND');
    }

    // Get technical attributes
    const { data: technicalAttributes, error: techError } = await supabase
      .from('worker_attributes')
      .select(`
        attribute_type,
        level,
        earned_at,
        created_at,
        updated_at
      `)
      .eq('user_id', validatedParams.user_id)
      .eq('organization_id', validatedParams.organization_id)
      .order('level', { ascending: false });

    // Get strategic attributes
    const { data: strategicAttributes, error: strategicError } = await supabase
      .from('worker_strategic_attributes')
      .select(`
        attribute_type,
        level,
        earned_at,
        created_at,
        updated_at
      `)
      .eq('user_id', validatedParams.user_id)
      .eq('organization_id', validatedParams.organization_id)
      .order('level', { ascending: false });

    // Get recent performance records
    const { data: recentPerformance, error: perfError } = await supabase
      .from('worker_performance')
      .select(`
        id,
        attributes_used,
        hours_worked,
        outcome,
        completed_at,
        supervisor_notes
      `)
      .eq('user_id', validatedParams.user_id)
      .eq('organization_id', validatedParams.organization_id)
      .order('completed_at', { ascending: false })
      .limit(10);

    // Calculate skill summary
    const skillSummary = {
      technical_skills: (technicalAttributes || []).reduce((acc, attr) => {
        acc[attr.attribute_type] = Math.max(acc[attr.attribute_type] || 0, attr.level || 0);
        return acc;
      }, {} as Record<string, number>),
      strategic_skills: (strategicAttributes || []).reduce((acc, attr) => {
        acc[attr.attribute_type] = Math.max(acc[attr.attribute_type] || 0, attr.level || 0);
        return acc;
      }, {} as Record<string, number>),
      total_technical_levels: (technicalAttributes || []).reduce((sum, attr) => sum + (attr.level || 0), 0),
      total_strategic_levels: (strategicAttributes || []).reduce((sum, attr) => sum + (attr.level || 0), 0),
      average_technical_level: technicalAttributes?.length ? 
        (technicalAttributes.reduce((sum, attr) => sum + (attr.level || 0), 0) / technicalAttributes.length) : 0,
      average_strategic_level: strategicAttributes?.length ? 
        (strategicAttributes.reduce((sum, attr) => sum + (attr.level || 0), 0) / strategicAttributes.length) : 0
    };

    return createSuccessResponse({
      member,
      technical_attributes: technicalAttributes || [],
      strategic_attributes: strategicAttributes || [],
      recent_performance: recentPerformance || [],
      skill_summary: skillSummary,
      metadata: {
        technical_attributes_count: technicalAttributes?.length || 0,
        strategic_attributes_count: strategicAttributes?.length || 0,
        performance_records_count: recentPerformance?.length || 0,
        total_skill_levels: skillSummary.total_technical_levels + skillSummary.total_strategic_levels
      }
    });

  } catch (error) {
    console.error('Error in getMemberAttributes:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}
