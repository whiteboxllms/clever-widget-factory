import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Helper to execute SQL and return JSON
async function queryJSON(sql) {
  const command = `PGPASSWORD='CWF_Dev_2025!' psql -h cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com -U postgres -d postgres -t -c "${sql}"`;
  const { stdout } = await execAsync(command);
  return JSON.parse(stdout.trim());
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
