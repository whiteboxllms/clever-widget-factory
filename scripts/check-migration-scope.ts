/**
 * Check which tools will actually be migrated
 * (only those without parent_structure_id)
 */

const API_BASE_URL = 'https://0720au267k.execute-api.us-west-2.amazonaws.com/prod';
const AUTH_TOKEN = process.argv[2];

if (!AUTH_TOKEN) {
  console.error('Usage: npx tsx scripts/check-migration-scope.ts <AUTH_TOKEN>');
  process.exit(1);
}

async function main() {
  const response = await fetch(`${API_BASE_URL}/api/tools?limit=1000`, {
    headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
  });
  
  const result = await response.json();
  const tools = result.data || [];
  
  // Tools with legacy vicinity but NO parent structure (need migration)
  const needsMigration = tools.filter((t: any) => 
    t.legacy_storage_vicinity && !t.parent_structure_id
  );
  
  // Tools with BOTH legacy vicinity AND parent structure (already migrated)
  const alreadyMigrated = tools.filter((t: any) => 
    t.legacy_storage_vicinity && t.parent_structure_id
  );
  
  console.log('📊 Migration Scope Analysis\n');
  console.log(`Tools with legacy_storage_vicinity: ${tools.filter((t: any) => t.legacy_storage_vicinity).length}`);
  console.log(`  - Need migration (no parent_structure_id): ${needsMigration.length}`);
  console.log(`  - Already have parent_structure_id: ${alreadyMigrated.length}\n`);
  
  // Group by vicinity
  const byVicinity = new Map<string, { needsMigration: number, alreadyMigrated: number }>();
  
  needsMigration.forEach((t: any) => {
    const v = t.legacy_storage_vicinity;
    if (!byVicinity.has(v)) byVicinity.set(v, { needsMigration: 0, alreadyMigrated: 0 });
    byVicinity.get(v)!.needsMigration++;
  });
  
  alreadyMigrated.forEach((t: any) => {
    const v = t.legacy_storage_vicinity;
    if (!byVicinity.has(v)) byVicinity.set(v, { needsMigration: 0, alreadyMigrated: 0 });
    byVicinity.get(v)!.alreadyMigrated++;
  });
  
  console.log('By Vicinity:');
  Array.from(byVicinity.entries())
    .sort((a, b) => (b[1].needsMigration + b[1].alreadyMigrated) - (a[1].needsMigration + a[1].alreadyMigrated))
    .forEach(([vicinity, counts]) => {
      const total = counts.needsMigration + counts.alreadyMigrated;
      console.log(`  "${vicinity}": ${total} total (${counts.needsMigration} need migration, ${counts.alreadyMigrated} already have parent)`);
    });
}

main();
