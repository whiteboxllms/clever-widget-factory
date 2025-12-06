/**
 * Analyze "General" and other unmapped vicinities
 * 
 * This script examines tools in unmapped vicinities to understand:
 * - What types of tools are stored there
 * - Whether they need a real structure or a catch-all
 * - Suggested structure names/types
 * 
 * Run with: npx tsx scripts/analyze-general-vicinity.ts <AUTH_TOKEN>
 */

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'https://0720au267k.execute-api.us-west-2.amazonaws.com/prod';
const AUTH_TOKEN = process.argv[2] || process.env.AUTH_TOKEN;

if (!AUTH_TOKEN) {
  console.error('❌ Error: Auth token required');
  console.error('Usage: npx tsx scripts/analyze-general-vicinity.ts <AUTH_TOKEN>');
  process.exit(1);
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

async function main() {
  console.log('🔍 Analyzing Unmapped Vicinities\n');

  try {
    // Get all tools
    const toolsResult = await apiGet('/api/tools?limit=1000');
    const tools = toolsResult.data || [];

    // Get parent structures
    const structures = tools.filter((t: any) => 
      (t.category === 'Infrastructure' || t.category === 'Container') && 
      t.status !== 'removed'
    );

    // Find unmapped vicinities
    const structureNames = new Set(structures.map((s: any) => s.name.toLowerCase()));
    const unmappedTools = tools.filter((t: any) => {
      if (!t.legacy_storage_vicinity) return false;
      
      const vicinityLower = t.legacy_storage_vicinity.toLowerCase();
      
      // Check if it matches any structure (exact or partial)
      const hasMatch = structures.some((s: any) => {
        const structureLower = s.name.toLowerCase();
        return structureLower === vicinityLower ||
               structureLower.includes(vicinityLower) ||
               vicinityLower.includes(structureLower);
      });
      
      return !hasMatch;
    });

    // Group by vicinity
    const vicinityGroups = new Map<string, any[]>();
    unmappedTools.forEach((tool: any) => {
      const vicinity = tool.legacy_storage_vicinity;
      if (!vicinityGroups.has(vicinity)) {
        vicinityGroups.set(vicinity, []);
      }
      vicinityGroups.get(vicinity)!.push(tool);
    });

    console.log(`📊 Found ${vicinityGroups.size} unmapped vicinities with ${unmappedTools.length} tools\n`);

    // Analyze each vicinity
    Array.from(vicinityGroups.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .forEach(([vicinity, vicinityTools]) => {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📍 "${vicinity}" (${vicinityTools.length} tools)`);
        console.log('='.repeat(80));

        // Category breakdown
        const categories = new Map<string, number>();
        vicinityTools.forEach((t: any) => {
          const cat = t.category || 'Unknown';
          categories.set(cat, (categories.get(cat) || 0) + 1);
        });

        console.log('\n📦 Categories:');
        Array.from(categories.entries())
          .sort((a, b) => b[1] - a[1])
          .forEach(([cat, count]) => {
            console.log(`   ${cat}: ${count} tools`);
          });

        // Sample tools
        console.log('\n🔧 Sample Tools (first 10):');
        vicinityTools.slice(0, 10).forEach((t: any, i: any) => {
          console.log(`   ${i + 1}. [${t.category}] ${t.name}${t.serial_number ? ` (${t.serial_number})` : ''}`);
        });

        if (vicinityTools.length > 10) {
          console.log(`   ... and ${vicinityTools.length - 10} more`);
        }

        // Suggest structure type
        console.log('\n💡 Suggested Action:');
        if (vicinity.toLowerCase().includes('general') || vicinity.toLowerCase().includes('misc')) {
          console.log('   ⚠️  This appears to be a catch-all location');
          console.log('   Options:');
          console.log('   1. Create "General Storage" Infrastructure tool');
          console.log('   2. Review tools and assign to specific structures');
          console.log('   3. Create category-specific structures (e.g., "Hand Tools Storage")');
        } else {
          console.log(`   ✅ Create Infrastructure tool: "${vicinity}"`);
        }
      });

    // Summary recommendations
    console.log('\n\n' + '='.repeat(80));
    console.log('📋 SUMMARY & RECOMMENDATIONS');
    console.log('='.repeat(80));

    const generalTools = vicinityGroups.get('General') || [];
    if (generalTools.length > 0) {
      console.log('\n🎯 "General" Vicinity Strategy:');
      console.log(`   - Contains ${generalTools.length} tools across multiple categories`);
      console.log('   - Recommendation: Create "General Storage" Infrastructure tool');
      console.log('   - Alternative: Review and redistribute to specific structures');
    }

    console.log('\n📝 Structures to Create:');
    Array.from(vicinityGroups.keys())
      .sort()
      .forEach((vicinity, i) => {
        const count = vicinityGroups.get(vicinity)!.length;
        console.log(`   ${i + 1}. "${vicinity}" (${count} tools) - Infrastructure/Container`);
      });

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
