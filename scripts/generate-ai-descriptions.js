#!/usr/bin/env node

/**
 * Generate AI descriptions using AWS Bedrock Claude Haiku
 * Usage: node scripts/generate-ai-descriptions.js <csv-file> [num-parts]
 */

const fs = require('fs');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-west-2' });
const MODEL_ID = 'anthropic.claude-3-5-haiku-20241022-v1:0';

async function generatePartDescription(partData) {
  const prompt = `You are a hardware inventory specialist. Given a part name and details, provide:
1. Standardized name (proper capitalization, clear, concise)
2. Description (1 sentence describing physical characteristics)
3. Policy (1 sentence on how to use it properly)

Part Details:
- Name: ${partData.name}
- Current Description: ${partData.current_description || 'None'}
- Category: ${partData.category || 'Unknown'}
- Unit: ${partData.unit || 'pieces'}

Respond in JSON format:
{
  "standardized_name": "...",
  "description": "...",
  "policy": "..."
}`;

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 300,
    temperature: 0.1,
    messages: [{ role: "user", content: prompt }]
  };

  const command = new InvokeModelCommand({
    modelId: MODEL_ID,
    body: JSON.stringify(payload),
    contentType: 'application/json',
    accept: 'application/json'
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  
  if (responseBody.content?.[0]?.text) {
    const text = responseBody.content[0].text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  }
  
  throw new Error('Invalid response from Bedrock');
}

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  
  return fields;
}

function escapeCSV(value) {
  if (!value) return '""';
  const str = String(value);
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

async function main() {
  const csvFile = process.argv[2];
  const numParts = parseInt(process.argv[3] || '5', 10);

  if (!csvFile) {
    console.error('Usage: node scripts/generate-ai-descriptions.js <csv-file> [num-parts]');
    console.error('Example: node scripts/generate-ai-descriptions.js parts-review.csv 5');
    process.exit(1);
  }

  if (!fs.existsSync(csvFile)) {
    console.error(`Error: File not found: ${csvFile}`);
    process.exit(1);
  }

  const outputFile = csvFile.replace('.csv', '-ai-generated.csv');

  console.log('🤖 Generating AI descriptions using Claude Haiku via AWS Bedrock...');
  console.log(`   Input: ${csvFile}`);
  console.log(`   Output: ${outputFile}`);
  console.log(`   Processing: ${numParts} parts`);
  console.log('');

  // Read CSV file
  const content = fs.readFileSync(csvFile, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  // Parse header
  const header = parseCSVLine(lines[0]);
  const idIndex = header.indexOf('id');
  const nameIndex = header.indexOf('name');
  const descIndex = header.indexOf('current_description');
  const categoryIndex = header.indexOf('category');
  const unitIndex = header.indexOf('unit');

  // Create output CSV with header
  const outputLines = ['id,original_name,standardized_name,ai_description,ai_policy'];

  // Process first N parts
  for (let i = 1; i <= Math.min(numParts, lines.length - 1); i++) {
    const fields = parseCSVLine(lines[i]);
    
    const partData = {
      id: fields[idIndex],
      name: fields[nameIndex],
      current_description: fields[descIndex],
      category: fields[categoryIndex],
      unit: fields[unitIndex]
    };

    console.log(`[${i}/${numParts}] Processing: ${partData.name}`);

    try {
      const result = await generatePartDescription(partData);
      
      const outputLine = [
        escapeCSV(partData.id),
        escapeCSV(partData.name),
        escapeCSV(result.standardized_name),
        escapeCSV(result.description),
        escapeCSV(result.policy)
      ].join(',');
      
      outputLines.push(outputLine);
      
      console.log(`   ✓ Standardized: ${result.standardized_name}`);
      console.log('');
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`   ✗ Error: ${error.message}`);
      console.log('');
      
      // Add error row
      const outputLine = [
        escapeCSV(partData.id),
        escapeCSV(partData.name),
        escapeCSV(partData.name),
        escapeCSV('ERROR: ' + error.message),
        escapeCSV('')
      ].join(',');
      outputLines.push(outputLine);
    }
  }

  // Write output file
  fs.writeFileSync(outputFile, outputLines.join('\n') + '\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ AI generation complete!');
  console.log(`   Output: ${outputFile}`);
  console.log('');
  console.log('Review the results and if satisfied, run with more parts:');
  console.log(`  node scripts/generate-ai-descriptions.js ${csvFile} 100`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
