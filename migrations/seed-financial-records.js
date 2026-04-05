#!/usr/bin/env node
/**
 * Seed script: Parse "Petty Cash Tracking - Expense.csv" and generate
 * INSERT SQL for financial_records, states, and state_links tables.
 *
 * Usage:
 *   node migrations/seed-financial-records.js > migrations/seed-financial-records.sql
 *   # Then run via cwf-db-migration Lambda
 *
 * For each CSV row, emits a CTE that:
 *   1. INSERTs into financial_records (lean schema: no description/photos/category/per_unit_price)
 *   2. INSERTs into states (state_text holds composed description)
 *   3. INSERTs into state_links (links state to financial_record)
 *
 * Descriptions, categories, per-unit prices, and photo URLs are composed
 * into states.state_text per the format specification.
 */

const fs = require('fs');
const path = require('path');

// Config
const ORG_ID = '00000000-0000-0000-0000-000000000001';

// Purchaser → cognito_user_id mapping
const PURCHASER_MAP = {
  'Mae':      '1891f310-c071-705a-2c72-0d0a33c92bf0',
  'Lester':   '68d173b0-60f1-70ea-6084-338e74051fcc',
  'Stefan':   '08617390-b001-708d-f61e-07a1698282ec',
  'Malone':   '989163e0-7011-70ee-6d93-853674acd43c',
};
// Jun Jun, Mark, Kuya Juan, Janeth, Dhodie, empty → NULL

const csvPath = path.join(__dirname, 'data', 'Petty Cash Tracking - Expense.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// ---------------------------------------------------------------------------
// CSV Parser (kept from original — works correctly)
// ---------------------------------------------------------------------------
function parseCSV(text) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  const lines = text.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;
    current += (current ? '\n' : '') + line;

    let quoteCount = 0;
    for (const ch of current) {
      if (ch === '"') quoteCount++;
    }
    inQuotes = quoteCount % 2 !== 0;

    if (!inQuotes) {
      rows.push(parseCSVLine(current));
      current = '';
    }
  }
  return rows;
}

function parseCSVLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(field.trim());
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field.trim());
  return fields;
}

// ---------------------------------------------------------------------------
// Strict date parsing: M/D/YYYY — throws on unparseable
// ---------------------------------------------------------------------------
function parseDate(dateStr, rowNum) {
  if (!dateStr || !dateStr.trim()) {
    throw new Error(`Row ${rowNum}: empty date`);
  }
  dateStr = dateStr.trim();

  const parts = dateStr.split('/');
  if (parts.length !== 3) {
    throw new Error(`Row ${rowNum}: invalid date format "${dateStr}" (expected M/D/YYYY)`);
  }

  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (isNaN(month) || isNaN(day) || isNaN(year)) {
    throw new Error(`Row ${rowNum}: unparseable date "${dateStr}"`);
  }
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2099) {
    throw new Error(`Row ${rowNum}: date out of range "${dateStr}"`);
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Strict amount parsing — throws on non-numeric (strips commas first)
// ---------------------------------------------------------------------------
function parseAmount(amtStr, rowNum) {
  if (!amtStr || !amtStr.trim()) {
    return null; // empty amount — row will be skipped
  }
  const cleaned = amtStr.replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) {
    throw new Error(`Row ${rowNum}: non-numeric amount "${amtStr}"`);
  }
  return num;
}

// ---------------------------------------------------------------------------
// SQL escaping
// ---------------------------------------------------------------------------
function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

// ---------------------------------------------------------------------------
// Compose state_text per Requirement 3
// ---------------------------------------------------------------------------
function composeStateText(purchaser, transaction, comment, category, perUnitPrice, photoUrl) {
  let parts = [];

  // Core: [Purchaser] Transaction — Comment
  const hasPurchaser = purchaser && purchaser.trim();
  const hasTransaction = transaction && transaction.trim();
  const hasComment = comment && comment.trim() && comment.trim() !== (transaction || '').trim();

  let core = '';
  if (hasTransaction && hasComment) {
    if (hasPurchaser) {
      core = `[${purchaser.trim()}] ${transaction.trim()} — ${comment.trim()}`;
    } else {
      core = `${transaction.trim()} — ${comment.trim()}`;
    }
  } else if (hasTransaction) {
    if (hasPurchaser) {
      core = `[${purchaser.trim()}] ${transaction.trim()}`;
    } else {
      core = transaction.trim();
    }
  } else if (hasComment) {
    if (hasPurchaser) {
      core = `[${purchaser.trim()}] ${comment.trim()}`;
    } else {
      core = comment.trim();
    }
  } else {
    // Both Transaction and Comment empty — fall back to Category, then "Transaction"
    const fallback = (category && category.trim()) ? category.trim() : 'Transaction';
    if (hasPurchaser) {
      core = `[${purchaser.trim()}] ${fallback}`;
    } else {
      core = fallback;
    }
  }

  parts.push(core);

  // Parenthetical: (Category: X, ₱Y/unit) or (Category: X) or (₱Y/unit)
  const hasCategory = category && category.trim();
  const pup = perUnitPrice && perUnitPrice.trim() ? parseFloat(perUnitPrice.replace(/,/g, '').trim()) : null;
  const hasPerUnit = pup !== null && !isNaN(pup) && pup > 0;

  if (hasCategory || hasPerUnit) {
    let parenParts = [];
    if (hasCategory) parenParts.push(`Category: ${category.trim()}`);
    if (hasPerUnit) parenParts.push(`₱${pup.toFixed(2)}/unit`);
    parts.push(`(${parenParts.join(', ')})`);
  }

  // Photo URL
  if (photoUrl && photoUrl.trim() && photoUrl.trim().startsWith('http')) {
    parts.push(`{{photo:${photoUrl.trim()}}}`);
  }

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Resolve purchaser to cognito_user_id (or null)
// ---------------------------------------------------------------------------
function resolvePurchaser(purchaserName) {
  if (!purchaserName || !purchaserName.trim()) return null;
  const name = purchaserName.trim();
  return PURCHASER_MAP[name] || null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const rows = parseCSV(csvContent);
const header = rows[0];
const dataRows = rows.slice(1);

const statements = [];
let skippedZero = 0;

for (let i = 0; i < dataRows.length; i++) {
  const row = dataRows[i];
  const rowNum = i + 2; // 1-indexed, +1 for header

  if (row.length < 5) {
    throw new Error(`Row ${rowNum}: too few columns (${row.length})`);
  }

  const dateStr = row[0];
  const transaction = row[1] || '';
  const paymentMethod = row[2] || '';
  const category = row[3] || '';
  const amountStr = row[4] || '';
  const imageLink = row.length > 8 ? row[8] : '';
  const purchaser = row.length > 9 ? row[9] : '';
  const perUnitPrice = row.length > 10 ? row[10] : '';
  const comment = row.length > 11 ? row[11] : '';

  // Strict date parsing
  const transactionDate = parseDate(dateStr, rowNum);

  // Strict amount parsing
  const amount = parseAmount(amountStr, rowNum);

  // Skip rows with 0 or empty amount (reconcile rows / incomplete entries)
  if (amount === null || amount === 0) {
    skippedZero++;
    continue;
  }

  // Validate payment method
  const pm = paymentMethod.trim();
  if (!pm) {
    throw new Error(`Row ${rowNum}: empty payment method`);
  }

  // Resolve purchaser
  const userId = resolvePurchaser(purchaser);
  const createdBySQL = userId ? `'${userId}'` : 'NULL';
  const capturedBySQL = userId ? `'${userId}'` : 'NULL';

  // Compose state_text
  const stateText = composeStateText(purchaser, transaction, comment, category, perUnitPrice, imageLink);

  // Timestamp: transaction_date at 08:00 UTC
  const timestamp = `${transactionDate}T08:00:00Z`;

  // Build CTE for this row
  const sql = `WITH fr AS (
  INSERT INTO financial_records (id, organization_id, created_by, transaction_date, amount, payment_method, created_at, updated_at)
  VALUES (gen_random_uuid(), '${ORG_ID}', ${createdBySQL}, ${escapeSQL(transactionDate)}, ${amount}, ${escapeSQL(pm)}, '${timestamp}', '${timestamp}')
  RETURNING id
), st AS (
  INSERT INTO states (id, organization_id, state_text, captured_by, captured_at, created_at, updated_at)
  VALUES (gen_random_uuid(), '${ORG_ID}', ${escapeSQL(stateText)}, ${capturedBySQL}, '${timestamp}', '${timestamp}', '${timestamp}')
  RETURNING id
)
INSERT INTO state_links (state_id, entity_type, entity_id)
SELECT st.id, 'financial_record', fr.id FROM st, fr;`;

  statements.push(sql);
}

// Output
console.log('-- Seed financial_records + states + state_links from CSV');
console.log(`-- Generated ${statements.length} rows from ${dataRows.length} CSV rows (skipped ${skippedZero} zero-amount reconcile rows)`);
console.log('BEGIN;');
console.log('');
statements.forEach((sql, idx) => {
  console.log(`-- Row ${idx + 1}`);
  console.log(sql);
  console.log('');
});
console.log('COMMIT;');
