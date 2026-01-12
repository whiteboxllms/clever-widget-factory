const { Client } = require('pg');
const { getAuthorizerContext, buildOrganizationFilter } = require('./shared/authorizerContext');

// Database configuration
// SECURITY: Password must be provided via environment variable
if (!process.env.DB_PASSWORD) {
  throw new Error('DB_PASSWORD environment variable is required');
}

const dbConfig = {
  host: process.env.DB_HOST || 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

// Helper to execute SQL and return JSON
async function queryJSON(sql) {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    const result = await client.query(sql);
    return result.rows;
  } finally {
    await client.end();
  }
}

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { httpMethod, path, queryStringParameters } = event;
  const authContext = getAuthorizerContext(event);
  const accessibleOrgIds = authContext.accessible_organization_ids || [];
  
  if (accessibleOrgIds.length === 0) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: 'Organization access context not available' })
    };
  }
  
  try {
    // CORS headers
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
    };

    // Handle preflight requests for all paths
    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        body: ''
      };
    }

    // My actions endpoint - filter by Cognito user ID
    if (httpMethod === 'GET' && path.includes('/my-actions')) {
      const { cognitoUserId } = queryStringParameters || {};
      if (!cognitoUserId) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'cognitoUserId parameter required' })
        };
      }

      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT 
          a.*,
          om.full_name as assigned_to_name,
          CASE WHEN scores.action_id IS NOT NULL THEN true ELSE false END as has_score,
          CASE WHEN updates.action_id IS NOT NULL THEN true ELSE false END as has_implementation_updates
        FROM actions a
        LEFT JOIN organization_members om ON a.assigned_to = om.user_id
        LEFT JOIN action_scores scores ON a.id = scores.action_id
        LEFT JOIN (
          SELECT DISTINCT action_id 
          FROM action_implementation_updates
          WHERE update_type != 'policy_agreement' OR update_type IS NULL
        ) updates ON a.id = updates.action_id
        WHERE om.cognito_user_id = '${cognitoUserId}'
        ORDER BY a.created_at DESC
      ) t;`;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
      };
    }

    // Action implementation updates endpoint
    if (httpMethod === 'GET' && path.endsWith('/action_implementation_updates')) {
      const { action_id, limit = 50 } = queryStringParameters || {};
      
      if (!action_id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'action_id parameter required' })
        };
      }
      
      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT * FROM action_implementation_updates 
        WHERE action_id = '${action_id}' 
        ORDER BY created_at DESC 
        LIMIT ${limit}
      ) t;`;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
      };
    }

    // DELETE action
    if (httpMethod === 'DELETE' && path.includes('/actions/')) {
      const actionId = path.split('/actions/')[1];
      const orgFilter = buildOrganizationFilter(authContext, 'actions');
      const sql = `DELETE FROM actions WHERE id = '${actionId}' ${orgFilter.condition ? 'AND ' + orgFilter.condition : ''} RETURNING id`;
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result[0] })
      };
    }

    // PUT action by ID (update via path parameter)
    if (httpMethod === 'PUT' && path.includes('/actions/')) {
      const actionId = path.split('/actions/')[1].split('/')[0]; // Extract ID, handle trailing slashes
      const body = JSON.parse(event.body || '{}');
      const { created_by, updated_by, updated_at, completed_at, is_exploration, exploration_code, ...actionData } = body;
      
      const userId = updated_by || authContext.cognito_user_id || require('crypto').randomUUID();
      const orgId = accessibleOrgIds[0];
      
      // Get current action state before update
      const orgFilter = buildOrganizationFilter(authContext, 'actions');
      const currentActionSql = `SELECT * FROM actions WHERE id = '${actionId}' ${orgFilter.condition ? 'AND ' + orgFilter.condition : ''}`;
      const currentActionResult = await queryJSON(currentActionSql);
      
      if (!currentActionResult || currentActionResult.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Action not found' })
        };
      }
      
      const currentAction = currentActionResult[0];
      const oldTools = currentAction.required_tools || [];
      const newTools = actionData.required_tools || oldTools;
      const actionStatus = actionData.status || currentAction.status;
      const assignedTo = actionData.assigned_to || currentAction.assigned_to;
      
      const updates = [];
      for (const [key, val] of Object.entries(actionData)) {
        if (val === undefined) continue;
        if (val === null) updates.push(`${key} = NULL`);
        else if (typeof val === 'string') updates.push(`${key} = '${val.replace(/'/g, "''")}'`);
        else if (typeof val === 'boolean') updates.push(`${key} = ${val}`);
        else if (Array.isArray(val)) {
          if (key === 'participants') {
            updates.push(`${key} = ARRAY[${val.map(v => `'${v}'`).join(',')}]::uuid[]`);
          } else if (key === 'required_tools' || key === 'attachments') {
            if (val.length === 0) {
              updates.push(`${key} = ARRAY[]::text[]`);
            } else {
              updates.push(`${key} = ARRAY[${val.map(v => `'${v.replace(/'/g, "''")}'`).join(',')}]::text[]`);
            }
          } else {
            updates.push(`${key} = '${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`);
          }
        } else if (typeof val === 'object') updates.push(`${key} = '${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`);
        else updates.push(`${key} = ${val}`);
      }
      
      // Handle is_exploration flag
      if (is_exploration !== undefined) {
        updates.push(`is_exploration = ${is_exploration}`);
      }
      
      updates.push(`updated_by = '${userId}'`);
      if (completed_at) updates.push(`completed_at = '${completed_at}'`);
      
      const sql = `UPDATE actions SET ${updates.join(', ')}, updated_at = NOW() WHERE id = '${actionId}' ${orgFilter.condition ? 'AND ' + orgFilter.condition : ''} RETURNING *`;
      const result = await queryJSON(sql);
      // Handle exploration record if is_exploration is true
      // Note: Exploration records are created/updated via separate API endpoint
      // This prevents database constraint violations during action updates
      
      // Manage checkouts based on required_tools changes
      if (actionStatus === 'in_progress') {
        const addedTools = newTools.filter(t => !oldTools.includes(t));
        const removedTools = oldTools.filter(t => !newTools.includes(t));
        
        // Check if status changed to 'in_progress' (need to checkout all tools, not just newly added)
        const statusChangedToInProgress = currentAction.status !== 'in_progress' && actionStatus === 'in_progress';
        
        // If status changed to in_progress, checkout ALL tools in required_tools
        // Otherwise, only checkout newly added tools
        const toolsToCheckout = statusChangedToInProgress ? newTools : addedTools;
        
        // Parallelize checkout creation
        const checkoutPromises = toolsToCheckout.map(async (toolId) => {
          // Check if tool already has active checkout (for any action)
          const existingCheckoutSql = `SELECT id FROM checkouts WHERE tool_id = '${toolId}' AND is_returned = false LIMIT 1`;
          const existingCheckout = await queryJSON(existingCheckoutSql);
          
          if (existingCheckout && existingCheckout.length > 0) {
            // Tool already checked out - check if it's for this action
            const actionCheckoutSql = `SELECT id FROM checkouts WHERE tool_id = '${toolId}' AND action_id = '${actionId}' AND is_returned = false LIMIT 1`;
            const actionCheckout = await queryJSON(actionCheckoutSql);
            
            if (actionCheckout && actionCheckout.length > 0) {
              // Already checked out for this action, skip
              return;
            }
            // Tool checked out for different action - skip (don't create duplicate)
            return;
          }
          
          // Create checkout for this tool
          const checkoutId = require('crypto').randomUUID();
          const checkoutSql = `INSERT INTO checkouts (id, tool_id, user_id, action_id, checkout_date, is_returned, organization_id, created_at) VALUES ('${checkoutId}', '${toolId}', '${assignedTo}', '${actionId}', NOW(), false, '${orgId}', NOW())`;
          await queryJSON(checkoutSql);
        });
        
        // Parallelize checkout deletion for removed tools
        const deletePromises = removedTools.map(async (toolId) => {
          const deleteSql = `DELETE FROM checkouts WHERE tool_id = '${toolId}' AND action_id = '${actionId}' AND is_returned = false`;
          await queryJSON(deleteSql);
        });
        
        // Execute all checkout operations in parallel
        await Promise.all([...checkoutPromises, ...deletePromises]);
      }
      
      // If action completed, create checkins and mark checkouts as returned
      if (actionStatus === 'completed' && currentAction.status !== 'completed') {
        // Get all unreturned checkouts for this action
        const checkoutsSql = `SELECT id, tool_id, user_id FROM checkouts WHERE action_id = '${actionId}' AND is_returned = false`;
        const checkouts = await queryJSON(checkoutsSql);
        
        // Parallelize checkin creation
        const checkinPromises = checkouts.map(async (checkout) => {
          const checkinId = require('crypto').randomUUID();
          const checkinSql = `INSERT INTO checkins (id, checkout_id, tool_id, user_id, checkin_date, checkin_reason, notes, organization_id, created_at) VALUES ('${checkinId}', '${checkout.id}', '${checkout.tool_id}', '${checkout.user_id}', NOW(), 'Action completed', 'Automatically checked in when action was completed', '${orgId}', NOW())`;
          await queryJSON(checkinSql);
        });
        
        // Execute checkin creation and checkout update in parallel
        await Promise.all([
          ...checkinPromises,
          queryJSON(`UPDATE checkouts SET is_returned = true WHERE action_id = '${actionId}' AND is_returned = false`)
        ]);
      }
      
      // Query affected tools with checkout state
      const affectedToolIds = [...new Set([...oldTools, ...newTools])];
      let affectedTools = [];
      if (affectedToolIds.length > 0) {
        const toolsSql = `
          SELECT 
            t.id, t.name,
            CASE 
              WHEN c.id IS NOT NULL THEN 'checked_out'
              ELSE t.status
            END as status,
            CASE WHEN c.id IS NOT NULL THEN true ELSE false END as is_checked_out,
            c.user_id as checked_out_user_id,
            om.full_name as checked_out_to,
            c.checkout_date as checked_out_date
          FROM tools t
          LEFT JOIN LATERAL (
            SELECT * FROM checkouts
            WHERE checkouts.tool_id = t.id AND checkouts.is_returned = false
            ORDER BY checkouts.checkout_date DESC LIMIT 1
          ) c ON true
          LEFT JOIN organization_members om ON c.user_id = om.cognito_user_id
          WHERE t.id IN (${affectedToolIds.map(id => `'${id}'`).join(',')})
        `;
        affectedTools = await queryJSON(toolsSql);
      }
      
      return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify({ 
          data: result[0],
          affectedResources: {
            tools: affectedTools
          }
        }) 
      };
    }

    // POST/PUT action (create/update)
    if ((httpMethod === 'POST' || httpMethod === 'PUT') && path.endsWith('/actions')) {
      const body = JSON.parse(event.body || '{}');
      const { id, created_by, updated_by, updated_at, completed_at, is_exploration, exploration_code, ...actionData } = body;
      
      const userId = created_by || updated_by || require('crypto').randomUUID();
      
      if (id) {
        // Update
        const updates = [];
        for (const [key, val] of Object.entries(actionData)) {
          if (val === undefined) continue;
          if (val === null) updates.push(`${key} = NULL`);
          else if (typeof val === 'string') updates.push(`${key} = '${val.replace(/'/g, "''")}'`);
          else if (typeof val === 'boolean') updates.push(`${key} = ${val}`);
          else if (Array.isArray(val)) {
            if (key === 'participants') {
              updates.push(`${key} = ARRAY[${val.map(v => `'${v}'`).join(',')}]::uuid[]`);
            } else if (key === 'required_tools' || key === 'attachments') {
              updates.push(`${key} = ARRAY[${val.map(v => `'${v.replace(/'/g, "''")}'`).join(',')}]::text[]`);
            } else {
              updates.push(`${key} = '${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`);
            }
          } else if (typeof val === 'object') updates.push(`${key} = '${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`);
          else updates.push(`${key} = ${val}`);
        }
        
        // Handle is_exploration flag
        if (is_exploration !== undefined) {
          updates.push(`is_exploration = ${is_exploration}`);
        }
        
        updates.push(`updated_by = '${userId}'`);
        if (completed_at) updates.push(`completed_at = '${completed_at}'`);
        
        const sql = `UPDATE actions SET ${updates.join(', ')}, updated_at = NOW() WHERE id = '${id}' RETURNING *`;
        const result = await queryJSON(sql);
        
        return { statusCode: 200, headers, body: JSON.stringify({ data: result[0] }) };
      } else {
        // Create
        const uuid = require('crypto').randomUUID();
        const orgId = accessibleOrgIds[0]; // Use first accessible org
        const fields = ['id', 'created_by', 'updated_by', 'organization_id', ...Object.keys(actionData)];
        const values = [`'${uuid}'`, `'${userId}'`, `'${userId}'`, `'${orgId}'`];
        
        for (const [key, val] of Object.entries(actionData)) {
          if (val === null) {
            values.push('NULL');
          } else if (typeof val === 'string') {
            values.push(`'${val.replace(/'/g, "''")}'`);
          } else if (typeof val === 'boolean') {
            values.push(val);
          } else if (Array.isArray(val)) {
            if (key === 'participants') {
              values.push(`ARRAY[${val.map(v => `'${v}'`).join(',')}]::uuid[]`);
            } else if (key === 'required_tools' || key === 'attachments') {
              if (val.length === 0) {
                values.push(`ARRAY[]::text[]`);
              } else {
                values.push(`ARRAY[${val.map(v => `'${v.replace(/'/g, "''")}'`).join(',')}]::text[]`);
              }
            } else {
              values.push(`'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`);
            }
          } else if (typeof val === 'object') {
            values.push(`'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`);
          } else {
            values.push(val);
          }
        }
        
        // Handle is_exploration flag
        if (is_exploration !== undefined) {
          fields.push('is_exploration');
          values.push(is_exploration);
        }
        
        const sql = `INSERT INTO actions (${fields.join(', ')}, created_at, updated_at) VALUES (${values.join(', ')}, NOW(), NOW()) RETURNING *`;
        const result = await queryJSON(sql);
        const newAction = result[0];
        
        // If action is created with status 'in_progress' and has required_tools, create checkouts
        if (newAction.status === 'in_progress' && newAction.required_tools && newAction.required_tools.length > 0) {
          const assignedTo = newAction.assigned_to || userId;
          const checkoutPromises = newAction.required_tools.map(async (toolId) => {
            // Check if tool already has active checkout
            const existingCheckoutSql = `SELECT id FROM checkouts WHERE tool_id = '${toolId}' AND is_returned = false LIMIT 1`;
            const existingCheckout = await queryJSON(existingCheckoutSql);
            
            if (existingCheckout && existingCheckout.length > 0) {
              // Tool already checked out, skip
              return;
            }
            
            // Create checkout for this tool
            const checkoutId = require('crypto').randomUUID();
            const checkoutSql = `INSERT INTO checkouts (id, tool_id, user_id, action_id, checkout_date, is_returned, organization_id, created_at) VALUES ('${checkoutId}', '${toolId}', '${assignedTo}', '${newAction.id}', NOW(), false, '${orgId}', NOW())`;
            await queryJSON(checkoutSql);
          });
          
          // Execute checkout creation in parallel
          await Promise.all(checkoutPromises);
        }
        
        return { statusCode: 201, headers, body: JSON.stringify({ data: newAction }) };
      }
    }

    // Exploration code validation endpoints
    if (httpMethod === 'GET' && path.includes('/explorations/check-code/')) {
      const code = decodeURIComponent(path.split('/explorations/check-code/')[1]);
      const sql = `SELECT EXISTS(SELECT 1 FROM exploration WHERE exploration_code = '${code.replace(/'/g, "''")}'::text) as exists`;
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ exists: result[0]?.exists || false })
      };
    }

    // Get exploration codes by prefix
    if (httpMethod === 'GET' && path.includes('/explorations/codes-by-prefix/')) {
      const prefix = decodeURIComponent(path.split('/explorations/codes-by-prefix/')[1]);
      const sql = `SELECT exploration_code FROM exploration WHERE exploration_code LIKE '${prefix.replace(/'/g, "''")}%' ORDER BY exploration_code`;
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ codes: result.map(r => r.exploration_code) || [] })
      };
    }

    // Actions endpoint
    if (httpMethod === 'GET' && path.endsWith('/actions')) {
      const { limit, offset = 0, assigned_to, status, linked_issue_id, asset_id } = queryStringParameters || {};
      
      const orgFilter = buildOrganizationFilter(authContext, 'a');
      let whereConditions = [];
      if (orgFilter.condition) whereConditions.push(orgFilter.condition);
      if (assigned_to) {
        whereConditions.push(`a.assigned_to = '${assigned_to.replace(/'/g, "''")}'`);
      }
      if (status) {
        if (status === 'unresolved') {
          whereConditions.push(`a.status IN ('not_started', 'in_progress', 'blocked')`);
        } else {
          whereConditions.push(`a.status = '${status.replace(/'/g, "''")}'`);
        }
      }
      if (linked_issue_id) {
        whereConditions.push(`a.linked_issue_id = '${linked_issue_id.replace(/'/g, "''")}'`);
      }
      if (asset_id) {
        whereConditions.push(`a.asset_id = '${asset_id.replace(/'/g, "''")}'`);
      }
      
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      const limitClause = limit ? `LIMIT ${limit} OFFSET ${offset}` : '';
      
      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT 
          a.*,
          om.full_name as assigned_to_name,
          om.favorite_color as assigned_to_color,
          CASE WHEN scores.action_id IS NOT NULL THEN true ELSE false END as has_score,
          CASE WHEN updates.action_id IS NOT NULL THEN true ELSE false END as has_implementation_updates,
          COALESCE((
            SELECT COUNT(*) 
            FROM action_implementation_updates aiu 
            WHERE aiu.action_id = a.id
          ), 0) as implementation_update_count,
          CASE WHEN a.asset_id IS NOT NULL THEN
            json_build_object('id', t.id, 'name', t.name, 'category', t.category)
          ELSE NULL END as asset
        FROM actions a
        LEFT JOIN profiles om ON a.assigned_to = om.user_id
        LEFT JOIN action_scores scores ON a.id = scores.action_id
        LEFT JOIN (
          SELECT DISTINCT action_id 
          FROM action_implementation_updates
          WHERE update_type != 'policy_agreement' OR update_type IS NULL
        ) updates ON a.id = updates.action_id
        LEFT JOIN tools t ON a.asset_id = t.id
        ${whereClause} 
        ORDER BY a.created_at DESC 
        ${limitClause}
      ) t;`;
      
      console.log('Executing SQL:', sql);
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
      };
    }

    // Default 404
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message })
    };
  }
};