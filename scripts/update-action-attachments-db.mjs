#!/usr/bin/env node
/**
 * Update database records to point to new organization-scoped attachment paths
 * 
 * This script:
 * 1. Queries all actions with mission-attachments paths
 * 2. For each action, replaces mission-attachments paths with organizations paths
 * 3. Updates the database
 * 
 * Run this AFTER migrating files in S3
 * 
 * Usage:
 *   node scripts/update-action-attachments-db.mjs [--dry-run] [--limit N]
 */

import { execSync } from 'child_process';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : null;

const S3_BUCKET_URL = 'https://cwf-dev-assets.s3.us-west-2.amazonaws.com';

function extractS3Key(urlOrKey) {
  if (!urlOrKey) return null;
  if (urlOrKey.startsWith('http://') || urlOrKey.startsWith('https://')) {
    return urlOrKey.replace(`${S3_BUCKET_URL}/`, '').replace(/^https?:\/\/[^\/]+\//, '');
  }
  return urlOrKey;
}

function convertToNewPath(oldPath, orgId) {
  const key = extractS3Key(oldPath);
  if (!key || !key.includes('mission-attachments')) {
    return oldPath; // Already migrated or not a legacy path
  }
  
  const filename = key.split('/').pop();
  return `organizations/${orgId}/images/${filename}`;
}

async function queryActions(limit) {
  console.log('📋 Querying actions...');
  
  const sql = `SELECT id, organization_id, title, attachments FROM actions WHERE attachments::text LIKE '%mission-attachments%' ORDER BY created_at DESC${limit ? ` LIMIT ${limit}` : ''};`;
  
  const fs = await import('fs');
  fs.writeFileSync('/tmp/query-actions.json', JSON.stringify({ sql }));
  
  const command = `cat /tmp/query-actions.json | aws lambda invoke --function-name cwf-db-migration --payload file:///dev/stdin --region us-west-2 --cli-binary-format raw-in-base64-out /tmp/query-actions-response.json && cat /tmp/query-actions-response.json`;
  
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    const response = JSON.parse(output);
    let body = response.body ? (typeof response.body === 'string' ? JSON.parse(response.body) : response.body) : response;
    return body.rows || [];
  } catch (error) {
    const fs = await import('fs');
    if (fs.existsSync('/tmp/query-actions-response.json')) {
      const output = fs.readFileSync('/tmp/query-actions-response.json', 'utf-8');
      const response = JSON.parse(output);
      let body = response.body ? (typeof response.body === 'string' ? JSON.parse(response.body) : response.body) : response;
      return body.rows || [];
    }
    throw error;
  }
}

async function updateAction(actionId, newAttachments) {
  const arrayLiteral = `ARRAY[${newAttachments.map(a => `'${a.replace(/'/g, "''")}'`).join(',')}]::text[]`;
  const sql = `UPDATE actions SET attachments = ${arrayLiteral}, updated_at = NOW() WHERE id = '${actionId}' RETURNING id;`;
  
  const fs = await import('fs');
  fs.writeFileSync('/tmp/update-action.json', JSON.stringify({ sql }));
  
  const command = `cat /tmp/update-action.json | aws lambda invoke --function-name cwf-db-migration --payload file:///dev/stdin --region us-west-2 --cli-binary-format raw-in-base64-out /tmp/update-action-response.json && cat /tmp/update-action-response.json`;
  
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    const response = JSON.parse(output);
    let body = response.body ? (typeof response.body === 'string' ? JSON.parse(response.body) : response.body) : response;
    return body.success;
  } catch (error) {
    const fs = await import('fs');
    if (fs.existsSync('/tmp/update-action-response.json')) {
      const output = fs.readFileSync('/tmp/update-action-response.json', 'utf-8');
      const response = JSON.parse(output);
      let body = response.body ? (typeof response.body === 'string' ? JSON.parse(response.body) : response.body) : response;
      return body.success;
    }
    return false;
  }
}

async function main() {
  console.log('🔄 Update Action Attachments Database');
  console.log('='.repeat(70));
  console.log(`Dry run: ${isDryRun}`);
  console.log(`Limit: ${limit || 'all'}`);
  console.log('');
  
  const actions = await queryActions(limit);
  
  if (actions.length === 0) {
    console.log('✅ No actions to update');
    return;
  }
  
  console.log(`Found ${actions.length} action(s) to update\n`);
  
  let updated = 0;
  let failed = 0;
  
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    console.log(`[${i + 1}/${actions.length}] ${action.title}`);
    
    let attachments = action.attachments;
    if (typeof attachments === 'string') {
      attachments = JSON.parse(attachments);
    }
    
    const newAttachments = attachments.map(a => convertToNewPath(a, action.organization_id));
    
    const hasChanges = JSON.stringify(attachments) !== JSON.stringify(newAttachments);
    
    if (!hasChanges) {
      console.log(`   ⏭️  Already migrated`);
      continue;
    }
    
    console.log(`   Old: ${attachments[0]}`);
    console.log(`   New: ${newAttachments[0]}`);
    
    if (isDryRun) {
      console.log(`   [DRY RUN] Would update`);
      updated++;
    } else {
      const success = await updateAction(action.id, newAttachments);
      if (success) {
        console.log(`   ✅ Updated`);
        updated++;
      } else {
        console.log(`   ❌ Failed`);
        failed++;
      }
    }
    
    console.log('');
  }
  
  console.log('='.repeat(70));
  console.log('📊 Summary');
  console.log('='.repeat(70));
  console.log(`Total actions: ${actions.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Failed: ${failed}`);
  
  if (isDryRun) {
    console.log('\nℹ️  This was a dry run. Run without --dry-run to update database.');
  } else if (updated > 0) {
    console.log('\n✅ Database update complete!');
  }
}

main().catch(console.error);
