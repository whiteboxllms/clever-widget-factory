import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// RDS PostgreSQL connection details
const RDS_HOST = 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com';
const RDS_PORT = '5432';
const RDS_USER = 'postgres';
const RDS_PASSWORD = 'CWF_Dev_2025!';
const RDS_DATABASE = 'postgres';

// Helper to execute SQL and return JSON
async function queryJSON(sql) {
  const command = `PGPASSWORD='${RDS_PASSWORD}' psql -h ${RDS_HOST} -p ${RDS_PORT} -U ${RDS_USER} -d ${RDS_DATABASE} -t -c "${sql}"`;
  const { stdout } = await execAsync(command);
  const trimmed = stdout.trim();
  if (!trimmed || trimmed === '') return null;
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    console.error('JSON parse error:', e, 'Raw output:', trimmed);
    return null;
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Generic query endpoint
app.post('/api/query', async (req, res) => {
  try {
    const { sql, params = [] } = req.body;
    // For now, simple parameter substitution (not production-ready)
    let finalSql = sql;
    params.forEach((param, i) => {
      finalSql = finalSql.replace(`$${i + 1}`, `'${param}'`);
    });
    
    const jsonSql = `SELECT json_agg(row_to_json(t)) FROM (${finalSql}) t;`;
    const result = await queryJSON(jsonSql);
    res.json({ data: result || [] });
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Parts endpoint with pagination
app.get('/api/parts', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const sql = `SELECT json_agg(row_to_json(t)) FROM (
      SELECT id, name, description, category, current_quantity, minimum_quantity, 
             unit, parent_structure_id, storage_location, legacy_storage_vicinity, 
             accountable_person_id, 
             CASE 
               WHEN image_url LIKE '%supabase.co%' THEN 
                 REPLACE(image_url, 'https://oskwnlhuuxjfuwnjuavn.supabase.co/storage/v1/object/public/', 'https://cwf-dev-assets.s3.us-west-2.amazonaws.com/')
               ELSE image_url 
             END as image_url,
             created_at, updated_at 
      FROM parts ORDER BY name LIMIT ${limit} OFFSET ${offset}
    ) t;`;
    
    const result = await queryJSON(sql);
    res.json({ data: result || [] });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Tools endpoint with pagination
app.get('/api/tools', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const sql = `SELECT json_agg(row_to_json(t)) FROM (
      SELECT id, name, description, category, status, serial_number, 
             parent_structure_id, storage_location, legacy_storage_vicinity,
             accountable_person_id, 
             CASE 
               WHEN image_url LIKE '%supabase.co%' THEN 
                 REPLACE(image_url, 'https://oskwnlhuuxjfuwnjuavn.supabase.co/storage/v1/object/public/', 'https://cwf-dev-assets.s3.us-west-2.amazonaws.com/')
               ELSE image_url 
             END as image_url,
             created_at, updated_at
      FROM tools ORDER BY name LIMIT ${limit} OFFSET ${offset}
    ) t;`;
    
    const result = await queryJSON(sql);
    res.json({ data: result || [] });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Issues endpoint
app.get('/api/issues', async (req, res) => {
  try {
    const { context_type, status } = req.query;
    let whereClause = 'WHERE 1=1';
    
    if (context_type) {
      whereClause += ` AND context_type = '${context_type}'`;
    }
    if (status) {
      const statuses = status.split(',').map(s => `'${s}'`).join(',');
      whereClause += ` AND status IN (${statuses})`;
    }
    
    const sql = `SELECT json_agg(row_to_json(t)) FROM (
      SELECT * FROM issues ${whereClause} ORDER BY reported_at DESC
    ) t;`;
    
    const result = await queryJSON(sql);
    res.json({ data: result || [] });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Checkouts endpoint
app.get('/api/checkouts', async (req, res) => {
  try {
    const sql = `SELECT json_agg(row_to_json(t)) FROM (
      SELECT tool_id, user_name, user_id, checkout_date 
      FROM checkouts WHERE is_returned = false
    ) t;`;
    
    const result = await queryJSON(sql);
    res.json({ data: result || [] });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Tools search endpoint
app.get('/api/tools/search', async (req, res) => {
  try {
    const { search, limit = 50, offset = 0, includeDescriptions = 'false', showRemovedItems = 'false' } = req.query;
    
    if (!search) {
      return res.status(400).json({ error: 'Search term required' });
    }
    
    const term = `%${search}%`;
    let whereClause = `WHERE (
      name ILIKE '${term}' OR 
      serial_number ILIKE '${term}' OR 
      category ILIKE '${term}' OR 
      storage_location ILIKE '${term}'`;
    
    if (includeDescriptions === 'true') {
      whereClause += ` OR description ILIKE '${term}'`;
    }
    
    whereClause += ')';
    
    if (showRemovedItems !== 'true') {
      whereClause += ` AND status != 'removed'`;
    }
    
    const sql = `SELECT json_agg(row_to_json(t)) FROM (
      SELECT id, name, description, category, status, serial_number, 
             parent_structure_id, storage_location, legacy_storage_vicinity,
             accountable_person_id, 
             CASE 
               WHEN image_url LIKE '%supabase.co%' THEN 
                 REPLACE(image_url, 'https://oskwnlhuuxjfuwnjuavn.supabase.co/storage/v1/object/public/', 'https://cwf-dev-assets.s3.us-west-2.amazonaws.com/')
               ELSE image_url 
             END as image_url,
             created_at, updated_at
      FROM tools ${whereClause} ORDER BY name LIMIT ${limit} OFFSET ${offset}
    ) t;`;
    
    const result = await queryJSON(sql);
    res.json({ data: result || [] });
  } catch (error) {
    console.error('Tools search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Schema endpoint for version management
app.get('/api/schema', (req, res) => {
  res.json({
    version: 1,
    tables: {
      actions: ['id', 'title', 'description', 'assigned_to', 'status', 'created_at', 'updated_at'],
      tools: ['id', 'name', 'description', 'category', 'status', 'serial_number', 'storage_location'],
      parts: ['id', 'name', 'description', 'category', 'current_quantity', 'minimum_quantity'],
      organization_members: ['user_id', 'full_name', 'role']
    },
    last_updated: Date.now()
  });
});

// Organization members endpoint - only active members with names (for dropdowns)
app.get('/api/organization_members', async (req, res) => {
  try {
    const { organization_id = '00000000-0000-0000-0000-000000000001' } = req.query;
    
    const sql = `SELECT json_agg(row_to_json(t)) FROM (
      SELECT user_id, full_name, role, cognito_user_id
      FROM organization_members
      WHERE is_active = true 
        AND full_name IS NOT NULL 
        AND trim(full_name) != ''
        AND organization_id = '${organization_id}'
      ORDER BY full_name
    ) t;`;
    
    const result = await queryJSON(sql);
    res.json({ data: result || [] });
  } catch (error) {
    console.error('Organization members error:', error);
    res.status(500).json({ error: error.message });
  }
});

// All organization members endpoint (for management page)
app.get('/api/organization_members/all', async (req, res) => {
  try {
    const { organization_id = '00000000-0000-0000-0000-000000000001' } = req.query;
    
    const sql = `SELECT json_agg(row_to_json(t)) FROM (
      SELECT user_id, full_name, role, is_active, created_at, super_admin, organization_id
      FROM organization_members
      WHERE organization_id = '${organization_id}'
      ORDER BY is_active DESC, full_name NULLS LAST
    ) t;`;
    
    const result = await queryJSON(sql);
    res.json({ data: result || [] });
  } catch (error) {
    console.error('All organization members error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Find organization member by email (for Cognito mapping)
app.get('/api/organization_members/by-email', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'Email parameter required' });
    }

    const sql = `SELECT json_agg(row_to_json(t)) FROM (
      SELECT user_id, full_name, role, email, cognito_user_id
      FROM organization_members
      WHERE email = '${email}' AND is_active = true
      LIMIT 1
    ) t;`;
    
    const result = await queryJSON(sql);
    const member = result && result.length > 0 ? result[0] : null;
    
    res.json({ data: member });
  } catch (error) {
    console.error('Find member by email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Action implementation updates endpoint
app.get('/api/action_implementation_updates', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const sql = `SELECT json_agg(row_to_json(t)) FROM (
      SELECT * FROM action_implementation_updates ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    ) t;`;
    
    const result = await queryJSON(sql);
    res.json({ data: result || [] });
  } catch (error) {
    console.error('Action implementation updates error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Action scores endpoint
app.get('/api/action_scores', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const sql = `SELECT json_agg(row_to_json(t)) FROM (
      SELECT * FROM action_scores ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    ) t;`;
    
    const result = await queryJSON(sql);
    res.json({ data: result || [] });
  } catch (error) {
    console.error('Action scores error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Scoring prompts endpoint
app.get('/api/scoring_prompts', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const sql = `SELECT json_agg(row_to_json(t)) FROM (
      SELECT * FROM scoring_prompts ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    ) t;`;
    
    const result = await queryJSON(sql);
    res.json({ data: result || [] });
  } catch (error) {
    console.error('Scoring prompts error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

function getCached(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

// My actions endpoint - filter by Cognito user ID
app.get('/api/actions/my-actions', async (req, res) => {
  try {
    const { cognitoUserId } = req.query;
    if (!cognitoUserId) {
      return res.status(400).json({ error: 'cognitoUserId parameter required' });
    }

    const sql = `SELECT json_agg(row_to_json(t)) FROM (
      SELECT 
        a.*,
        a.title as description,
        om.full_name as assigned_to_name
      FROM actions a
      LEFT JOIN organization_members om ON a.assigned_to = om.user_id
      WHERE om.cognito_user_id = '${cognitoUserId}'
      ORDER BY a.created_at DESC
    ) t;`;
    
    const result = await queryJSON(sql);
    res.json({ data: result || [] });
  } catch (error) {
    console.error('My actions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Actions endpoint
app.get('/api/actions', async (req, res) => {
  try {
    const { limit, offset = 0, assigned_to, status } = req.query;
    
    // Build cache key
    const cacheKey = `actions_${assigned_to || 'all'}_${status || 'all'}_${limit || 'unlimited'}_${offset}`;
    
    // Check cache first
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ data: cached, cached: true });
    }
    
    let whereConditions = [];
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
        a.title as description,
        om.full_name as assigned_to_name
      FROM actions a
      LEFT JOIN organization_members om ON a.assigned_to = om.user_id
      ${whereClause} 
      ORDER BY a.created_at DESC 
      ${limitClause}
    ) t;`;
    
    const result = await queryJSON(sql);
    const data = result || [];
    
    // Cache the result
    setCache(cacheKey, data);
    
    res.json({ data, cached: false });
  } catch (error) {
    console.error('Actions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Parts orders endpoint
app.get('/api/parts_orders', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const sql = `SELECT json_agg(row_to_json(t)) FROM (
      SELECT * FROM parts_orders ORDER BY ordered_at DESC LIMIT ${limit} OFFSET ${offset}
    ) t;`;
    
    const result = await queryJSON(sql);
    res.json({ data: result || [] });
  } catch (error) {
    console.error('Parts orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Parts search endpoint
app.get('/api/parts/search', async (req, res) => {
  try {
    const { search, limit = 50, offset = 0, includeDescriptions = 'false' } = req.query;
    
    if (!search) {
      return res.status(400).json({ error: 'Search term required' });
    }
    
    const term = `%${search}%`;
    let whereClause = `WHERE (
      name ILIKE '${term}' OR 
      category ILIKE '${term}' OR 
      storage_location ILIKE '${term}'`;
    
    if (includeDescriptions === 'true') {
      whereClause += ` OR description ILIKE '${term}'`;
    }
    
    whereClause += ')';
    
    const sql = `SELECT json_agg(row_to_json(t)) FROM (
      SELECT id, name, description, category, current_quantity, minimum_quantity, 
             unit, parent_structure_id, storage_location, legacy_storage_vicinity, 
             accountable_person_id, 
             CASE 
               WHEN image_url LIKE '%supabase.co%' THEN 
                 REPLACE(image_url, 'https://oskwnlhuuxjfuwnjuavn.supabase.co/storage/v1/object/public/', 'https://cwf-dev-assets.s3.us-west-2.amazonaws.com/')
               ELSE image_url 
             END as image_url,
             created_at, updated_at 
      FROM parts ${whereClause} ORDER BY name LIMIT ${limit} OFFSET ${offset}
    ) t;`;
    
    const result = await queryJSON(sql);
    res.json({ data: result || [] });
  } catch (error) {
    console.error('Parts search error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`API server running on port ${port}`);
});
