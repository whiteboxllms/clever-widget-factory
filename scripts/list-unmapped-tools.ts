/**
 * List all tools that need migration (no parent_structure_id)
 */

const API_BASE_URL = 'https://0720au267k.execute-api.us-west-2.amazonaws.com/prod';
const AUTH_TOKEN = process.argv[2];

if (!AUTH_TOKEN) {
  console.error('Usage: npx tsx scripts/list-unmapped-tools.ts <AUTH_TOKEN>');
  process.exit(1);
}

async function main() {
  const response = await fetch(`${API_BASE_URL}/api/tools?limit=1000`, {
    headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
  });
  
  const result = await response.json();
  const tools = result.data || [];
  
  const needsMigration = tools.filter((t: any) => 
    t.legacy_storage_vicinity && !t.parent_structure_id
  );
  
  console.log(`🔍 Tools Needing Migration: ${needsMigration.length}\n`);
  
  // Group by vicinity
  const byVicinity = new Map<string, any[]>();
  needsMigration.forEach((t: any) => {
    const v = t.legacy_storage_vicinity;
    if (!byVicinity.has(v)) byVicinity.set(v, []);
    byVicinity.get(v)!.push(t);
  });
  
  // Sort by count
  Array.from(byVicinity.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([vicinity, tools]) => {
      console.log(`${'='.repeat(80)}`);
      console.log(`📍 "${vicinity}" (${tools.length} tools)`);
      console.log('='.repeat(80));
      tools.forEach((t: any, i: number) => {
        console.log(`${i + 1}. [${t.category || 'Unknown'}] ${t.name} (${t.serial_number || 'no serial'})`);
      });
      console.log();
    });
}

main();
