const { getAuthorizerContext, buildOrganizationFilter, hasPermission } = require('/opt/nodejs/authorizerContext');
const { query } = require('/opt/nodejs/db');
const { escapeLiteral } = require('/opt/nodejs/sqlUtils');

async function queryJSON(sql) {
  return await query(sql);
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { httpMethod, path: rawPath } = event;
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,OPTIONS'
  };
  
  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  const path = rawPath.startsWith('/api/') ? rawPath.substring(4) : rawPath;
  console.log('🔍 History Lambda - Path:', path, 'Method:', httpMethod);
  
  const authContext = getAuthorizerContext(event);
  const organizationId = authContext.organization_id;
  const hasDataReadAll = hasPermission(authContext, 'data:read:all');
  
  try {
    // GET /history/tools/{id} - Tool history with observations
    if (httpMethod === 'GET' && path.match(/\/history\/tools\/[a-f0-9-]+$/)) {
      const toolId = path.split('/').pop();
      
      // Get asset info
      const assetSql = `SELECT created_at, updated_at FROM tools WHERE id::text = '${escapeLiteral(toolId)}';`;
      const assetResult = await queryJSON(assetSql);
      
      // Get checkouts
      const checkoutsSql = `SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) as json_agg FROM (
        SELECT 
          c.id::text,
          c.tool_id::text,
          c.user_id::text,
          c.checkout_date,
          c.expected_return_date,
          c.is_returned,
          c.intended_usage,
          c.notes,
          c.action_id::text,
          c.organization_id::text,
          c.created_at,
          COALESCE(om.full_name, 'Unknown User') as user_display_name
        FROM checkouts c
        LEFT JOIN organization_members om ON c.user_id::text = om.cognito_user_id::text
        WHERE c.tool_id::text = '${escapeLiteral(toolId)}'
        ORDER BY c.checkout_date DESC
      ) t;`;
      const checkoutsResult = await queryJSON(checkoutsSql);
      
      // Get issues
      const issuesSql = `SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) as json_agg FROM (
        SELECT 
          i.id::text,
          i.context_type,
          i.context_id::text,
          i.description,
          i.issue_type,
          i.status,
          i.workflow_status,
          i.reported_by::text,
          i.reported_at,
          i.resolved_at,
          i.resolved_by::text,
          i.organization_id::text,
          i.created_at,
          i.updated_at,
          COALESCE(om.full_name, i.reported_by::text) as reported_by_name
        FROM issues i
        LEFT JOIN organization_members om ON i.reported_by::text = om.cognito_user_id::text
        WHERE i.context_type = 'tool' AND i.context_id::text = '${escapeLiteral(toolId)}'
        ORDER BY i.reported_at DESC
      ) t;`;
      const issuesResult = await queryJSON(issuesSql);
      
      // Get actions
      const actionsSql = `SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) as json_agg FROM (
        SELECT 
          a.id::text,
          a.title,
          a.description,
          a.status,
          a.assigned_to::text,
          a.asset_id::text,
          a.mission_id::text,
          a.organization_id::text,
          a.created_by::text,
          a.created_at,
          a.updated_at,
          COALESCE(om.full_name, 'System') as created_by_name
        FROM actions a
        LEFT JOIN organization_members om ON a.created_by::text = om.cognito_user_id::text
        WHERE a.asset_id::text = '${escapeLiteral(toolId)}'
        ORDER BY a.created_at DESC
      ) t;`;
      const actionsResult = await queryJSON(actionsSql);
      
      // Get observations (states)
      const observationsSql = `SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) as json_agg FROM (
        SELECT 
          s.id::text,
          s.state_text as observation_text,
          s.captured_by::text as observed_by,
          s.captured_at as observed_at,
          s.created_at,
          COALESCE(om.full_name, s.captured_by::text) as observed_by_name,
          (
            SELECT json_agg(json_build_object(
              'id', sp.id,
              'photo_url', sp.photo_url,
              'photo_description', sp.photo_description
            ) ORDER BY sp.photo_order)
            FROM state_photos sp
            WHERE sp.state_id = s.id
          ) as photos
        FROM states s
        JOIN state_links sl ON sl.state_id = s.id
        LEFT JOIN organization_members om ON s.captured_by::text = om.cognito_user_id::text
        WHERE sl.entity_type = 'tool' AND sl.entity_id::text = '${escapeLiteral(toolId)}'
        ORDER BY s.captured_at DESC
      ) t;`;
      const observationsResult = await queryJSON(observationsSql);
      
      // Get asset history
      const assetHistorySql = `SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) as json_agg FROM (
        SELECT 
          ah.id::text,
          ah.change_type,
          ah.field_changed,
          ah.old_value,
          ah.new_value,
          ah.changed_at,
          ah.notes,
          COALESCE(om.full_name, 'System') as user_name
        FROM asset_history ah
        LEFT JOIN organization_members om ON ah.changed_by::text = om.cognito_user_id::text
        WHERE ah.asset_id::text = '${escapeLiteral(toolId)}'
        ORDER BY ah.changed_at DESC
      ) t;`;
      const assetHistoryResult = await queryJSON(assetHistorySql);
      
      // Build timeline
      const asset = assetResult?.[0];
      const checkouts = checkoutsResult?.[0]?.json_agg || [];
      const issues = issuesResult?.[0]?.json_agg || [];
      const actions = actionsResult?.[0]?.json_agg || [];
      const observations = observationsResult?.[0]?.json_agg || [];
      const assetHistory = assetHistoryResult?.[0]?.json_agg || [];
      
      const timeline = [];
      
      assetHistory.forEach(ah => {
        const desc = ah.field_changed 
          ? `${ah.user_name} updated ${ah.field_changed}${ah.old_value && ah.new_value ? ` (${ah.old_value} → ${ah.new_value})` : ''}`
          : `${ah.user_name} ${ah.change_type === 'created' ? 'created asset' : 'updated asset'}`;
        timeline.push({
          type: 'asset_change',
          timestamp: ah.changed_at,
          description: desc,
          data: ah
        });
      });
      
      if (assetHistory.length === 0 && asset) {
        timeline.push({
          type: 'asset_created',
          timestamp: asset.created_at,
          description: 'Asset created'
        });
      }
      
      checkouts.forEach(c => {
        timeline.push({
          type: 'checkout',
          timestamp: c.checkout_date || c.created_at,
          description: `Checked out by ${c.user_display_name}`,
          data: c
        });
      });
      
      issues.forEach(i => {
        timeline.push({
          type: 'issue_reported',
          timestamp: i.reported_at,
          description: `Issue reported by ${i.reported_by_name}`,
          data: i
        });
        if (i.resolved_at) {
          timeline.push({
            type: 'issue_resolved',
            timestamp: i.resolved_at,
            description: 'Issue resolved'
          });
        }
      });
      
      actions.forEach(a => {
        timeline.push({
          type: 'action_created',
          timestamp: a.created_at,
          description: `Action: ${a.title}`,
          data: a
        });
      });
      
      observations.forEach(o => {
        timeline.push({
          type: 'observation',
          timestamp: o.observed_at,
          description: `Observation by ${o.observed_by_name}`,
          data: o
        });
      });
      
      timeline.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          data: {
            asset: asset || null,
            checkouts,
            issues,
            actions,
            observations,
            timeline
          }
        })
      };
    }
    
    // GET /history/parts/{id} - Part history with observations
    if (httpMethod === 'GET' && path.match(/\/history\/parts\/[a-f0-9-]+$/)) {
      const partId = path.split('/').pop();
      
      // Get parts history
      let whereConditions = [];
      if (!hasDataReadAll && organizationId) {
        whereConditions.push(`ph.organization_id::text = '${escapeLiteral(organizationId)}'`);
      }
      whereConditions.push(`ph.part_id::text = '${escapeLiteral(partId)}'`);
      
      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
      
      const partHistorySql = `SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) as json_agg FROM (
        SELECT 
          ph.*,
          COALESCE(om.full_name, ph.changed_by::text) as changed_by_name
        FROM parts_history ph
        LEFT JOIN organization_members om ON ph.changed_by::text = om.cognito_user_id::text
        ${whereClause} 
        ORDER BY ph.changed_at DESC 
        LIMIT 100
      ) t;`;
      const partHistoryResult = await queryJSON(partHistorySql);
      
      // Get observations for part (states)
      const observationsSql = `SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) as json_agg FROM (
        SELECT 
          s.id::text,
          s.state_text as observation_text,
          s.captured_by::text as observed_by,
          s.captured_at as observed_at,
          s.created_at,
          COALESCE(om.full_name, s.captured_by::text) as observed_by_name,
          (
            SELECT json_agg(json_build_object(
              'id', sp.id,
              'photo_url', sp.photo_url,
              'photo_description', sp.photo_description
            ) ORDER BY sp.photo_order)
            FROM state_photos sp
            WHERE sp.state_id = s.id
          ) as photos
        FROM states s
        JOIN state_links sl ON sl.state_id = s.id
        LEFT JOIN organization_members om ON s.captured_by::text = om.cognito_user_id::text
        WHERE sl.entity_type = 'part' AND sl.entity_id::text = '${escapeLiteral(partId)}'
        ORDER BY s.captured_at DESC
      ) t;`;
      const observationsResult = await queryJSON(observationsSql);
      
      // Get issues for part
      const issuesSql = `SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) as json_agg FROM (
        SELECT 
          i.id::text,
          i.description,
          i.status,
          i.reported_by::text,
          i.reported_at,
          i.resolved_at,
          COALESCE(om.full_name, i.reported_by::text) as reported_by_name
        FROM issues i
        LEFT JOIN organization_members om ON i.reported_by::text = om.cognito_user_id::text
        WHERE i.context_type = 'part' AND i.context_id::text = '${escapeLiteral(partId)}'
        ORDER BY i.reported_at DESC
      ) t;`;
      const issuesResult = await queryJSON(issuesSql);
      
      // Get actions for part
      const actionsSql = `SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) as json_agg FROM (
        SELECT 
          a.id::text,
          a.title,
          a.status,
          a.created_at,
          COALESCE(om.full_name, 'System') as created_by_name
        FROM actions a
        LEFT JOIN organization_members om ON a.created_by::text = om.cognito_user_id::text
        WHERE a.asset_id::text = '${escapeLiteral(partId)}'
        ORDER BY a.created_at DESC
      ) t;`;
      const actionsResult = await queryJSON(actionsSql);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          data: {
            history: partHistoryResult?.[0]?.json_agg || [],
            observations: observationsResult?.[0]?.json_agg || [],
            issues: issuesResult?.[0]?.json_agg || [],
            actions: actionsResult?.[0]?.json_agg || []
          }
        })
      };
    }
    
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
