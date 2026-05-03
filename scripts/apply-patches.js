#!/usr/bin/env node
/**
 * Applies local patches to node_modules after npm install.
 *
 * Patch: tailwindcss expandApplyAtRules — PostCSS 8.5 compatibility
 * When PostCSS 8.5 is used (bundled inside Vite 7+), Tailwind v3's
 * expandApplyAtRules generates @apply nodes with empty params during
 * @tailwind directive processing. This guard skips those empty nodes
 * instead of throwing "The `` class does not exist".
 */

const fs = require('fs');
const path = require('path');

const TARGET = path.join(__dirname, '../node_modules/tailwindcss/lib/lib/expandApplyAtRules.js');

if (!fs.existsSync(TARGET)) {
  console.log('[patch] tailwindcss not found, skipping');
  process.exit(0);
}

let src = fs.readFileSync(TARGET, 'utf8');

const MARKER = '// PATCHED: postcss-8.5-compat';
if (src.includes(MARKER)) {
  console.log('[patch] tailwindcss already patched');
  process.exit(0);
}

const ORIGINAL = `        let [applyCandidates, important] = extractApplyCandidates(apply.params);`;
const PATCHED  = `        let [applyCandidates, important] = extractApplyCandidates(apply.params);
        ${MARKER}
        if (applyCandidates.length === 0 || (applyCandidates.length === 1 && applyCandidates[0] === '')) continue;`;

if (!src.includes(ORIGINAL)) {
  console.log('[patch] tailwindcss patch target not found — may already be fixed upstream');
  process.exit(0);
}

src = src.replace(ORIGINAL, PATCHED);
fs.writeFileSync(TARGET, src, 'utf8');
console.log('[patch] tailwindcss expandApplyAtRules patched for PostCSS 8.5 compatibility');
