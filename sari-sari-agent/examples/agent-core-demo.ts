/**
 * Agent Core Demo - Shows how to use the complete agent system
 */

import { AgentCore } from '../src/core/AgentCore';
import { SessionManager } from '../src/core/SessionManager';
import { NLPService } from '../src/nlp/NLPService';
import { InventoryService } from '../src/inventory/InventoryService';
import { PersonalityService } from '../src/personality/PersonalityService';
import { AIRouterConfig } from '../src/nlp/types';

async function runAgentDemo() {
  console.log('🤖 Sari Sari Agent Core Demo\n');

  // Initialize services
  console.log('Initializing services...');
  
  const sessionManager = new SessionManager();
  
  // Note: In a real implementation, you'd configure with actual AI providers
  const nlpConfig: AIRouterConfig = {
    preferredProvider: 'local',
    fallbackProvider: 'bedrock',
    localConfig: {
      enabled: false, // Disabled for demo
      baseUrl: 'http://localhost:11434',
      model: 'llama2'
    },
    bedrockConfig: {
      enabled: false, // Disabled for demo
      region: 'us-east-1',
      model: 'anthropic.claude-3-sonnet-20240229-v1:0'
    }
  };
  
  const nlpService = new NLPService(nlpConfig);
  const inventoryService = new InventoryService();
  const personalityService = new PersonalityService();

  const agentCore = new AgentCore({
    nlpService,
    inventoryService,
    sessionManager,
    personalityService
  });

  try {
    // Start a new session
    console.log('Starting new session...');
    const session = await agentCore.initializeSession('demo-customer');
    console.log(`✅ Session created: ${session.sessionId}\n`);

    // Get welcome message
    console.log('Getting welcome message...');
    const welcome = await agentCore.getWelcomeMessage(session.sessionId);
    console.log(`🤖 Agent: ${welcome.text}`);
    console.log(`💡 Suggestions: ${welcome.suggestions?.join(', ')}\n`);

    // Simulate conversation
    const messages = [
      'Hello!',
      'What products do you have?',
      'Tell me about tomatoes',
      'How much are tomatoes?',
      'Add 2 tomatoes to cart',
      'Can you do $3.00 for tomatoes?',
      'Thank you!'
    ];

    for (const message of messages) {
      console.log(`👤 Customer: ${message}`);
      
      try {
        const response = await agentCore.processMessage(session.sessionId, message);
        console.log(`🤖 Agent: ${response.text}`);
        
        if (response.suggestions && response.suggestions.length > 0) {
          console.log(`💡 Suggestions: ${response.suggestions.join(', ')}`);
        }
        
        if (response.products && response.products.length > 0) {
          console.log(`📦 Products shown: ${response.products.map(p => `${p.name} ($${p.price})`).join(', ')}`);
        }
        
        console.log(`⚡ Processing time: ${response.metadata.processingTime}ms`);
        console.log(`🎯 Intent: ${response.metadata.intent} (confidence: ${response.metadata.confidence})\n`);
        
      } catch (error) {
        console.log(`❌ Error processing message: ${error}\n`);
      }
    }

    // End session
    console.log('Ending session...');
    await agentCore.endSession(session.sessionId);
    console.log('✅ Session ended\n');

    // Show session statistics
    const stats = sessionManager.getSessionStats();
    console.log('📊 Session Statistics:');
    console.log(`   Active sessions: ${stats.activeSessions}`);
    console.log(`   Total sessions: ${stats.totalSessions}`);
    console.log(`   Average duration: ${Math.round(stats.averageSessionDuration / 1000)}s\n`);

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    // Cleanup
    await sessionManager.shutdown();
    console.log('🧹 Cleanup complete');
  }
}

// Run the demo
if (require.main === module) {
  runAgentDemo().catch(console.error);
}

export { runAgentDemo };