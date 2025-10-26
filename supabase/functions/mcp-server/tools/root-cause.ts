import { createSupabaseClient, validateOrganizationAccess } from '../lib/supabase.ts';
import { 
  LogFiveWhysStepSchema, 
  GetRelatedIssuesSchema, 
  SuggestResponsiblePartySchema 
} from '../lib/schemas.ts';
import { logToolInvocation, createSuccessResponse, createErrorResponse, formatError } from '../lib/utils.ts';

export async function logFiveWhysStep(params: any) {
  const validatedParams = LogFiveWhysStepSchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('log_five_whys_step', validatedParams.organization_id, validatedParams.logged_by, validatedParams);

    // Get current issue to update the ai_analysis field
    const { data: issue, error: issueError } = await supabase
      .from('issues')
      .select('id, ai_analysis')
      .eq('id', validatedParams.issue_id)
      .eq('organization_id', validatedParams.organization_id)
      .single();

    if (issueError || !issue) {
      return createErrorResponse('Issue not found', 'NOT_FOUND');
    }

    // Parse existing ai_analysis or create new structure
    let analysisData: any = {};
    try {
      analysisData = issue.ai_analysis ? JSON.parse(issue.ai_analysis) : {};
    } catch (e) {
      analysisData = {};
    }

    // Ensure five_whys structure exists
    if (!analysisData.five_whys) {
      analysisData.five_whys = {};
    }

    // Add the new step
    analysisData.five_whys[`step_${validatedParams.step_number}`] = {
      question: validatedParams.question,
      answer: validatedParams.answer,
      logged_at: new Date().toISOString(),
      logged_by: validatedParams.logged_by
    };

    // Update the issue with the new analysis data
    const { data: updatedIssue, error: updateError } = await supabase
      .from('issues')
      .update({
        ai_analysis: JSON.stringify(analysisData),
        updated_at: new Date().toISOString()
      })
      .eq('id', validatedParams.issue_id)
      .eq('organization_id', validatedParams.organization_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating issue with five whys step:', updateError);
      return createErrorResponse('Failed to log five whys step', 'DATABASE_ERROR');
    }

    return createSuccessResponse({
      step_logged: {
        step_number: validatedParams.step_number,
        question: validatedParams.question,
        answer: validatedParams.answer,
        logged_at: analysisData.five_whys[`step_${validatedParams.step_number}`].logged_at
      },
      current_analysis: analysisData,
      message: `Five Whys step ${validatedParams.step_number} logged successfully`
    });

  } catch (error) {
    console.error('Error in logFiveWhysStep:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}

export async function getRelatedIssues(params: any) {
  const validatedParams = GetRelatedIssuesSchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('get_related_issues', validatedParams.organization_id, undefined, validatedParams);

    // Get the current issue for comparison
    const { data: currentIssue, error: currentError } = await supabase
      .from('issues')
      .select('description, issue_type, context_type, context_id, root_cause')
      .eq('id', validatedParams.issue_id)
      .eq('organization_id', validatedParams.organization_id)
      .single();

    if (currentError || !currentIssue) {
      return createErrorResponse('Current issue not found', 'NOT_FOUND');
    }

    // Find similar issues based on multiple criteria
    const { data: similarIssues, error: similarError } = await supabase
      .from('issues')
      .select(`
        id,
        description,
        issue_type,
        context_type,
        context_id,
        root_cause,
        status,
        workflow_status,
        reported_at,
        resolved_at,
        ai_analysis
      `)
      .eq('organization_id', validatedParams.organization_id)
      .neq('id', validatedParams.issue_id) // Exclude current issue
      .order('reported_at', { ascending: false })
      .limit(validatedParams.limit * 2); // Get more to filter by similarity

    if (similarError) {
      console.error('Error finding similar issues:', similarError);
      return createErrorResponse('Failed to find similar issues', 'DATABASE_ERROR');
    }

    // Calculate similarity scores and filter
    const issuesWithSimilarity = (similarIssues || []).map(issue => {
      let similarityScore = 0;
      let reasons: string[] = [];

      // Check issue type similarity
      if (issue.issue_type === currentIssue.issue_type) {
        similarityScore += 0.3;
        reasons.push('Same issue type');
      }

      // Check context type similarity
      if (issue.context_type === currentIssue.context_type) {
        similarityScore += 0.2;
        reasons.push('Same context type');
      }

      // Check context ID similarity (same asset/tool)
      if (issue.context_id === currentIssue.context_id) {
        similarityScore += 0.4;
        reasons.push('Same asset/tool');
      }

      // Check root cause similarity (if both have root causes)
      if (issue.root_cause && currentIssue.root_cause) {
        const rootCauseWords = currentIssue.root_cause.toLowerCase().split(' ');
        const issueRootCauseWords = issue.root_cause.toLowerCase().split(' ');
        const commonWords = rootCauseWords.filter(word => 
          issueRootCauseWords.includes(word) && word.length > 3
        );
        if (commonWords.length > 0) {
          similarityScore += 0.1 * (commonWords.length / rootCauseWords.length);
          reasons.push(`Similar root cause (${commonWords.length} common words)`);
        }
      }

      // Check description similarity (simple keyword matching)
      const currentWords = currentIssue.description.toLowerCase().split(' ').filter(w => w.length > 3);
      const issueWords = issue.description.toLowerCase().split(' ').filter(w => w.length > 3);
      const commonDescWords = currentWords.filter(word => issueWords.includes(word));
      if (commonDescWords.length > 0) {
        similarityScore += 0.1 * (commonDescWords.length / currentWords.length);
        reasons.push(`Similar description (${commonDescWords.length} common words)`);
      }

      return {
        ...issue,
        similarity_score: similarityScore,
        similarity_reasons: reasons
      };
    })
    .filter(issue => issue.similarity_score >= validatedParams.similarity_threshold)
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, validatedParams.limit);

    return createSuccessResponse({
      current_issue: {
        id: validatedParams.issue_id,
        description: currentIssue.description,
        issue_type: currentIssue.issue_type,
        context_type: currentIssue.context_type,
        context_id: currentIssue.context_id
      },
      related_issues: issuesWithSimilarity,
      count: issuesWithSimilarity.length,
      similarity_threshold: validatedParams.similarity_threshold,
      summary: {
        total_candidates: similarIssues?.length || 0,
        above_threshold: issuesWithSimilarity.length,
        average_similarity: issuesWithSimilarity.length > 0 ? 
          issuesWithSimilarity.reduce((sum, issue) => sum + issue.similarity_score, 0) / issuesWithSimilarity.length : 0
      }
    });

  } catch (error) {
    console.error('Error in getRelatedIssues:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}

export async function suggestResponsibleParty(params: any) {
  const validatedParams = SuggestResponsiblePartySchema.parse(params);
  const supabase = createSupabaseClient();
  
  try {
    // Validate organization access
    const hasAccess = await validateOrganizationAccess(supabase, validatedParams.organization_id);
    if (!hasAccess) {
      return createErrorResponse('Organization not found or inactive');
    }

    logToolInvocation('suggest_responsible_party', validatedParams.organization_id, undefined, validatedParams);

    // Get issue details
    const { data: issue, error: issueError } = await supabase
      .from('issues')
      .select('description, issue_type, context_type, context_id, root_cause')
      .eq('id', validatedParams.issue_id)
      .eq('organization_id', validatedParams.organization_id)
      .single();

    if (issueError || !issue) {
      return createErrorResponse('Issue not found', 'NOT_FOUND');
    }

    // Get all active organization members with their attributes
    const { data: members, error: membersError } = await supabase
      .from('organization_members')
      .select(`
        user_id,
        full_name,
        role,
        is_active
      `)
      .eq('organization_id', validatedParams.organization_id)
      .eq('is_active', true);

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return createErrorResponse('Failed to fetch organization members', 'DATABASE_ERROR');
    }

    // Get attributes for all members
    const membersWithAttributes = await Promise.all(
      (members || []).map(async (member) => {
        // Get technical attributes
        const { data: technicalAttrs } = await supabase
          .from('worker_attributes')
          .select('attribute_type, level')
          .eq('user_id', member.user_id)
          .eq('organization_id', validatedParams.organization_id);

        // Get strategic attributes
        const { data: strategicAttrs } = await supabase
          .from('worker_strategic_attributes')
          .select('attribute_type, level')
          .eq('user_id', member.user_id)
          .eq('organization_id', validatedParams.organization_id);

        return {
          ...member,
          technical_attributes: technicalAttrs || [],
          strategic_attributes: strategicAttrs || []
        };
      })
    );

    // Score members based on relevance
    const scoredMembers = membersWithAttributes.map(member => {
      let score = 0;
      let reasons: string[] = [];

      // Role-based scoring
      if (member.role === 'admin' || member.role === 'supervisor') {
        score += 0.3;
        reasons.push(`Leadership role: ${member.role}`);
      }

      // Technical skill matching
      if (validatedParams.required_skills && validatedParams.required_skills.length > 0) {
        const memberTechSkills = member.technical_attributes.map(attr => attr.attribute_type);
        const matchingSkills = validatedParams.required_skills.filter(skill => 
          memberTechSkills.includes(skill as any)
        );
        if (matchingSkills.length > 0) {
          score += 0.4 * (matchingSkills.length / validatedParams.required_skills.length);
          reasons.push(`Has required skills: ${matchingSkills.join(', ')}`);
        }
      }

      // Context-specific scoring
      if (validatedParams.context_type === 'tool') {
        const mechanicalLevel = member.technical_attributes.find(attr => 
          attr.attribute_type === 'mechanical'
        )?.level || 0;
        if (mechanicalLevel > 0) {
          score += 0.2 * (mechanicalLevel / 5); // Assuming max level is 5
          reasons.push(`Mechanical skills (level ${mechanicalLevel})`);
        }
      }

      // Strategic attribute scoring
      const problemSolvingLevel = member.strategic_attributes.find(attr => 
        attr.attribute_type === 'root_cause_problem_solving'
      )?.level || 0;
      if (problemSolvingLevel > 0) {
        score += 0.1 * (problemSolvingLevel / 5);
        reasons.push(`Problem solving skills (level ${problemSolvingLevel})`);
      }

      return {
        ...member,
        assignment_score: score,
        assignment_reasons: reasons,
        total_technical_levels: member.technical_attributes.reduce((sum, attr) => sum + (attr.level || 0), 0),
        total_strategic_levels: member.strategic_attributes.reduce((sum, attr) => sum + (attr.level || 0), 0)
      };
    })
    .filter(member => member.assignment_score > 0)
    .sort((a, b) => b.assignment_score - a.assignment_score);

    // Get top 3 suggestions
    const topSuggestions = scoredMembers.slice(0, 3);

    return createSuccessResponse({
      issue_context: {
        issue_id: validatedParams.issue_id,
        context_type: validatedParams.context_type,
        required_skills: validatedParams.required_skills || []
      },
      suggestions: topSuggestions,
      total_candidates: scoredMembers.length,
      summary: {
        highest_score: topSuggestions[0]?.assignment_score || 0,
        average_score: topSuggestions.length > 0 ? 
          topSuggestions.reduce((sum, member) => sum + member.assignment_score, 0) / topSuggestions.length : 0,
        skill_distribution: {
          with_technical_skills: scoredMembers.filter(m => m.total_technical_levels > 0).length,
          with_strategic_skills: scoredMembers.filter(m => m.total_strategic_levels > 0).length,
          leadership_roles: scoredMembers.filter(m => m.role === 'admin' || m.role === 'supervisor').length
        }
      }
    });

  } catch (error) {
    console.error('Error in suggestResponsibleParty:', error);
    return createErrorResponse(formatError(error), 'VALIDATION_ERROR');
  }
}
