#!/usr/bin/env node
/**
 * Verify that all action attachments exist in S3
 * Reports any missing files that need to be migrated
 */

import { execSync } from 'child_process';

async function queryActions() {
  const sql = `SELECT id, title, attachments FROM actions WHERE attachments IS NOT NULL AND array_length(attachments, 1) > 0 AND attachments::text LIKE '%organizations/%' ORDER BY created_at DESC;`;
  
  const fs = await import('fs');
  fs.writeFileSync('/tmp/verify-query.json', JSON.stringify({ sql }));
  
  const command = `cat /tmp/verify-query.json | aws lambda invoke --function-name cwf-db-migration --payload file:///dev/stdin --region us-west-2 --cli-binary-format raw-in-base64-out /tmp/verify-response.json`;
  
  execSync(command, { stdio: 'ignore' });
  
  const output = fs.readFileSync('/tmp/verify-response.json', 'utf-8');
  const response = JSON.parse(output);
  const body = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
  
  return body.rows || [];
}

async function fileExists(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('🔍 Verifying migrated files...\n');
  
  const actions = await queryActions();
  console.log(`Found ${actions.length} actions to verify\n`);
  
  const missing = [];
  let totalFiles = 0;
  let checkedFiles = 0;
  
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    
    let attachments = action.attachments;
    if (typeof attachments === 'string') {
      attachments = JSON.parse(attachments);
    }
    
    totalFiles += attachments.length;
    
    for (const attachment of attachments) {
      checkedFiles++;
      
      // Show progress every 50 files
      if (checkedFiles % 50 === 0) {
        process.stdout.write(`\rChecked ${checkedFiles}/${totalFiles} files...`);
      }
      
      const imageUrl = `https://cwf-dev-assets.s3.us-west-2.amazonaws.com/${attachment}`;
      const exists = await fileExists(imageUrl);
      
      if (!exists) {
        // Extract filename to check old location
        const filename = attachment.split('/').pop();
        const oldUrl = `https://cwf-dev-assets.s3.us-west-2.amazonaws.com/mission-attachments/uploads/${filename}`;
        const existsInOldLocation = await fileExists(oldUrl);
        
        missing.push({
          actionId: action.id,
          actionTitle: action.title,
          newPath: attachment,
          filename,
          existsInOldLocation
        });
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
  
  console.log(`\rChecked ${checkedFiles}/${totalFiles} files... Done!\n`);
  
  if (missing.length === 0) {
    console.log('✅ All files exist in S3!');
  } else {
    console.log(`❌ Found ${missing.length} missing files:\n`);
    
    const needsMigration = missing.filter(m => m.existsInOldLocation);
    const trulyMissing = missing.filter(m => !m.existsInOldLocation);
    
    if (needsMigration.length > 0) {
      console.log(`📦 ${needsMigration.length} files need migration from old location:\n`);
      needsMigration.forEach(m => {
        console.log(`  Action: ${m.actionTitle}`);
        console.log(`  File: ${m.filename}`);
        console.log(`  Command: node scripts/migrate-single-attachment.mjs 00000000-0000-0000-0000-000000000001 "mission-attachments/uploads/${m.filename}"`);
        console.log('');
      });
    }
    
    if (trulyMissing.length > 0) {
      console.log(`⚠️  ${trulyMissing.length} files are missing from both locations:\n`);
      trulyMissing.forEach(m => {
        console.log(`  Action: ${m.actionTitle} (${m.actionId})`);
        console.log(`  File: ${m.filename}`);
        console.log('');
      });
    }
  }
}

main().catch(console.error);
