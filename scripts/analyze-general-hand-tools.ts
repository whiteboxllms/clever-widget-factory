/**
 * Analyze Hand Tools in "General" vicinity
 */

const API_BASE_URL = 'https://0720au267k.execute-api.us-west-2.amazonaws.com/prod';
const AUTH_TOKEN = process.argv[2];

if (!AUTH_TOKEN) {
  console.error('Usage: npx tsx scripts/analyze-general-hand-tools.ts <AUTH_TOKEN>');
  process.exit(1);
}

async function main() {
  const response = await fetch(`${API_BASE_URL}/api/tools?limit=1000`, {
    headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` }
  });
  
  const result = await response.json();
  const tools = result.data || [];
  
  const generalHandTools = tools.filter((t: any) => 
    t.legacy_storage_vicinity === 'General' && 
    t.category === 'Hand Tools'
  );
  
  console.log(`🔧 Hand Tools in "General" vicinity: ${generalHandTools.length}\n`);
  
  generalHandTools.forEach((t: any, i: number) => {
    console.log(`${i + 1}. ${t.name} (${t.serial_number || 'no serial'})`);
  });
}

main();
