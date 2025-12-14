const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const lambda = new LambdaClient({ region: 'us-west-2' });

/**
 * Generate embedding using cwf-embeddings-lambda
 */
async function generateEmbedding(text) {
  if (!text || text.trim().length === 0) {
    return null;
  }

  const command = new InvokeCommand({
    FunctionName: 'cwf-embeddings-lambda',
    Payload: JSON.stringify({ text })
  });

  const response = await lambda.send(command);
  const result = JSON.parse(new TextDecoder().decode(response.Payload));
  const body = JSON.parse(result.body);
  
  return body.embedding;
}

/**
 * Build searchable text for a tool
 */
async function buildToolSearchText(client, toolId) {
  // Get tool with parent structure and accountable person
  const toolQuery = `
    SELECT 
      t.name,
      t.category,
      t.status,
      t.description,
      t.storage_location,
      t.serial_number,
      t.created_at,
      t.updated_at,
      parent.name as parent_structure_name,
      om.full_name as accountable_person_name
    FROM tools t
    LEFT JOIN tools parent ON t.parent_structure_id = parent.id
    LEFT JOIN organization_members om ON t.accountable_person_id = om.cognito_user_id
    WHERE t.id = '${toolId}'
  `;
  
  const toolResult = await client.query(toolQuery);
  if (!toolResult.rows || toolResult.rows.length === 0) return null;
  
  const tool = toolResult.rows[0];
  
  // Get issues
  const issuesQuery = `
    SELECT 
      i.description,
      i.reported_at,
      COALESCE(om.full_name, 'Unknown') as reported_by_name,
      COALESCE(
        (SELECT array_agg(a.title) 
         FROM actions a 
         WHERE a.linked_issue_id = i.id),
        ARRAY[]::text[]
      ) as action_titles
    FROM issues i
    LEFT JOIN organization_members om ON i.reported_by = om.cognito_user_id
    WHERE i.context_type = 'tool' AND i.context_id = '${toolId}'
    ORDER BY i.reported_at DESC
  `;
  
  const issuesResult = await client.query(issuesQuery);
  const issues = issuesResult.rows || [];
  
  // Get actions
  const actionsQuery = `
    SELECT 
      a.title,
      a.completed_at,
      a.created_at,
      a.policy,
      COALESCE(om.full_name, 'Unknown') as assigned_to_name,
      i.description as issue_description,
      (SELECT string_agg(update_text, ' ') 
       FROM action_implementation_updates 
       WHERE action_id = a.id) as implementation_notes
    FROM actions a
    LEFT JOIN organization_members om ON a.assigned_to = om.cognito_user_id
    LEFT JOIN issues i ON a.linked_issue_id = i.id
    WHERE a.asset_id = '${toolId}'
    ORDER BY COALESCE(a.completed_at, a.created_at) DESC
  `;
  
  const actionsResult = await client.query(actionsQuery);
  const actions = actionsResult.rows || [];
  
  // Build search text
  let searchText = `
${tool.name}
Category: ${tool.category || ''}
Status: ${tool.status || ''}
${tool.description || ''}
Location: ${tool.storage_location || ''}
Area: ${tool.parent_structure_name || ''}
Serial: ${tool.serial_number || ''}
Accountable: ${tool.accountable_person_name || ''}
Created: ${tool.created_at || ''}
Updated: ${tool.updated_at || ''}

Issues:
${issues.map(i => `
${i.description}
Reported: ${i.reported_at} by ${i.reported_by_name}
Actions taken: ${(i.action_titles || []).join(', ')}
`).join('\n')}

Actions:
${actions.map(a => `
${a.title}
Done: ${a.completed_at || a.created_at}
Worker: ${a.assigned_to_name}
${a.issue_description ? `Related issue: ${a.issue_description}` : ''}
Policy: ${a.policy || ''}
Notes: ${a.implementation_notes || ''}
`).join('\n')}
  `.trim();
  
  return searchText;
}

module.exports = {
  generateEmbedding,
  buildToolSearchText
};
