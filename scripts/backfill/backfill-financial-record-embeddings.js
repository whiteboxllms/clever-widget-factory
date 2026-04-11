#!/usr/bin/env node
/**
 * Backfill embeddings for all existing financial records via SQS queue.
 *
 * This script:
 * 1. Queries all financial records with their linked state_text and photo descriptions
 * 2. Composes embedding source using composeFinancialRecordEmbeddingSource (shared module)
 * 3. Sends SQS messages with entity_type: 'financial_record' to the embeddings queue
 * 4. Skips records with empty state_text and no photo descriptions
 * 5. Reports totals: processed, queued, skipped
 *
 * Usage:
 *   node scripts/backfill/backfill-financial-record-embeddings.js
 *   node scripts/backfill/backfill-financial-record-embeddings.js --dry-run
 *   node scripts/backfill/backfill-financial-record-embeddings.js --limit=50
 */

const { Pool } = require('pg');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const path = require('path');
const fs = require('fs');
const { composeFinancialRecordEmbeddingSource } = require('../../lambda/shared/embedding-composition');

// Parse CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = (() => {
  const limitArg = args.find(a => a.startsWith('--limit='));
  return limitArg ? parseInt(limitArg.split('=')[1]) : null;
})();

// Load env - parse .env.local manually to handle special chars in passwords
const envPath = path.join(__dirname, '..', '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx);
    const value = trimmed.substring(eqIdx + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

const REGION = 'us-west-2';
const QUEUE_URL = 'https://sqs.us-west-2.amazonaws.com/131745734428/cwf-embeddings-queue';
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 500;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => console.error('Pool error (non-fatal):', err.message));

const sqs = new SQSClient({ region: REGION });

/**
 * Small delay helper to avoid SQS throttling between batches.
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== Backfilling FINANCIAL RECORD embeddings via SQS ===');
  if (DRY_RUN) console.log('(DRY RUN — no SQS messages will be sent)\n');

  // Query all financial records with linked state_text and photo descriptions
  const query = `
    SELECT fr.id, fr.organization_id, s.state_text,
           ARRAY_AGG(sp.photo_description ORDER BY sp.photo_order) FILTER (WHERE sp.photo_description IS NOT NULL) AS photo_descriptions
    FROM financial_records fr
    JOIN state_links sl ON sl.entity_id = fr.id AND sl.entity_type = 'financial_record'
    JOIN states s ON s.id = sl.state_id
    LEFT JOIN state_photos sp ON sp.state_id = s.id
    GROUP BY fr.id, fr.organization_id, s.state_text
    ${LIMIT ? `LIMIT ${LIMIT}` : ''}
  `;

  console.log('Querying financial records with linked states...');
  const result = await pool.query(query);
  const records = result.rows;

  console.log(`Found ${records.length} financial records with linked states\n`);

  if (records.length === 0) {
    console.log('Nothing to backfill.');
    await pool.end();
    return;
  }

  let processed = 0;
  let queued = 0;
  let skipped = 0;

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const photoDescriptions = (record.photo_descriptions || []).filter(Boolean);

    // Compose embedding source using the shared function
    const embeddingSource = composeFinancialRecordEmbeddingSource({
      state_text: record.state_text || '',
      photo_descriptions: photoDescriptions
    });

    processed++;
    const num = i + 1;

    // Skip records with empty embedding source
    if (!embeddingSource || !embeddingSource.trim()) {
      console.log(`[${num}/${records.length}] ${record.id} — SKIPPED (empty state_text and no photo descriptions)`);
      skipped++;
      continue;
    }

    const display = embeddingSource.substring(0, 80);

    if (DRY_RUN) {
      console.log(`[${num}/${records.length}] ${display}...`);
      queued++;
      continue;
    }

    try {
      const message = JSON.stringify({
        entity_type: 'financial_record',
        entity_id: record.id,
        embedding_source: embeddingSource,
        organization_id: record.organization_id
      });

      await sqs.send(new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: message
      }));

      console.log(`[${num}/${records.length}] ${display}... QUEUED`);
      queued++;
    } catch (err) {
      console.error(`[${num}/${records.length}] ${record.id} — FAILED: ${err.message}`);
    }

    // Small delay between batches to avoid SQS throttling
    if (num % BATCH_SIZE === 0 && num < records.length) {
      await delay(BATCH_DELAY_MS);
    }
  }

  console.log('\n=== Backfill complete ===');
  console.log(`  Processed: ${processed}`);
  console.log(`  Queued:    ${queued}`);
  console.log(`  Skipped:   ${skipped}`);
  if (!DRY_RUN) {
    console.log('\nEmbeddings will be generated asynchronously by the processor.');
  }

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
