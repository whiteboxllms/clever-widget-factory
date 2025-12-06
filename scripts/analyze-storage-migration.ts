/**
 * Storage Vicinity to Parent Structure Migration Analysis
 * 
 * This script analyzes the current usage of storage_vicinities and suggests
 * a mapping to parent_structures (Infrastructure/Container tools).
 * 
 * Run with: npx tsx scripts/analyze-storage-migration.ts
 */

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'https://0720au267k.execute-api.us-west-2.amazonaws.com/prod';
const AUTH_TOKEN = process.argv[2] || process.env.AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.error('❌ Error: Auth token required');
  console.error('Usage: npx tsx scripts/analyze-storage-migration.ts <AUTH_TOKEN>');
  console.error('Or set AUTH_TOKEN environment variable');
  process.exit(1);
}

interface StorageVicinity {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface ParentStructure {
  id: string;
  name: string;
  serial_number?: string;
  category: string;
}

interface UsageCount {
  vicinity_name: string;
  tool_count: number;
  part_count: number;
}

async function apiGet(endpoint: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API call failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

async function getStorageVicinities(): Promise<StorageVicinity[]> {
  console.log('   Note: storage_vicinities API not implemented, deriving from tools data...');
  // We'll derive vicinities from tools that use them
  return [];
}

async function getParentStructures(): Promise<ParentStructure[]> {
  console.log('   Fetching parent structures (Infrastructure/Container tools)...');
  const result = await apiGet('/api/tools?limit=1000');
  const allTools = result.data || [];
  return allTools.filter((t: any) => 
    (t.category === 'Infrastructure' || t.category === 'Container') && 
    t.status !== 'removed'
  );
}

async function getVicinityUsage(): Promise<Map<string, UsageCount>> {
  console.log('   Analyzing vicinity usage (tools only - parts API not yet implemented)...');
  
  // Get all tools
  const toolsResult = await apiGet('/api/tools?limit=1000');
  const tools = toolsResult.data || [];

  const usageMap = new Map<string, UsageCount>();

  // Count tools by vicinity
  tools.forEach((tool: any) => {
    if (tool.legacy_storage_vicinity) {
      const existing = usageMap.get(tool.legacy_storage_vicinity);
      if (existing) {
        existing.tool_count++;
      } else {
        usageMap.set(tool.legacy_storage_vicinity, {
          vicinity_name: tool.legacy_storage_vicinity,
          tool_count: 1,
          part_count: 0 // Parts API not implemented yet
        });
      }
    }
  });

  return usageMap;
}

function suggestMapping(
  vicinities: StorageVicinity[],
  structures: ParentStructure[],
  usage: Map<string, UsageCount>
): Map<string, string | null> {
  const mapping = new Map<string, string | null>();

  vicinities.forEach(vicinity => {
    // Try to find exact name match
    let match = structures.find(s => 
      s.name.toLowerCase() === vicinity.name.toLowerCase()
    );

    // Try partial match
    if (!match) {
      match = structures.find(s => 
        s.name.toLowerCase().includes(vicinity.name.toLowerCase()) ||
        vicinity.name.toLowerCase().includes(s.name.toLowerCase())
      );
    }

    mapping.set(vicinity.name, match?.id || null);
  });

  return mapping;
}

async function main() {
  console.log('🔍 Analyzing Storage Vicinity → Parent Structure Migration\n');

  try {
    console.log('Fetching data from database...');
    const [vicinities, structures, usageMap] = await Promise.all([
      getStorageVicinities(),
      getParentStructures(),
      getVicinityUsage()
    ]);

    console.log(`\n📊 Current State:`);
    console.log(`   - Parent Structures (Infrastructure/Container): ${structures.length}`);
    console.log(`   - Legacy Vicinities in use: ${usageMap.size}\n`);

    // Show parent structures
    console.log('🏗️  Available Parent Structures:');
    structures.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.name} (${s.category})${s.serial_number ? ` - ${s.serial_number}` : ''}`);
    });

    // Show vicinities with usage (derived from tools)
    console.log('\n📍 Legacy Storage Vicinities (found in tools):');
    Array.from(usageMap.values())
      .sort((a, b) => (b.tool_count + b.part_count) - (a.tool_count + a.part_count))
      .forEach(usage => {
        const total = usage.tool_count + usage.part_count;
        console.log(`   - "${usage.vicinity_name}": ${total} tools`);
      });

    // Suggest mapping based on actual vicinities found
    console.log('\n🔗 Suggested Mapping:');
    const vicinityNames = Array.from(usageMap.keys());
    const mapping = new Map<string, string | null>();
    
    vicinityNames.forEach(vicinityName => {
      // Try exact match
      let match = structures.find(s => 
        s.name.toLowerCase() === vicinityName.toLowerCase()
      );
      
      // Try partial match
      if (!match) {
        match = structures.find(s => 
          s.name.toLowerCase().includes(vicinityName.toLowerCase()) ||
          vicinityName.toLowerCase().includes(s.name.toLowerCase())
        );
      }
      
      mapping.set(vicinityName, match?.id || null);
    });
    
    vicinityNames.forEach(vicinityName => {
      const structureId = mapping.get(vicinityName);
      const structure = structures.find(s => s.id === structureId);
      const usage = usageMap.get(vicinityName);
      const total = (usage?.tool_count || 0) + (usage?.part_count || 0);
      
      if (structure) {
        console.log(`   ✅ "${vicinityName}" → "${structure.name}" (${total} tools)`);
      } else {
        console.log(`   ❌ "${vicinityName}" → NO MATCH FOUND (${total} tools) - NEEDS MANUAL MAPPING`);
      }
    });

    // Generate migration SQL
    console.log('\n📝 Migration SQL (review before running):');
    console.log('```sql');
    
    vicinityNames.forEach(vicinityName => {
      const structureId = mapping.get(vicinityName);
      const usage = usageMap.get(vicinityName);
      
      if (structureId && usage) {
        const structure = structures.find(s => s.id === structureId);
        console.log(`\n-- Migrate "${vicinityName}" to "${structure?.name}"`);
        
        if (usage.tool_count > 0) {
          console.log(`UPDATE tools 
SET parent_structure_id = '${structureId}'
WHERE legacy_storage_vicinity = '${vicinityName}'
  AND parent_structure_id IS NULL;`);
        }
        
        if (usage.part_count > 0) {
          console.log(`UPDATE parts 
SET parent_structure_id = '${structureId}'
WHERE legacy_storage_vicinity = '${vicinityName}'
  AND parent_structure_id IS NULL;`);
        }
      }
    });
    
    console.log('```\n');

    // Summary
    const matchedCount = Array.from(mapping.values()).filter(v => v !== null).length;
    const unmatchedCount = vicinityNames.length - matchedCount;
    
    console.log('📈 Summary:');
    console.log(`   - Matched: ${matchedCount}/${vicinities.length}`);
    console.log(`   - Unmatched: ${unmatchedCount}/${vicinities.length}`);
    
    if (unmatchedCount > 0) {
      console.log('\n⚠️  Action Required:');
      console.log('   1. Create missing parent structures (Infrastructure/Container tools)');
      console.log('   2. Or manually map vicinities to existing structures');
      console.log('   3. Run migration SQL after mapping is complete');
    } else {
      console.log('\n✅ All vicinities can be mapped! Ready to migrate.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
