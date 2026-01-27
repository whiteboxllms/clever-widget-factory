#!/usr/bin/env node
/**
 * Test AI Summarization for Actions
 * 
 * This script tests the AI summarization functionality before deploying
 * to ensure it works correctly with real action data.
 */

const { summarizeAction } = require('../shared/ai-summarizer');

// Sample action data (verbose observations)
const testAction = {
  description: 'Applied compost to banana plants',
  evidence_description: 'Spread 2 inches of aged compost around the base of 15 banana plants',
  policy: 'Organic matter improves soil structure and provides slow-release nutrients',
  observations: `Started at 7am when soil was still moist from morning dew. Used wheelbarrow to transport compost from the rotary composter. Each plant received approximately 5kg of compost. Made sure to keep compost 6 inches away from the trunk to prevent rot. Noticed some plants had yellowing leaves - these got extra compost. The compost was well-aged (6 months) with earthworms present, indicating good decomposition. Temperature was 28°C, partly cloudy. Finished by 9am. Will monitor plant response over next 2 weeks.`,
  assets: ['Wheelbarrow', 'Shovel', 'Rotary Composter', 'Banana Plants']
};

async function testSummarization() {
  console.log('🧪 Testing AI Summarization\n');
  console.log('Original Action Data:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Description: ${testAction.description}`);
  console.log(`Evidence: ${testAction.evidence_description}`);
  console.log(`Policy: ${testAction.policy}`);
  console.log(`Observations: ${testAction.observations}`);
  console.log(`Assets: ${testAction.assets.join(', ')}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('Generating AI summary...\n');
  
  try {
    const summary = await summarizeAction(testAction);
    
    console.log('✅ AI-Generated Summary:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(summary);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('📊 Comparison:');
    console.log(`   Original length: ${testAction.observations.length} chars`);
    console.log(`   Summary length: ${summary.length} chars`);
    console.log(`   Reduction: ${Math.round((1 - summary.length / testAction.observations.length) * 100)}%\n`);
    
    console.log('✅ Summarization test passed!');
  } catch (error) {
    console.error('❌ Summarization test failed:', error);
    process.exit(1);
  }
}

testSummarization();
