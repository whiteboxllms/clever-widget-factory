const { Client } = require('pg');
const { randomUUID } = require('crypto');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { getAuthorizerContext, buildOrganizationFilter, hasPermission, canAccessOrganization } = require('./shared/authorizerContext');

const sqs = new SQSClient({ region: 'us-west-2' });
const EMBEDDINGS_QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/131745734428/cwf-embeddings-queue';

// Database configuration
const dbConfig = {
  host: 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

const escapeLiteral = (value = '') => String(value).replace(/'/g, "''");

const formatSqlValue = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    if (value.length === 0) return 'ARRAY[]::text[]';
    const sanitizedItems = value.map((item) => `'${escapeLiteral(String(item))}'`);
    return `ARRAY[${sanitizedItems.join(', ')}]`;
  }
  if (typeof value === 'object') {
    return `'${escapeLiteral(JSON.stringify(value))}'::jsonb`;
  }
  return `'${escapeLiteral(String(value))}'`;
};

const buildUpdateClauses = (body, allowedFields) => {
  return allowedFields.reduce((clauses, field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      clauses.push(`${field} = ${formatSqlValue(body[field])}`);
    }
    return clauses;
  }, []);
};

// Helper to execute SQL and return JSON
async function queryJSON(sql) {
  const client = new Client(dbConfig);
  try {
    await client.connect();
    const result = await client.query(sql);
    return result.rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  } finally {
    await client.end();
  }
}



exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { httpMethod, path: rawPath } = event;
  
  // CORS headers (define early for all responses including OPTIONS)
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  };
  
  // Handle preflight OPTIONS requests immediately - no authorization needed
  if (httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }
  
  // Normalize path - strip /api prefix if present (API Gateway may include it)
  const path = rawPath.startsWith('/api/') ? rawPath.substring(4) : rawPath;
  console.log('🔍 Path received:', path);
  console.log('🔍 HTTP Method:', httpMethod);
  
  // Extract authorizer context (organization_id, permissions, etc.)
  const authContext = getAuthorizerContext(event);
  const organizationId = authContext.organization_id;
  const hasDataReadAll = hasPermission(authContext, 'data:read:all');
  
  // Log error if organization_id is missing - don't use fallback to hide problems
  if (!organizationId) {
    console.error('❌ ERROR: organization_id is missing from authorizer context!');
    console.error('   This indicates a problem with the Lambda authorizer configuration.');
    console.error('   Authorizer context:', JSON.stringify(authContext, null, 2));
    console.error('   Event requestContext:', JSON.stringify(event.requestContext, null, 2));
  }
  
  // Set accessibleOrgIds from authContext (may be empty for some endpoints like profiles)
  const accessibleOrgIds = authContext.accessible_organization_ids || [];
  
  console.log('Authorizer context:', {
    organization_id: organizationId || 'MISSING',
    accessible_orgs: accessibleOrgIds,
    accessible_orgs_count: accessibleOrgIds.length,
    has_data_read_all: hasDataReadAll,
    permissions: authContext.permissions
  });
  
  try {

    // Health check endpoint
    if (httpMethod === 'GET' && path.endsWith('/health')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() })
      };
    }

    // Schema endpoint
    if (httpMethod === 'GET' && path.endsWith('/schema')) {
      const schema = {
        version: 1,
        tables: {
          actions: ['id', 'title', 'description', 'assigned_to', 'status', 'created_at', 'updated_at'],
          tools: ['id', 'name', 'description', 'category', 'status', 'serial_number', 'storage_location'],
          parts: ['id', 'name', 'description', 'category', 'current_quantity', 'minimum_quantity'],
          organization_members: ['user_id', 'full_name', 'role'],
          missions: ['id', 'title', 'description', 'created_by', 'created_at', 'updated_at']
        },
        last_updated: Date.now()
      };
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(schema)
      };
    }



    // Tools endpoint
    if (path.endsWith('/tools') || path.match(/\/tools\/[a-f0-9-]+$/)) {
      if (httpMethod === 'POST' && path.endsWith('/tools')) {
        const body = JSON.parse(event.body || '{}');
        if (!body.name) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'name is required' })
          };
        }
        
        const toolId = randomUUID();
        const userId = authContext.cognito_user_id;
        
        const insertSql = `
          INSERT INTO tools (
            id, name, description, category, status, serial_number,
            parent_structure_id, storage_location, legacy_storage_vicinity,
            accountable_person_id, image_url, organization_id, created_at, updated_at
          ) VALUES (
            '${toolId}',
            ${formatSqlValue(body.name)},
            ${formatSqlValue(body.description)},
            ${formatSqlValue(body.category)},
            ${formatSqlValue(body.status || 'available')},
            ${formatSqlValue(body.serial_number)},
            ${formatSqlValue(body.parent_structure_id)},
            ${formatSqlValue(body.storage_location)},
            ${formatSqlValue(body.legacy_storage_vicinity)},
            ${formatSqlValue(body.accountable_person_id)},
            ${formatSqlValue(body.image_url)},
            ${formatSqlValue(organizationId)},
            NOW(),
            NOW()
          ) RETURNING *`;
        
        const result = await queryJSON(insertSql);
        
        // Log creation to asset_history
        if (userId && organizationId) {
          console.log('📝 Logging asset creation:', { toolId, userId, organizationId });
          const historySql = `INSERT INTO asset_history (asset_id, change_type, changed_by, organization_id, changed_at) VALUES ('${toolId}', 'created', '${userId}', '${organizationId}', NOW())`;
          await queryJSON(historySql).catch(e => console.error('History log error:', e));
        }
        
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
      
      if (httpMethod === 'PUT') {
        const toolId = path.split('/').pop();
        const body = JSON.parse(event.body || '{}');
        const updates = buildUpdateClauses(body, [
          'status',
          'actual_location',
          'storage_location',
          'legacy_storage_vicinity',
          'name',
          'description',
          'category',
          'serial_number',
          'accountable_person_id',
          'image_url'
        ]);
        if (updates.length === 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'No fields to update' })
          };
        }
        updates.push('updated_at = NOW()');
        const sql = `UPDATE tools SET ${updates.join(', ')} WHERE id = '${toolId}' RETURNING *`;
        const result = await queryJSON(sql);
        
        // Log to asset_history
        const userId = authContext.cognito_user_id;
        if (userId && organizationId) {
          console.log('📝 Logging asset update:', { toolId, userId, organizationId });
          const fields = Object.keys(body).filter(k => ['status','actual_location','storage_location','name','description','category','serial_number'].includes(k));
          for (const field of fields) {
            const historySql = `INSERT INTO asset_history (asset_id, change_type, field_changed, new_value, changed_by, organization_id, changed_at) VALUES ('${toolId}', 'updated', '${field}', ${formatSqlValue(body[field])}, '${userId}', '${organizationId}', NOW())`;
            await queryJSON(historySql).catch(e => console.error('History log error:', e));
          }
        }
        
        // Trigger embedding regeneration if name or description changed
        if (body.name !== undefined || body.description !== undefined) {
          const tool = result[0];
          const searchText = `${tool.name || ''} - ${tool.description || ''}`;
          try {
            await sqs.send(new SendMessageCommand({
              QueueUrl: EMBEDDINGS_QUEUE_URL,
              MessageBody: JSON.stringify({
                id: toolId,
                table: 'tools',
                text: searchText
              })
            }));
            console.log('Sent embedding update to SQS for tool:', toolId);
          } catch (sqsError) {
            console.error('Failed to send SQS message:', sqsError.message);
          }
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
      
      if (httpMethod === 'GET') {
        const { limit = 50, offset = 0, category, status } = event.queryStringParameters || {};
        
        // Build WHERE clauses for filtering
        const whereClauses = [];
        
        // Add organization filter
        const orgFilter = buildOrganizationFilter(authContext, 'tools');
        if (orgFilter.condition) {
          whereClauses.push(orgFilter.condition);
        }
        
        // Handle category filter (supports comma-separated values like "Infrastructure,Container")
        if (category) {
          const categories = category.split(',').map(c => c.trim()).filter(c => c.length > 0);
          if (categories.length === 1) {
            whereClauses.push(`tools.category = ${formatSqlValue(categories[0])}`);
          } else if (categories.length > 1) {
            const categoryValues = categories.map(c => formatSqlValue(c)).join(', ');
            whereClauses.push(`tools.category IN (${categoryValues})`);
          }
        }
        
        // Handle status filter (supports "!removed" or "!=removed" syntax)
        if (status) {
          if (status === '!removed' || status === '!=removed') {
            whereClauses.push(`tools.status != 'removed'`);
          } else {
            whereClauses.push(`tools.status = ${formatSqlValue(status)}`);
          }
        }
        
        const whereClause = whereClauses.length > 0 
          ? `WHERE ${whereClauses.join(' AND ')}`
          : '';
        
        const sql = `SELECT json_agg(row_to_json(result)) FROM (
          SELECT DISTINCT ON (tools.id)
            tools.id, tools.name, tools.description, tools.category,
            tools.actual_location, tools.serial_number, tools.last_maintenance,
            tools.manual_url, tools.known_issues, tools.has_motor, tools.stargazer_sop,
            tools.storage_location, tools.last_audited_at, tools.audit_status,
            tools.parent_structure_id, tools.organization_id, tools.accountable_person_id,
            tools.created_at, tools.updated_at,
            parent_tool.name as parent_structure_name,
            parent_tool.name as area_display,
            CASE 
              WHEN active_checkouts.id IS NOT NULL THEN 'checked_out'
              ELSE tools.status
            END as status,
            CASE WHEN tools.image_url LIKE '%supabase.co%' THEN 
              REPLACE(
                tools.image_url, 
                'https://oskwnlhuuxjfuwnjuavn.supabase.co/storage/v1/object/public/', 
                'https://cwf-dev-assets.s3.us-west-2.amazonaws.com/'
              )
            ELSE tools.image_url 
            END as image_url,
            CASE WHEN active_checkouts.id IS NOT NULL THEN true ELSE false END as is_checked_out,
            active_checkouts.user_id as checked_out_user_id,
            active_checkouts.user_name as checked_out_to,
            active_checkouts.checkout_date as checked_out_date,
            active_checkouts.expected_return_date,
            active_checkouts.intended_usage as checkout_intended_usage,
            active_checkouts.notes as checkout_notes
          FROM tools
          LEFT JOIN tools parent_tool ON tools.parent_structure_id = parent_tool.id
          LEFT JOIN LATERAL (
            SELECT * FROM checkouts
            WHERE checkouts.tool_id = tools.id
              AND checkouts.is_returned = false
            ORDER BY checkouts.checkout_date DESC NULLS LAST, checkouts.created_at DESC
            LIMIT 1
          ) active_checkouts ON true
          ${whereClause}
          ORDER BY tools.id, tools.name 
          LIMIT ${limit} OFFSET ${offset}
        ) result;`;
        
        console.log('🔍 Tools GET SQL Query:');
        console.log('WHERE clause:', whereClause);
        console.log('SQL:', sql.substring(0, 500) + '...');
        
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
        };
      }
    }

    // Parts endpoint
    // POST /parts - Create new part
    if (httpMethod === 'POST' && path.endsWith('/parts')) {
      const body = JSON.parse(event.body || '{}');
      if (!body.name) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'name is required' })
        };
      }
      
      const partId = randomUUID();
      const sql = `
        INSERT INTO parts (
          id, name, description, category, current_quantity, minimum_quantity,
          unit, parent_structure_id, storage_location, legacy_storage_vicinity,
          accountable_person_id, image_url, organization_id, sellable, cost_per_unit,
          created_at, updated_at
        ) VALUES (
          '${partId}',
          ${formatSqlValue(body.name)},
          ${formatSqlValue(body.description)},
          ${formatSqlValue(body.category)},
          ${body.current_quantity || 0},
          ${body.minimum_quantity || 0},
          ${formatSqlValue(body.unit)},
          ${formatSqlValue(body.parent_structure_id)},
          ${formatSqlValue(body.storage_location)},
          ${formatSqlValue(body.legacy_storage_vicinity)},
          ${formatSqlValue(body.accountable_person_id)},
          ${formatSqlValue(body.image_url)},
          ${formatSqlValue(organizationId)},
          ${body.sellable !== undefined ? body.sellable : false},
          ${body.cost_per_unit !== undefined ? body.cost_per_unit : 'NULL'},
          NOW(),
          NOW()
        ) RETURNING *
      `;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ data: result[0] })
      };
    }
    
    // DELETE /parts/{id} - Delete part
    if (httpMethod === 'DELETE' && path.match(/\/parts\/[^/]+$/)) {
      const partId = path.split('/').pop();
      
      const sql = `
        DELETE FROM parts 
        WHERE id = '${escapeLiteral(partId)}'
        RETURNING *;
      `;
      
      const result = await queryJSON(sql);
      if (!result || result.length === 0 || !result[0]) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Part not found' })
        };
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result[0] })
      };
    }
    
    // PUT /parts/{id} - Update part (check this first before the GET /parts)
    if (httpMethod === 'PUT' && path.match(/\/parts\/[^/]+$/)) {
      const partId = path.split('/').pop();
      const body = JSON.parse(event.body || '{}');
      
      const updates = [];
      if (body.current_quantity !== undefined) {
        updates.push(`current_quantity = ${body.current_quantity}`);
      }
      if (body.name !== undefined) {
        updates.push(`name = ${formatSqlValue(body.name)}`);
      }
      if (body.description !== undefined) {
        updates.push(`description = ${formatSqlValue(body.description)}`);
      }
      if (body.category !== undefined) {
        updates.push(`category = ${formatSqlValue(body.category)}`);
      }
      if (body.minimum_quantity !== undefined) {
        updates.push(`minimum_quantity = ${body.minimum_quantity}`);
      }
      if (body.unit !== undefined) {
        updates.push(`unit = ${formatSqlValue(body.unit)}`);
      }
      if (body.cost_per_unit !== undefined) {
        updates.push(`cost_per_unit = ${body.cost_per_unit}`);
      }
      if (body.parent_structure_id !== undefined) {
        updates.push(`parent_structure_id = ${formatSqlValue(body.parent_structure_id)}`);
      }
      if (body.storage_location !== undefined) {
        updates.push(`storage_location = ${formatSqlValue(body.storage_location)}`);
      }
      if (body.accountable_person_id !== undefined) {
        updates.push(`accountable_person_id = ${formatSqlValue(body.accountable_person_id)}`);
      }
      if (body.image_url !== undefined) {
        updates.push(`image_url = ${formatSqlValue(body.image_url)}`);
      }
      if (body.sellable !== undefined) {
        updates.push(`sellable = ${formatSqlValue(body.sellable)}`);
      }
      
      if (updates.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'No fields to update' })
        };
      }
      
      updates.push('updated_at = NOW()');
      
      const sql = `
        UPDATE parts 
        SET ${updates.join(', ')} 
        WHERE id = '${escapeLiteral(partId)}'
        RETURNING *;
      `;
      
      const result = await queryJSON(sql);
      if (!result || result.length === 0 || !result[0]) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Not found' })
        };
      }
      
      // Trigger embedding regeneration if name or description changed
      if (body.name !== undefined || body.description !== undefined) {
        const part = result[0];
        const searchText = `${part.name || ''} - ${part.description || ''}`;
        try {
          await sqs.send(new SendMessageCommand({
            QueueUrl: EMBEDDINGS_QUEUE_URL,
            MessageBody: JSON.stringify({
              id: partId,
              table: 'parts',
              text: searchText
            })
          }));
          console.log('Sent embedding update to SQS for part:', partId);
        } catch (sqsError) {
          console.error('Failed to send SQS message:', sqsError.message);
        }
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result[0] })
      };
    }
    
    // GET /parts/sellable - List sellable parts only
    if (path.endsWith('/parts/sellable') && httpMethod === 'GET') {
      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT 
          parts.id, parts.name, parts.description, parts.category, 
          parts.current_quantity, parts.minimum_quantity, parts.cost_per_unit,
          parts.unit, parts.sellable,
          CASE 
            WHEN parts.image_url LIKE '%supabase.co%' THEN 
              REPLACE(parts.image_url, 'https://oskwnlhuuxjfuwnjuavn.supabase.co/storage/v1/object/public/', 'https://cwf-dev-assets.s3.us-west-2.amazonaws.com/')
            ELSE parts.image_url 
          END as image_url,
          parts.created_at, parts.updated_at 
        FROM parts
        WHERE parts.sellable = true 
          AND parts.current_quantity > 0
          AND (parts.cost_per_unit > 0 OR parts.description ILIKE '%free%' OR parts.description ILIKE '%customer%')
        ORDER BY parts.name
      ) t;`;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
      };
    }

    // GET /parts/sellable - List sellable parts only
    if (path.endsWith('/parts/sellable') && httpMethod === 'GET') {
      const { limit = 50, offset = 0 } = event.queryStringParameters || {};
      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT 
          parts.id, parts.name, parts.description, parts.category, 
          parts.current_quantity, parts.minimum_quantity, parts.cost_per_unit,
          parts.unit, parts.parent_structure_id, parts.storage_location, 
          parts.accountable_person_id, parts.sellable,
          parent_tool.name as parent_structure_name,
          parent_tool.name as area_display,
          CASE 
            WHEN parts.image_url LIKE '%supabase.co%' THEN 
              REPLACE(parts.image_url, 'https://oskwnlhuuxjfuwnjuavn.supabase.co/storage/v1/object/public/', 'https://cwf-dev-assets.s3.us-west-2.amazonaws.com/')
            ELSE parts.image_url 
          END as image_url,
          parts.created_at, parts.updated_at 
        FROM parts
        LEFT JOIN tools parent_tool ON parts.parent_structure_id = parent_tool.id
        WHERE parts.sellable = true
        ORDER BY parts.name 
        LIMIT ${limit} OFFSET ${offset}
      ) t;`;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
      };
    }
    
    // GET /parts - List parts
    if (path.endsWith('/parts') && httpMethod === 'GET') {
      const { limit = 50, offset = 0 } = event.queryStringParameters || {};
      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT 
          parts.id, parts.name, parts.description, parts.category, 
          parts.current_quantity, parts.minimum_quantity, parts.cost_per_unit,
          parts.unit, parts.parent_structure_id, parts.storage_location, 
          parts.accountable_person_id, parts.sellable,
          parent_tool.name as parent_structure_name,
          parent_tool.name as area_display,
          CASE 
            WHEN parts.image_url LIKE '%supabase.co%' THEN 
              REPLACE(parts.image_url, 'https://oskwnlhuuxjfuwnjuavn.supabase.co/storage/v1/object/public/', 'https://cwf-dev-assets.s3.us-west-2.amazonaws.com/')
            ELSE parts.image_url 
          END as image_url,
          parts.created_at, parts.updated_at 
        FROM parts
        LEFT JOIN tools parent_tool ON parts.parent_structure_id = parent_tool.id
        ORDER BY parts.name 
        LIMIT ${limit} OFFSET ${offset}
      ) t;`;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
      };
    }
    
    // Parts history endpoint
    if (path.endsWith('/parts_history')) {
      if (httpMethod === 'GET') {
        const { part_id, change_type, changed_by, limit = 100 } = event.queryStringParameters || {};
        let whereConditions = [];
        
        // Always filter by organization from authorizer context (unless user has data:read:all permission)
        if (!hasDataReadAll && organizationId) {
          whereConditions.push(`ph.organization_id::text = '${escapeLiteral(organizationId)}'`);
        }
        
        if (part_id) {
          // Cast both sides to ensure type compatibility
          // If part_id column is UUID, cast the parameter. If it's TEXT, cast the column.
          // Try casting the parameter first: 'value'::uuid
          whereConditions.push(`ph.part_id::text = '${escapeLiteral(part_id)}'`);
        }
        if (change_type) {
          whereConditions.push(`ph.change_type = '${escapeLiteral(change_type)}'`);
        }
        if (changed_by) {
          whereConditions.push(`ph.changed_by = '${escapeLiteral(changed_by)}'`);
        }
        
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        const limitClause = `LIMIT ${parseInt(limit)}`;
        
        const sql = `SELECT json_agg(row_to_json(t)) FROM (
          SELECT 
            ph.*,
            COALESCE(om.full_name, ph.changed_by::text) as changed_by_name
          FROM parts_history ph
          LEFT JOIN organization_members om ON ph.changed_by::text = om.cognito_user_id::text
          ${whereClause} ORDER BY ph.changed_at DESC ${limitClause}
        ) t;`;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
        };
      }
      
      if (httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}');
        const { part_id, change_type, old_quantity, new_quantity, quantity_change, change_reason } = body;
        
        if (!part_id || change_type === undefined || old_quantity === undefined || new_quantity === undefined) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'part_id, change_type, old_quantity, and new_quantity are required' })
          };
        }
        
        if (!organizationId) {
          console.error('❌ ERROR: Cannot create parts_history entry - organization_id is missing from authorizer context');
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server configuration error: organization context not available' })
          };
        }
        
        const userId = authContext.cognito_user_id;
        if (!userId) {
          console.error('❌ ERROR: Cannot create parts_history entry - cognito_user_id is missing from authorizer context');
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server configuration error: user context not available' })
          };
        }
        
        const sql = `
          INSERT INTO parts_history (
            part_id, change_type, old_quantity, new_quantity, quantity_change, 
            changed_by, change_reason, organization_id, changed_at, created_at
          )
          VALUES (
            ${formatSqlValue(part_id)},
            ${formatSqlValue(change_type)},
            ${old_quantity},
            ${new_quantity},
            ${quantity_change !== undefined ? quantity_change : 'NULL'},
            ${formatSqlValue(userId)},
            ${formatSqlValue(change_reason)},
            ${formatSqlValue(organizationId)},
            NOW(),
            NOW()
          )
          RETURNING *;
        `;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
    }

    // Issues collection endpoint
    if (path.endsWith('/issues')) {
      if (httpMethod === 'GET') {
        const { context_type, context_id, status } = event.queryStringParameters || {};
        let whereConditions = [];
        
        // Always filter by organization
        if (!hasDataReadAll && organizationId) {
          whereConditions.push(`organization_id::text = '${escapeLiteral(organizationId)}'`);
        }
        
        if (context_type) whereConditions.push(`context_type = '${context_type}'`);
        if (context_id) whereConditions.push(`context_id = '${escapeLiteral(context_id)}'`);
        if (status) {
          if (status.includes(',')) {
            const statuses = status.split(',').map(s => `'${s}'`).join(',');
            whereConditions.push(`status IN (${statuses})`);
          } else {
            whereConditions.push(`status = '${status}'`);
          }
        }
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        
        const sql = `SELECT json_agg(row_to_json(t)) FROM (
          SELECT * FROM issues ${whereClause} ORDER BY reported_at DESC
        ) t;`;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
        };
      }

      if (httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}');
        const requiredFields = ['context_id', 'description', 'reported_by'];
        const missing = requiredFields.filter(field => !body[field]);
        if (missing.length > 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: `Missing required fields: ${missing.join(', ')}` })
          };
        }

        // Always use organizationId from authorizer context (not from request body)
        if (!organizationId) {
          console.error('❌ ERROR: Cannot create issue - organization_id is missing from authorizer context');
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server configuration error: organization context not available' })
          };
        }
        const orgId = organizationId;

        const insertData = {
          context_type: body.context_type || 'tool',
          context_id: body.context_id,
          description: body.description,
          issue_type: body.issue_type || 'general',
          status: body.status || 'active',
          workflow_status: body.workflow_status || 'reported',
          reported_by: body.reported_by,
          organization_id: orgId,
          related_checkout_id: body.related_checkout_id || null,
          report_photo_urls: body.report_photo_urls || [],
          issue_metadata: body.issue_metadata || {},
          damage_assessment: body.damage_assessment || null,
          efficiency_loss_percentage: body.efficiency_loss_percentage ?? null,
          is_misuse: body.is_misuse ?? false,
          responsibility_assigned: body.responsibility_assigned ?? false,
          can_self_claim: body.can_self_claim ?? false,
          ready_to_work: body.ready_to_work ?? false,
          next_steps: body.next_steps || null,
          action_required: body.action_required || null,
          assigned_to: body.assigned_to || null,
          materials_needed: body.materials_needed || null,
          work_progress: body.work_progress || null,
          ai_analysis: body.ai_analysis || null
        };

        const columns = Object.keys(insertData);
        const values = columns.map((column) => formatSqlValue(insertData[column]));

        const sql = `
          INSERT INTO issues (${columns.join(', ')}, created_at, reported_at, updated_at)
          VALUES (${values.join(', ')}, NOW(), NOW(), NOW())
          RETURNING *;
        `;

        const result = await queryJSON(sql);
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
    }

    // Individual issue endpoint
    if (path.match(/\/issues\/[a-f0-9-]+$/)) {
      const issueId = path.split('/').pop();

      if (httpMethod === 'GET') {
        const sql = `SELECT * FROM issues WHERE id = '${issueId}' LIMIT 1;`;
        const result = await queryJSON(sql);
        return {
          statusCode: result?.length ? 200 : 404,
          headers,
          body: JSON.stringify(result?.length ? { data: result[0] } : { error: 'Issue not found' })
        };
      }

      if (httpMethod === 'PUT') {
        const body = JSON.parse(event.body || '{}');
        const updates = buildUpdateClauses(body, [
          'status',
          'workflow_status',
          'root_cause',
          'resolution_notes',
          'resolution_photo_urls',
          'issue_metadata',
          'damage_assessment',
          'report_photo_urls',
          'related_checkout_id',
          'description',
          'issue_type',
          'assigned_to',
          'ready_to_work',
          'responsibility_assigned',
          'action_required',
          'next_steps',
          'materials_needed',
          'work_progress',
          'ai_analysis',
          'actual_hours',
          'estimated_hours',
          'efficiency_loss_percentage',
          'is_misuse',
          'can_self_claim',
          'context_id',
          'context_type',
          'reported_by',
          'resolved_at',
          'resolved_by'
        ]);

        if (updates.length === 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'No fields to update' })
          };
        }

        updates.push('updated_at = NOW()');

        const sql = `UPDATE issues SET ${updates.join(', ')} WHERE id = '${issueId}' RETURNING *`;
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
    }

    // Issue history logging
    if (path.endsWith('/issue_history') && httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { issue_id, new_status } = body;
      if (!issue_id || !new_status) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'issue_id and new_status are required' })
        };
      }

      if (!organizationId) {
        console.error('❌ ERROR: Cannot create issue history - organization_id is missing from authorizer context');
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Server configuration error: organization context not available' })
        };
      }
      
      const userId = authContext.cognito_user_id;
      if (!userId) {
        console.error('❌ ERROR: Cannot create issue history - cognito_user_id is missing from authorizer context');
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: 'Server configuration error: user context not available' })
        };
      }
      
      const oldStatus = body.old_status ? `'${escapeLiteral(body.old_status)}'` : 'NULL';
      const notes = body.notes ? `'${escapeLiteral(body.notes)}'` : 'NULL';

      const sql = `
        INSERT INTO issue_history (issue_id, old_status, new_status, notes, organization_id, changed_by, changed_at, created_at)
        VALUES ('${issue_id}', ${oldStatus}, '${escapeLiteral(new_status)}', ${notes}, '${organizationId}', '${userId}', NOW(), NOW())
        RETURNING *;
      `;

      const result = await queryJSON(sql);
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ data: result[0] })
      };
    }

    // Parts orders endpoint
    if (httpMethod === 'GET' && path.endsWith('/parts_orders')) {
      const { status } = event.queryStringParameters || {};
      let whereConditions = [];
      
      // Always filter by organization
      if (!hasDataReadAll && organizationId) {
        whereConditions.push(`organization_id::text = '${escapeLiteral(organizationId)}'`);
      }
      
      if (status) {
        if (status.includes(',')) {
          const statuses = status.split(',').map(s => `'${s}'`).join(',');
          whereConditions.push(`status IN (${statuses})`);
        } else {
          whereConditions.push(`status = '${status}'`);
        }
      }
      
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      
      const sql = `SELECT json_agg(row_to_json(t)) FROM (
        SELECT * FROM parts_orders ${whereClause} ORDER BY ordered_at DESC
      ) t;`;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
      };
    }

    // Organization members endpoint
    if (path.endsWith('/organization_members')) {
      if (httpMethod === 'DELETE') {
        const { id } = event.queryStringParameters || {};
        if (!id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'id parameter required' })
          };
        }
        
        const sql = `DELETE FROM organization_members WHERE id = '${escapeLiteral(id)}' RETURNING *`;
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
      
      if (httpMethod === 'PUT') {
        const body = JSON.parse(event.body || '{}');
        const { id, role, is_active } = body;
        
        if (!id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'id required' })
          };
        }
        
        const updates = [];
        if (role !== undefined) updates.push(`role = '${escapeLiteral(role)}'`);
        if (is_active !== undefined) updates.push(`is_active = ${is_active}`);
        
        if (updates.length === 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'No fields to update' })
          };
        }
        
        const sql = `UPDATE organization_members SET ${updates.join(', ')} WHERE id = '${escapeLiteral(id)}' RETURNING *`;
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
      
      if (httpMethod === 'GET') {
        const { cognito_user_id } = event.queryStringParameters || {};
        const whereClauses = [];

        const membersOrgFilter = buildOrganizationFilter(authContext, 'organization_members');
        if (membersOrgFilter.condition) {
          whereClauses.push(membersOrgFilter.condition);
        }

        if (cognito_user_id) {
          whereClauses.push(`organization_members.cognito_user_id = '${escapeLiteral(cognito_user_id)}'`);
        }
        
        const whereClause = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const sql = `SELECT json_agg(row_to_json(t)) FROM (
          SELECT * FROM organization_members ${whereClause} ORDER BY created_at ASC
        ) t;`;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
        };
      }
      
      if (httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}');
        const { cognito_user_id, full_name } = body;
        
        if (!cognito_user_id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'cognito_user_id required' })
          };
        }
        
        // Update organization member full_name
        const sql = `
          UPDATE organization_members 
          SET full_name = '${full_name || ''}'
          WHERE cognito_user_id = '${cognito_user_id}'
          RETURNING *;
        `;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result })
        };
      }
    }

    // Organizations endpoint
    console.log('Checking organizations endpoint:', { path, httpMethod, endsWith: path.endsWith('/organizations') });
    if (path.endsWith('/organizations')) {
      if (httpMethod === 'GET') {
        console.log('✅ Organizations GET endpoint matched');

        // Build WHERE clause manually since organizations table uses 'id' not 'organization_id'
        let whereClause = '';
        if (!hasDataReadAll) {
          const orgIdsList = accessibleOrgIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
          whereClause = accessibleOrgIds.length > 0 ? `WHERE id IN (${orgIdsList})` : 'WHERE 1=0';
        }

        const sql = `SELECT json_agg(row_to_json(t)) FROM (
          SELECT id, name, subdomain, settings, is_active, created_at, updated_at 
          FROM organizations ${whereClause}
        ) t;`;
        
        console.log('Executing SQL:', sql);
        const result = await queryJSON(sql);
        console.log('Query result:', JSON.stringify(result, null, 2));
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
        };
      }
    }
    
    // Organizations by ID endpoint
    if (path.match(/\/organizations\/[^/]+$/)) {
      const orgId = path.split('/').pop();
      
      if (httpMethod === 'PUT') {
        if (!canAccessOrganization(authContext, orgId)) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Forbidden' })
          };
        }

        const body = JSON.parse(event.body || '{}');
        const { strategic_attributes } = body;
        
        if (!strategic_attributes) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'strategic_attributes required' })
          };
        }
        
        // Get current settings and merge
        const getSql = `SELECT settings FROM organizations WHERE id = '${orgId}';`;
        const current = await queryJSON(getSql);
        const currentSettings = current[0]?.settings || {};
        const updatedSettings = { ...currentSettings, strategic_attributes };
        
        const sql = `
          UPDATE organizations 
          SET settings = '${JSON.stringify(updatedSettings)}'::jsonb
          WHERE id = '${orgId}'
          RETURNING *;
        `;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
    }

    // Worker strategic attributes endpoint
    if (path.endsWith('/worker_strategic_attributes')) {
      if (httpMethod === 'GET') {
        let whereClause = '';
        if (!hasDataReadAll && organizationId) {
          whereClause = `WHERE organization_id::text = '${escapeLiteral(organizationId)}'`;
        }
        
        const sql = `SELECT json_agg(row_to_json(t)) FROM (
          SELECT * FROM worker_strategic_attributes ${whereClause} ORDER BY created_at DESC
        ) t;`;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
        };
      }
    }

    // Scoring prompts endpoints
    if (path.endsWith('/scoring_prompts')) {
      if (httpMethod === 'GET') {
        let whereClause = '';
        if (!hasDataReadAll && organizationId) {
          whereClause = `WHERE organization_id::text = '${escapeLiteral(organizationId)}'`;
        }
        
        const sql = `SELECT json_agg(row_to_json(t)) FROM (
          SELECT * FROM scoring_prompts ${whereClause} ORDER BY created_at DESC
        ) t;`;
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
        };
      }

      if (httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}');
        const { name, prompt_text, is_default = false, created_by } = body;

        if (!name || !prompt_text || !created_by) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'name, prompt_text, and created_by are required' })
          };
        }

        const sql = `
          INSERT INTO scoring_prompts (name, prompt_text, is_default, created_by, created_at, updated_at)
          VALUES (
            ${formatSqlValue(name)},
            ${formatSqlValue(prompt_text)},
            ${is_default},
            ${formatSqlValue(created_by)},
            NOW(),
            NOW()
          )
          RETURNING *
        `;
        const result = await queryJSON(sql);
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
    }

    if (path.match(/\/scoring_prompts\/[^/]+\/set-default$/)) {
      if (httpMethod === 'PUT') {
        const promptId = path.split('/').slice(-2, -1)[0];
        await queryJSON('UPDATE scoring_prompts SET is_default = false');
        await queryJSON(`UPDATE scoring_prompts SET is_default = true, updated_at = NOW() WHERE id = '${escapeLiteral(promptId)}'`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true })
        };
      }
    }

    if (path.match(/\/scoring_prompts\/[^/]+$/)) {
      const promptId = path.split('/').pop();
      if (httpMethod === 'PUT') {
        const body = JSON.parse(event.body || '{}');
        const updates = buildUpdateClauses(body, ['name', 'prompt_text', 'is_default']);
        if (updates.length === 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'No fields to update' })
          };
        }
        updates.push('updated_at = NOW()');
        const sql = `UPDATE scoring_prompts SET ${updates.join(', ')} WHERE id = '${escapeLiteral(promptId)}' RETURNING *`;
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
    }

    // Action scores endpoint
    if (path.endsWith('/action_scores')) {
      if (httpMethod === 'GET') {
        const { start_date, end_date, user_id } = event.queryStringParameters || {};
        let whereConditions = [];
        
        // Always filter by organization via actions table
        if (!hasDataReadAll && organizationId) {
          whereConditions.push(`a.organization_id::text = '${escapeLiteral(organizationId)}'`);
        }
        
        if (start_date) {
          whereConditions.push(`s.created_at >= '${start_date}'`);
        }
        if (end_date) {
          whereConditions.push(`s.created_at <= '${end_date}'`);
        }
        if (user_id) {
          whereConditions.push(`a.assigned_to = '${user_id}'`);
        }
        
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        
        const sql = `SELECT json_agg(row_to_json(t)) FROM (
          SELECT s.* FROM action_scores s
          LEFT JOIN actions a ON a.id = s.action_id
          ${whereClause}
          ORDER BY s.created_at DESC
        ) t;`;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
        };
      }
      
      if (httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}');
        const { action_id, source_type, source_id, prompt_id, prompt_text, scores, ai_response, likely_root_causes, asset_context_id, asset_context_name } = body;
        
        if (!action_id || !prompt_id || !scores) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'action_id, prompt_id, and scores are required' })
          };
        }
        
        // Validate action is completed
        const actionCheck = await queryJSON(`SELECT status FROM actions WHERE id = '${escapeLiteral(action_id)}' LIMIT 1`);
        if (!actionCheck || actionCheck.length === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Action not found' })
          };
        }
        if (actionCheck[0].status !== 'completed') {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Only completed actions can be scored' })
          };
        }
        
        const sql = `
          INSERT INTO action_scores (
            action_id, source_type, source_id, prompt_id, prompt_text, scores, 
            ai_response, likely_root_causes, asset_context_id, asset_context_name, created_at, updated_at
          )
          VALUES (
            '${action_id}',
            '${source_type || 'action'}',
            '${source_id || action_id}',
            '${prompt_id}',
            ${prompt_text ? `'${escapeLiteral(prompt_text)}'` : 'NULL'},
            '${JSON.stringify(scores)}'::jsonb,
            ${ai_response ? `'${JSON.stringify(ai_response)}'::jsonb` : 'NULL'},
            ${likely_root_causes ? `'${JSON.stringify(likely_root_causes)}'::jsonb` : 'NULL'},
            ${asset_context_id ? `'${asset_context_id}'` : 'NULL'},
            ${asset_context_name ? `'${escapeLiteral(asset_context_name)}'` : 'NULL'},
            NOW(),
            NOW()
          )
          RETURNING *;
        `;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
    }
    
    // Action scores by ID endpoint
    if (path.match(/\/action_scores\/[^/]+$/)) {
      const scoreId = path.split('/').pop();
      
      if (httpMethod === 'PUT') {
        const body = JSON.parse(event.body || '{}');
        const updates = [];
        
        if (body.prompt_id) updates.push(`prompt_id = '${body.prompt_id}'`);
        if (body.prompt_text) updates.push(`prompt_text = '${escapeLiteral(body.prompt_text)}'`);
        if (body.scores) updates.push(`scores = '${JSON.stringify(body.scores)}'::jsonb`);
        if (body.ai_response) updates.push(`ai_response = '${JSON.stringify(body.ai_response)}'::jsonb`);
        if (body.likely_root_causes) updates.push(`likely_root_causes = '${JSON.stringify(body.likely_root_causes)}'::jsonb`);
        if (body.asset_context_id) updates.push(`asset_context_id = '${body.asset_context_id}'`);
        if (body.asset_context_name) updates.push(`asset_context_name = '${escapeLiteral(body.asset_context_name)}'`);
        
        updates.push(`updated_at = NOW()`);
        
        if (updates.length === 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'No valid fields to update' })
          };
        }
        
        const sql = `
          UPDATE action_scores
          SET ${updates.join(', ')}
          WHERE id = '${scoreId}'
          RETURNING *;
        `;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
    }

    // Profiles endpoint
    if (path.endsWith('/profiles')) {
      if (httpMethod === 'GET') {
        try {
          const { user_id } = event.queryStringParameters || {};
          let whereConditions = [];
          
          // Filter by organization and only active members
          if (!hasDataReadAll && organizationId) {
            whereConditions.push(`om.organization_id::text = '${escapeLiteral(organizationId)}'`);
          }
          whereConditions.push(`om.is_active = true`);
          
          if (user_id) {
            whereConditions.push(`p.user_id = ${formatSqlValue(user_id)}`);
          }
          
          const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
          
          const sql = `SELECT json_agg(row_to_json(t)) FROM (
            SELECT p.* FROM profiles p
            INNER JOIN organization_members om ON p.user_id = om.user_id
            ${whereClause}
            ORDER BY p.full_name
          ) t;`;
          
          const result = await queryJSON(sql);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
          };
        } catch (error) {
          console.error('Error fetching profiles:', error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error', message: error.message })
          };
        }
      }
      
      if (httpMethod === 'POST') {
        try {
          const body = JSON.parse(event.body || '{}');
          const { user_id, full_name, favorite_color } = body;
          
          if (!user_id) {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'user_id required' })
            };
          }
          
          // Use formatSqlValue to safely escape all values and prevent SQL injection
          const safeUserId = formatSqlValue(user_id);
          const safeFullName = formatSqlValue(full_name || '');
          const safeFavoriteColor = formatSqlValue(favorite_color);
          
          // Upsert profile
          const sql = `
            INSERT INTO profiles (user_id, full_name, favorite_color, updated_at) 
            VALUES (${safeUserId}, ${safeFullName}, ${safeFavoriteColor}, NOW())
            ON CONFLICT (user_id) 
            DO UPDATE SET 
              full_name = EXCLUDED.full_name,
              favorite_color = EXCLUDED.favorite_color,
              updated_at = NOW()
            RETURNING *;
          `;
          
          const result = await queryJSON(sql);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ data: result })
          };
        } catch (error) {
          console.error('Error creating/updating profile:', error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error', message: error.message })
          };
        }
      }
    }

    // Checkins endpoint
    if (httpMethod === 'POST' && path.endsWith('/checkins')) {
      try {
        const body = JSON.parse(event.body || '{}');
        const afterImageArray = Array.isArray(body.after_image_urls)
          ? body.after_image_urls
          : body.after_image_urls
            ? [body.after_image_urls]
            : [];

        const insertData = {
          checkout_id: body.checkout_id,
          tool_id: body.tool_id,
          user_name: body.user_name || 'Unknown User',
          problems_reported: body.problems_reported !== undefined ? body.problems_reported : null,
          notes: body.notes !== undefined ? body.notes : null,
          sop_best_practices: body.sop_best_practices !== undefined ? body.sop_best_practices : '',
          what_did_you_do: body.what_did_you_do !== undefined ? body.what_did_you_do : '',
          checkin_reason: body.checkin_reason !== undefined ? body.checkin_reason : null,
          after_image_urls: afterImageArray,
          organization_id: (() => {
            if (!organizationId) {
              console.error('❌ ERROR: Cannot create checkin - organization_id is missing from authorizer context');
              throw new Error('Server configuration error: organization context not available');
            }
            return organizationId;
          })()
        };

        const requiredFields = ['checkout_id', 'tool_id', 'user_name'];
        const missingFields = requiredFields.filter(field => !insertData[field]);
        if (missingFields.length > 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: `Missing required fields: ${missingFields.join(', ')}` })
          };
        }

        const columns = Object.keys(insertData);
        const values = columns.map(col => formatSqlValue(insertData[col]));

        const sql = `
          INSERT INTO checkins (${columns.join(', ')}, checkin_date)
          VALUES (${values.join(', ')}, NOW())
          RETURNING *
        `;
        
        console.log('Checkin SQL:', sql);
        console.log('Checkin data:', JSON.stringify(insertData, null, 2));
        
        const result = await queryJSON(sql);
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      } catch (error) {
        console.error('Error creating checkin:', error);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ 
            error: 'Failed to create checkin',
            details: error.message,
            stack: error.stack
          })
        };
      }
    }

    // Tools history endpoint
    if (path.match(/\/tools\/[a-f0-9-]+\/history$/)) {
      if (httpMethod === 'GET') {
        try {
          const toolId = path.split('/')[2];
          
          // Get asset info
          const assetSql = `SELECT created_at, updated_at FROM tools WHERE id::text = '${escapeLiteral(toolId)}';`;
          const assetResult = await queryJSON(assetSql);
          
          // Get checkouts - cast all UUIDs to text for consistency
          const checkoutsSql = `SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) as json_agg FROM (
            SELECT 
              c.id::text,
              c.tool_id::text,
              c.user_id::text,
              c.user_name,
              c.checkout_date,
              c.expected_return_date,
              c.is_returned,
              c.intended_usage,
              c.notes,
              c.action_id::text,
              c.organization_id::text,
              c.created_at,
              COALESCE(om.full_name, c.user_name) as user_display_name
            FROM checkouts c
            LEFT JOIN organization_members om ON c.user_id::text = om.cognito_user_id::text
            WHERE c.tool_id::text = '${escapeLiteral(toolId)}'
            ORDER BY c.checkout_date DESC
          ) t;`;
          const checkoutsResult = await queryJSON(checkoutsSql);
          
          // Get issues - cast all UUIDs to text
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
          
          // Get actions - cast all UUIDs to text
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
          
          // Build unified timeline
          const asset = assetResult?.[0];
          const checkouts = checkoutsResult?.[0]?.json_agg || [];
          const issues = issuesResult?.[0]?.json_agg || [];
          const actions = actionsResult?.[0]?.json_agg || [];
          const assetHistory = assetHistoryResult?.[0]?.json_agg || [];
          
          const timeline = [];
          
          // Add asset history events
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
          
          // Add generic asset created event if no history
          if (assetHistory.length === 0 && asset) {
            timeline.push({
              type: 'asset_created',
              timestamp: asset.created_at,
              description: 'Asset created'
            });
          }
          
          // Add checkout events
          checkouts.forEach(c => {
            timeline.push({
              type: 'checkout',
              timestamp: c.checkout_date || c.created_at,
              description: `Checked out by ${c.user_display_name}`,
              data: c
            });
          });
          
          // Add issue events
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
          
          // Add action events
          actions.forEach(a => {
            timeline.push({
              type: 'action_created',
              timestamp: a.created_at,
              description: `Action: ${a.title}`,
              data: a
            });
          });
          
          // Sort timeline by timestamp descending
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
                timeline
              }
            })
          };
        } catch (error) {
          console.error('Error fetching tool history:', error);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              error: 'Failed to fetch tool history',
              message: error.message 
            })
          };
        }
      }
    }

    // Checkouts endpoint
    if (path.endsWith('/checkouts') || path.match(/\/checkouts\/[a-f0-9-]+$/)) {
      if (httpMethod === 'DELETE') {
        const checkoutId = path.split('/').pop();
        const sql = `DELETE FROM checkouts WHERE id = '${checkoutId}' RETURNING *`;
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
      
      if (httpMethod === 'PUT') {
        const checkoutId = path.split('/').pop();
        const body = JSON.parse(event.body || '{}');
        const updates = [];
        if (body.checkout_date !== undefined) updates.push(`checkout_date = ${body.checkout_date ? `'${body.checkout_date}'` : 'NOW()'}`);
        if (body.is_returned !== undefined) updates.push(`is_returned = ${body.is_returned}`);
        if (updates.length === 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'No fields to update' })
          };
        }
        const sql = `UPDATE checkouts SET ${updates.join(', ')} WHERE id = '${checkoutId}' RETURNING *`;
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
      
      if (httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}');
        const { tool_id, user_id, user_name, intended_usage, notes, action_id, is_returned, checkout_date } = body;
        // Always use organizationId from authorizer context (not from request body)
        if (!organizationId) {
          console.error('❌ ERROR: Cannot create checkout - organization_id is missing from authorizer context');
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server configuration error: organization context not available' })
          };
        }
        const orgId = organizationId;
        
        // Check for existing active checkout for this tool
        // An active checkout is one where is_returned = false
        const checkActiveCheckoutSql = `
          SELECT id, user_name, checkout_date 
          FROM checkouts 
          WHERE tool_id = '${tool_id}' 
            AND is_returned = false
            AND organization_id = '${orgId}'
          LIMIT 1
        `;
        const existingCheckouts = await queryJSON(checkActiveCheckoutSql);
        
        if (existingCheckouts && existingCheckouts.length > 0) {
          const existingCheckout = existingCheckouts[0];
          return {
            statusCode: 409,
            headers,
            body: JSON.stringify({ 
              error: 'Tool already has an active checkout',
              details: `This tool is currently checked out to ${existingCheckout.user_name || 'another user'}. Please return the tool before creating a new checkout.`,
              existing_checkout: {
                id: existingCheckout.id,
                user_name: existingCheckout.user_name,
                checkout_date: existingCheckout.checkout_date
              }
            })
          };
        }
        
        const checkoutDateValue = checkout_date ? `'${checkout_date}'` : (is_returned ? 'NOW()' : 'NULL');
        const sql = `
          INSERT INTO checkouts (tool_id, user_id, user_name, intended_usage, notes, action_id, organization_id, is_returned, checkout_date)
          VALUES ('${tool_id}', '${user_id}', '${user_name.replace(/'/g, "''")}', ${intended_usage ? `'${intended_usage.replace(/'/g, "''")}'` : 'NULL'}, ${notes ? `'${notes.replace(/'/g, "''")}'` : 'NULL'}, ${action_id ? `'${action_id}'` : 'NULL'}, '${orgId}', ${is_returned}, ${checkoutDateValue})
          RETURNING *
        `;
        
        try {
          const result = await queryJSON(sql);
          return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ data: result[0] })
          };
        } catch (error) {
          // Catch duplicate key constraint violation
          if (error.message && error.message.includes('idx_unique_active_checkout_per_tool')) {
            return {
              statusCode: 409,
              headers,
              body: JSON.stringify({ 
                error: 'Tool already has an active checkout',
                details: 'This tool is currently checked out. Please return the tool before creating a new checkout.'
              })
            };
          }
          throw error;
        }
      }
      
      if (httpMethod === 'GET') {
        const { is_returned, action_id, tool_id } = event.queryStringParameters || {};
        let whereConditions = [];
        
        // Always filter by organization
        if (!hasDataReadAll && organizationId) {
          whereConditions.push(`c.organization_id::text = '${escapeLiteral(organizationId)}'`);
        }
        
        if (is_returned === 'false') {
          whereConditions.push('c.is_returned = false');
        } else if (is_returned === 'true') {
          whereConditions.push('c.is_returned = true');
        }
        if (action_id) {
          whereConditions.push(`c.action_id = '${action_id}'`);
        }
        if (tool_id) {
          whereConditions.push(`c.tool_id = '${tool_id}'`);
        }
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        
        const sql = `SELECT json_agg(row_to_json(t)) FROM (
          SELECT 
            c.*,
            t.serial_number as tool_serial_number,
            COALESCE(om.full_name, c.user_name) as user_name,
            a.title as action_title
          FROM checkouts c
          LEFT JOIN tools t ON c.tool_id = t.id
          LEFT JOIN organization_members om ON c.user_id = om.cognito_user_id
          LEFT JOIN actions a ON c.action_id = a.id
          ${whereClause} ORDER BY c.checkout_date DESC
        ) t;`;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
        };
      }
    }



    // Missions endpoint
    if (path.endsWith('/missions')) {
      if (httpMethod === 'GET') {
        // Use same pattern as actions/parts - build organization filter to return everything user has access to
        const contextForFilter = {
          ...authContext,
          accessible_organization_ids: accessibleOrgIds,
          permissions: authContext.permissions || []
        };
        const orgFilter = buildOrganizationFilter(contextForFilter, 'm');
        
        // Build WHERE clause - empty condition means user has data:read:all permission (return all), 
        // otherwise filter by accessible orgs
        const whereClause = orgFilter.condition ? `WHERE ${orgFilter.condition}` : '';
        
        const sql = `SELECT json_agg(row_to_json(t)) FROM (
          SELECT * FROM missions m ${whereClause} ORDER BY m.created_at DESC
        ) t;`;
        
        // Enhanced logging for debugging
        console.log('Missions GET endpoint:', {
          path,
          organization_id: organizationId,
          accessible_orgs: accessibleOrgIds,
          accessible_orgs_count: accessibleOrgIds.length,
          has_data_read_all: hasDataReadAll,
          permissions: authContext.permissions,
          orgFilter_condition: orgFilter.condition,
          whereClause: whereClause,
          sql: sql.substring(0, 300)
        });
        
        try {
          const result = await queryJSON(sql);
          const missions = result?.[0]?.json_agg || [];
          
          console.log('Missions query result:', {
            result_type: typeof result,
            result_length: result?.length,
            json_agg_type: typeof result?.[0]?.json_agg,
            missions_count: missions.length,
            first_mission_org_id: missions[0]?.organization_id || 'none',
            first_mission_title: missions[0]?.title || 'none'
          });
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ data: missions })
          };
        } catch (error) {
          console.error('❌ ERROR: Failed to query missions:', error);
          console.error('   SQL:', sql);
          console.error('   Error details:', error.message, error.stack);
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              error: 'Failed to fetch missions',
              message: error.message 
            })
          };
        }
      }
      
      if (httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}');
        const { 
          title, 
          problem_statement, 
          created_by, 
          qa_assigned_to,
          template_id,
          template_name,
          template_color,
          template_icon,
          organization_id
        } = body;
        
        if (!title || !created_by) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'title and created_by are required' })
          };
        }
        
        // Map Cognito user ID to database user_id if needed
        let dbUserId = created_by;
        if (created_by.includes('-')) {
          // If it looks like a UUID, assume it's already a database user_id
          dbUserId = created_by;
        } else {
          // If it's a Cognito user ID, look up the database user_id
          const userLookupSql = `SELECT user_id FROM organization_members WHERE cognito_user_id = '${created_by}' LIMIT 1;`;
          const userResult = await queryJSON(userLookupSql);
          if (userResult && userResult.length > 0) {
            dbUserId = userResult[0].user_id;
          } else {
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'User not found in organization' })
            };
          }
        }
        
        // Map qa_assigned_to if provided
        let dbQaUserId = qa_assigned_to;
        if (qa_assigned_to && !qa_assigned_to.includes('-')) {
          const qaUserLookupSql = `SELECT user_id FROM organization_members WHERE cognito_user_id = '${qa_assigned_to}' LIMIT 1;`;
          const qaUserResult = await queryJSON(qaUserLookupSql);
          if (qaUserResult && qaUserResult.length > 0) {
            dbQaUserId = qaUserResult[0].user_id;
          }
        }
        
        // Always use organizationId from authorizer context (not from request body)
        // This ensures security - users can't create resources in organizations they don't belong to
        if (!organizationId) {
          console.error('❌ ERROR: Cannot create mission - organization_id is missing from authorizer context');
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server configuration error: organization context not available' })
          };
        }
        const orgId = organizationId;
        
        // Include organization_id in INSERT
        const sql = `
          INSERT INTO missions (
            title, 
            problem_statement, 
            created_by, 
            qa_assigned_to,
            organization_id,
            status, 
            template_id,
            template_name,
            template_color,
            template_icon,
            created_at, 
            updated_at
          ) VALUES (
            '${title.replace(/'/g, "''")}', 
            '${(problem_statement || '').replace(/'/g, "''")}', 
            '${dbUserId}', 
            ${dbQaUserId ? `'${dbQaUserId}'` : 'NULL'},
            '${orgId}',
            'planning',
            ${template_id ? `'${template_id}'` : 'NULL'},
            ${template_name ? `'${template_name.replace(/'/g, "''")}'` : 'NULL'},
            ${template_color ? `'${template_color}'` : 'NULL'},
            ${template_icon ? `'${template_icon}'` : 'NULL'},
            NOW(), 
            NOW()
          )
          RETURNING *;
        `;
        
        console.log('SQL:', sql);
        const result = await queryJSON(sql);
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
    }

    // Missions by ID endpoint (GET, PUT, DELETE)
    if (path.includes('/missions/') && !path.endsWith('/missions')) {
      const missionId = path.split('/missions/')[1]?.split('/')[0]; // Extract ID, handle trailing paths
      
      if (httpMethod === 'GET') {
        const orgFilter = buildOrganizationFilter(authContext, 'missions');
        const whereClause = orgFilter.condition ? `WHERE missions.id = '${missionId}' AND ${orgFilter.condition}` : `WHERE missions.id = '${missionId}'`;
        
        const sql = `SELECT json_agg(row_to_json(t)) FROM (
          SELECT * FROM missions ${whereClause}
        ) t;`;
        
        const result = await queryJSON(sql);
        const mission = result?.[0]?.json_agg?.[0];
        
        if (!mission) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Mission not found' })
          };
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: mission })
        };
      }
      
      if (httpMethod === 'PUT') {
        const body = JSON.parse(event.body || '{}');
        const { id, created_by, created_at, updated_at, ...missionData } = body;
        
        // Build UPDATE statement
        const updates = [];
        for (const [key, val] of Object.entries(missionData)) {
          if (val === undefined) continue;
          if (val === null) updates.push(`${key} = NULL`);
          else if (typeof val === 'string') updates.push(`${key} = '${val.replace(/'/g, "''")}'`);
          else if (typeof val === 'boolean') updates.push(`${key} = ${val}`);
          else updates.push(`${key} = ${val}`);
        }
        updates.push(`updated_at = NOW()`);
        
        const orgFilter = buildOrganizationFilter(authContext, 'missions');
        const whereClause = orgFilter.condition 
          ? `WHERE id = '${missionId}' AND ${orgFilter.condition}`
          : `WHERE id = '${missionId}'`;
        
        const sql = `UPDATE missions SET ${updates.join(', ')} ${whereClause} RETURNING *;`;
        const result = await queryJSON(sql);
        
        if (!result || result.length === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Mission not found' })
          };
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
      
      if (httpMethod === 'DELETE') {
        const orgFilter = buildOrganizationFilter(authContext, 'missions');
        const whereClause = orgFilter.condition 
          ? `WHERE id = '${missionId}' AND ${orgFilter.condition}`
          : `WHERE id = '${missionId}'`;
        
        const sql = `DELETE FROM missions ${whereClause} RETURNING id;`;
        const result = await queryJSON(sql);
        
        if (!result || result.length === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Mission not found' })
          };
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: { id: result[0].id } })
        };
      }
    }

    // Actions endpoint with full details
    if (httpMethod === 'GET' && path.endsWith('/actions')) {
      const { limit, offset = 0, assigned_to, status, id } = event.queryStringParameters || {};
      
      let whereConditions = [];
      if (id) {
        whereConditions.push(`a.id = '${id}'`);
      }
      if (assigned_to) {
        whereConditions.push(`a.assigned_to = '${assigned_to}'`);
      }
      if (status) {
        if (status === 'unresolved') {
          whereConditions.push(`a.status IN ('not_started', 'in_progress', 'blocked')`);
        } else {
          whereConditions.push(`a.status = '${status}'`);
        }
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
          COALESCE(update_counts.count, 0) as implementation_update_count,
          -- Asset details
          CASE WHEN a.asset_id IS NOT NULL THEN
            json_build_object(
              'id', assets.id,
              'name', assets.name,
              'category', assets.category
            )
          END as asset,
          -- Issue tool details  
          CASE WHEN a.issue_tool_id IS NOT NULL THEN
            json_build_object(
              'id', issue_tools.id,
              'name', issue_tools.name,
              'category', issue_tools.category
            )
          END as issue_tool,
          -- Mission details
          CASE WHEN a.mission_id IS NOT NULL THEN
            json_build_object(
              'id', missions.id,
              'title', missions.title,
              'mission_number', missions.mission_number
            )
          END as mission,
          -- Participants details
          CASE WHEN participants.participants IS NOT NULL THEN
            participants.participants
          END as participants_details
        FROM actions a
        LEFT JOIN profiles om ON a.assigned_to = om.user_id
        LEFT JOIN action_scores scores ON a.id = scores.action_id
        LEFT JOIN (
          SELECT DISTINCT action_id 
          FROM action_implementation_updates
          WHERE update_type != 'policy_agreement' OR update_type IS NULL
        ) updates ON a.id = updates.action_id
        LEFT JOIN (
          SELECT action_id, COUNT(*) as count
          FROM action_implementation_updates
          WHERE update_type != 'policy_agreement' OR update_type IS NULL
          GROUP BY action_id
        ) update_counts ON a.id = update_counts.action_id
        LEFT JOIN tools assets ON a.asset_id = assets.id
        LEFT JOIN tools issue_tools ON a.issue_tool_id = issue_tools.id
        LEFT JOIN missions ON a.mission_id = missions.id
        LEFT JOIN (
          SELECT 
            ap.action_id,
            json_agg(
              json_build_object(
                'user_id', om_part.user_id,
                'full_name', om_part.full_name,
                'favorite_color', om_part.favorite_color
              )
            ) as participants
          FROM action_participants ap
          LEFT JOIN profiles om_part ON ap.user_id = om_part.user_id
          GROUP BY ap.action_id
        ) participants ON a.id = participants.action_id
        ${whereClause} 
        ORDER BY a.updated_at DESC 
        ${limitClause}
      ) t;`;
      
      const result = await queryJSON(sql);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
      };
    }

    // POST /actions - Create new action
    if (httpMethod === 'POST' && path.endsWith('/actions')) {
      const body = JSON.parse(event.body || '{}');
      
      if (!body.title) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'title is required' })
        };
      }

      const actionId = body.id || randomUUID();
      const now = new Date().toISOString();
      
      // Build the INSERT statement
      const insertFields = [
        'id',
        'title',
        'description',
        'policy',
        'assigned_to',
        'status',
        'estimated_duration',
        'required_stock',
        'attachments',
        'mission_id',
        'asset_id',
        'linked_issue_id',
        'issue_reference',
        'plan_commitment',
        'policy_agreed_at',
        'policy_agreed_by',
        'organization_id',
        'created_by',
        'updated_by',
        'created_at',
        'updated_at'
      ];

      const insertValues = [
        formatSqlValue(actionId),
        formatSqlValue(body.title),
        formatSqlValue(body.description),
        formatSqlValue(body.policy),
        formatSqlValue(body.assigned_to),
        formatSqlValue(body.status || 'not_started'),
        formatSqlValue(body.estimated_duration),
        formatSqlValue(body.required_stock),
        formatSqlValue(body.attachments || []),
        formatSqlValue(body.mission_id),
        formatSqlValue(body.asset_id),
        formatSqlValue(body.linked_issue_id),
        formatSqlValue(body.issue_reference),
        formatSqlValue(body.plan_commitment),
        formatSqlValue(body.policy_agreed_at),
        formatSqlValue(body.policy_agreed_by),
        (() => {
          if (!organizationId) {
            console.error('❌ ERROR: Cannot create action - organization_id is missing from authorizer context');
            throw new Error('Server configuration error: organization context not available');
          }
          return formatSqlValue(organizationId);
        })(),
        formatSqlValue(body.created_by),
        formatSqlValue(body.updated_by),
        formatSqlValue(now),
        formatSqlValue(now)
      ];

      const client = new Client(dbConfig);
      try {
        await client.connect();
        await client.query('BEGIN');

        // Insert the action
        const insertSql = `
          INSERT INTO actions (${insertFields.join(', ')})
          VALUES (${insertValues.join(', ')})
          RETURNING id
        `;
        
        console.log('Insert SQL:', insertSql);
        console.log('Insert values:', JSON.stringify(insertValues, null, 2));
        console.log('Body data:', JSON.stringify(body, null, 2));
        
        let insertResult;
        try {
          insertResult = await client.query(insertSql);
        } catch (sqlError) {
          console.error('SQL Error:', sqlError.message);
          console.error('SQL Query:', insertSql);
          console.error('Insert Fields:', insertFields);
          console.error('Insert Values (raw):', insertValues);
          // Return error with SQL for debugging
          await client.query('ROLLBACK');
          await client.end();
          return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
              error: sqlError.message,
              sql: insertSql,
              fields: insertFields,
              values: insertValues
            })
          };
        }
        const newActionId = insertResult.rows[0].id;

        // Handle participants if provided
        if (body.participants && Array.isArray(body.participants) && body.participants.length > 0) {
          const participantValues = body.participants.map(userId => 
            `('${escapeLiteral(newActionId)}', '${escapeLiteral(userId)}')`
          ).join(', ');
          
          const participantsSql = `
            INSERT INTO action_participants (action_id, user_id)
            VALUES ${participantValues}
            ON CONFLICT (action_id, user_id) DO NOTHING
          `;
          await client.query(participantsSql);
        }

        await client.query('COMMIT');

        // Fetch the created action with all joins
        const fetchSql = `
          SELECT json_agg(row_to_json(t)) FROM (
            SELECT 
              a.*,
              om.full_name as assigned_to_name,
              om.favorite_color as assigned_to_color,
              CASE WHEN participants.participants IS NOT NULL THEN
                participants.participants
              END as participants_details
            FROM actions a
            LEFT JOIN profiles om ON a.assigned_to = om.user_id
            LEFT JOIN (
              SELECT 
                ap.action_id,
                json_agg(
                  json_build_object(
                    'user_id', om_part.user_id,
                    'full_name', om_part.full_name,
                    'favorite_color', om_part.favorite_color
                  )
                ) as participants
              FROM action_participants ap
              LEFT JOIN profiles om_part ON ap.user_id = om_part.user_id
              WHERE ap.action_id = '${escapeLiteral(newActionId)}'
              GROUP BY ap.action_id
            ) participants ON a.id = participants.action_id
            WHERE a.id = '${escapeLiteral(newActionId)}'
          ) t;
        `;
        
        const fetchResult = await queryJSON(fetchSql);
        
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ data: fetchResult?.[0]?.json_agg?.[0] || null })
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        await client.end();
      }
    }

    // Action implementation updates endpoint
    if (path.endsWith('/action_implementation_updates') || path.match(/\/action_implementation_updates\/[a-f0-9-]+$/)) {
      // DELETE by ID
      if (httpMethod === 'DELETE' && path.match(/\/action_implementation_updates\/[a-f0-9-]+$/)) {
        const updateId = path.split('/').pop();
        const sql = `DELETE FROM action_implementation_updates WHERE id = '${escapeLiteral(updateId)}' RETURNING *`;
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
      
      // PUT by ID
      if (httpMethod === 'PUT' && path.match(/\/action_implementation_updates\/[a-f0-9-]+$/)) {
        const updateId = path.split('/').pop();
        const body = JSON.parse(event.body || '{}');
        const updates = buildUpdateClauses(body, ['update_text', 'update_type']);
        if (updates.length === 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'No fields to update' })
          };
        }
        const sql = `UPDATE action_implementation_updates SET ${updates.join(', ')} WHERE id = '${escapeLiteral(updateId)}' RETURNING *`;
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
      
      if (httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}');
        const { action_id, update_text, updated_by } = body;
        
        if (!action_id || !update_text || !updated_by) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'action_id, update_text, and updated_by are required' })
          };
        }
        
        const sql = `
          INSERT INTO action_implementation_updates (action_id, update_text, updated_by)
          VALUES ('${action_id}', '${update_text.replace(/'/g, "''")}', '${updated_by}')
          RETURNING *
        `;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ data: result[0] })
        };
      }
      
      if (httpMethod === 'GET') {
        const { action_id, start_date, end_date, user_ids, limit = 50 } = event.queryStringParameters || {};
        
        let whereConditions = [];
        
        // Always filter by organization via actions table
        if (!hasDataReadAll && organizationId) {
          whereConditions.push(`a.organization_id::text = '${escapeLiteral(organizationId)}'`);
        }
        
        if (action_id) {
          whereConditions.push(`aiu.action_id = '${action_id}'`);
        }
        if (start_date) {
          whereConditions.push(`aiu.created_at >= '${start_date}'`);
        }
        if (end_date) {
          whereConditions.push(`aiu.created_at <= '${end_date}'`);
        }
        if (user_ids) {
          const ids = user_ids.split(',').map(id => `'${id}'`).join(',');
          whereConditions.push(`aiu.updated_by IN (${ids})`);
        }
        
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
        
        const sql = `SELECT json_agg(row_to_json(t)) FROM (
          SELECT 
            aiu.*,
            om.full_name as updated_by_name,
            om.favorite_color as updated_by_color
          FROM action_implementation_updates aiu
          LEFT JOIN actions a ON aiu.action_id = a.id
          LEFT JOIN profiles om ON aiu.updated_by = om.user_id
          ${whereClause}
          ORDER BY aiu.created_at DESC 
          LIMIT ${limit}
        ) t;`;
        
        const result = await queryJSON(sql);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ data: result?.[0]?.json_agg || [] })
        };
      }
    }

    // Generic query endpoint
    if (httpMethod === 'POST' && path.endsWith('/query')) {
      const body = JSON.parse(event.body || '{}');
      const { sql, params = [] } = body;
      
      if (!sql) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'SQL query required' })
        };
      }

      // Simple parameter substitution (not production-ready)
      let finalSql = sql;
      params.forEach((param, i) => {
        finalSql = finalSql.replace(`$${i + 1}`, `'${param}'`);
      });
      
      const jsonSql = `SELECT json_agg(row_to_json(t)) FROM (${finalSql}) t;`;
      const result = await queryJSON(jsonSql);
      
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