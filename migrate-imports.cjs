#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const srcDir = './src';

function replaceInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Replace Supabase client import
  const newContent = content.replace(
    /import\s+{\s*supabase\s*}\s+from\s+['"]@\/integrations\/supabase\/client['"];?/g,
    "import { supabase } from '@/lib/client';"
  );
  
  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent);
    console.log(`Updated: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      replaceInFile(filePath);
    }
  });
}

console.log('Starting Supabase import migration...');
walkDir(srcDir);
console.log('Migration complete!');
