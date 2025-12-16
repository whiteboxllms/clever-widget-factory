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
// SECURITY: Password must be provided via environment variable
if (!process.env.RDS_PASSWORD) {
  throw new Error('RDS_PASSWORD environment variable is required');
}

const RDS_HOST = process.env.RDS_HOST || 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com';
const RDS_PORT = process.env.RDS_PORT || '5432';
const RDS_USER = process.env.RDS_USER || 'postgres';
const RDS_PASSWORD = process.env.RDS_PASSWORD;
const RDS_DATABASE = process.env.RDS_DATABASE || 'postgres';

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

// Organization members endpoint
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

// Actions endpoint
app.get('/api/actions', async (req, res) => {
  try {
    const { limit, offset = 0, assigned_to, status } = req.query;
    
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
        om.full_name as assigned_to_name,
        CASE WHEN scores.action_id IS NOT NULL THEN true ELSE false END as has_score
      FROM actions a
      LEFT JOIN organization_members om ON a.assigned_to = om.user_id
      LEFT JOIN action_scores scores ON a.id = scores.action_id
      ${whereClause} 
      ORDER BY a.created_at DESC 
      ${limitClause}
    ) t;`;
    
    const result = await queryJSON(sql);
    res.json({ data: result || [] });
  } catch (error) {
    console.error('Actions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Tools endpoint
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

// Parts endpoint
app.get('/api/parts', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const sql = `SELECT json_agg(row_to_json(t)) FROM (
      SELECT id, name, description, category, current_quantity, minimum_quantity, 
             unit, parent_structure_id, storage_location, legacy_storage_vicinity, 
             accountable_person_id, sellable, cost_per_unit,
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

// Sellable parts endpoint for sari-sari store
app.get('/api/parts/sellable', async (req, res) => {
  try {
    const sql = `SELECT json_agg(row_to_json(t)) FROM (
      SELECT id, name, description, category, current_quantity, minimum_quantity, 
             unit, cost_per_unit, sellable,
             CASE 
               WHEN image_url LIKE '%supabase.co%' THEN 
                 REPLACE(image_url, 'https://oskwnlhuuxjfuwnjuavn.supabase.co/storage/v1/object/public/', 'https://cwf-dev-assets.s3.us-west-2.amazonaws.com/')
               ELSE image_url 
             END as image_url,
             created_at, updated_at 
      FROM parts 
      WHERE sellable = true 
        AND current_quantity > 0
        AND (cost_per_unit > 0 OR description ILIKE '%free%' OR description ILIKE '%customer%')
      ORDER BY name
    ) t;`;
    
    const result = await queryJSON(sql);
    res.json({ data: result || [] });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`API server running on port ${port}`);
});