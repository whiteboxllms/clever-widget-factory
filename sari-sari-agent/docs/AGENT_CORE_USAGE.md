# Agent Core Usage Guide

The Agent Core is the main orchestration service that ties together all components of the Sari Sari Agent system. It handles conversation flow, session management, and coordinates between NLP, inventory, and personality services.

## Quick Start

### Using the Agent Factory (Recommended)

```typescript
import { AgentFactory } from '../src/core';

// Create agent with default configuration
const agent = await AgentFactory.createAgent();

// Start a conversation
const session = await agent.initializeSession();
const welcome = await agent.getWelcomeMessage(session.sessionId);
console.log(welcome.text);

// Process customer messages
const response = await agent.processMessage(session.sessionId, "What products do you have?");
console.log(response.text);

// End session
await agent.endSession(session.sessionId);
```

### Manual Setup

```typescript
import { AgentCore, SessionManager } from '../src/core';
import { NLPService } from '../src/nlp/NLPService';
import { InventoryService } from '../src/inventory/InventoryService';
import { PersonalityService } from '../src/personality/PersonalityService';

// Initialize services
const sessionManager = new SessionManager();
const nlpService = new NLPService(nlpConfig);
const inventoryService = new InventoryService();
const personalityService = new PersonalityService();

// Create agent
const agent = new AgentCore({
  nlpService,
  inventoryService,
  sessionManager,
  personalityService
});
```

## Configuration Options

### Agent Factory Configurations

#### Local AI Setup
```typescript
const agent = await AgentFactory.createLocalAgent({
  baseUrl: 'http://localhost:11434',
  model: 'llama2'
});
```

#### Cloud AI Setup
```typescript
const agent = await AgentFactory.createCloudAgent({
  region: 'us-east-1',
  model: 'anthropic.claude-3-sonnet-20240229-v1:0'
});
```

#### Test/Development Setup
```typescript
const agent = await AgentFactory.createTestAgent();
```

#### Custom Configuration
```typescript
const agent = await AgentFactory.createAgent({
  nlp: {
    preferredProvider: 'local',
    fallbackProvider: 'bedrock',
    localConfig: {
      enabled: true,
      baseUrl: 'http://localhost:11434',
      model: 'llama2'
    },
    bedrockConfig: {
      enabled: true,
      region: 'us-east-1',
      model: 'anthropic.claude-3-sonnet-20240229-v1:0'
    }
  },
  session: {
    timeoutMs: 30 * 60 * 1000, // 30 minutes
    cleanupIntervalMs: 5 * 60 * 1000 // 5 minutes
  }
});
```

## Core Methods

### Session Management

#### `initializeSession(customerId?: string): Promise<SessionInfo>`
Creates a new conversation session.

```typescript
const session = await agent.initializeSession('customer-123');
console.log(session.sessionId); // Unique session ID
console.log(session.expiresAt); // Session expiration time
```

#### `endSession(sessionId: string): Promise<void>`
Ends a conversation session and cleans up resources.

```typescript
await agent.endSession(session.sessionId);
```

#### `getWelcomeMessage(sessionId: string): Promise<AgentResponse>`
Generates a personalized welcome message with product suggestions.

```typescript
const welcome = await agent.getWelcomeMessage(session.sessionId);
console.log(welcome.text); // Welcome message
console.log(welcome.suggestions); // Suggested actions
console.log(welcome.products); // Featured products
```

### Message Processing

#### `processMessage(sessionId: string, message: string): Promise<AgentResponse>`
Processes customer messages and generates appropriate responses.

```typescript
const response = await agent.processMessage(session.sessionId, "Show me vegetables");

console.log(response.text); // Agent response text
console.log(response.suggestions); // Suggested follow-up actions
console.log(response.products); // Relevant products
console.log(response.actions); // Available actions (add to cart, etc.)
console.log(response.metadata.intent); // Detected intent
console.log(response.metadata.confidence); // Confidence score
console.log(response.metadata.processingTime); // Processing time in ms
```

## Response Structure

### AgentResponse
```typescript
interface AgentResponse {
  text: string;                    // Main response text
  suggestions?: string[];          // Suggested user actions
  products?: ProductInfo[];        // Relevant products
  actions?: ActionItem[];          // Available actions
  metadata: ResponseMetadata;      // Processing metadata
}
```

### ProductInfo
```typescript
interface ProductInfo {
  id: string;
  name: string;
  price: number;
  availability: 'in-stock' | 'low-stock' | 'out-of-stock';
  description?: string;
}
```

### ActionItem
```typescript
interface ActionItem {
  type: 'add-to-cart' | 'view-product' | 'negotiate-price' | 'checkout';
  productId?: string;
  data?: Record<string, any>;
}
```

## Supported Intents

The agent can handle the following customer intents:

- **GREETING**: "Hello", "Hi there"
- **BROWSE_PRODUCTS**: "What do you have?", "Show me vegetables"
- **PRODUCT_INQUIRY**: "Tell me about tomatoes", "What's fresh today?"
- **PRICE_CHECK**: "How much are tomatoes?", "What's the price?"
- **ADD_TO_CART**: "Add 2 tomatoes to cart", "I'll take some lettuce"
- **NEGOTIATE_PRICE**: "Can you do $3 for tomatoes?", "What's your best price?"
- **FAREWELL**: "Thank you", "Goodbye"

## Error Handling

The agent includes comprehensive error handling:

```typescript
try {
  const response = await agent.processMessage(sessionId, message);
  // Handle successful response
} catch (error) {
  // Handle errors (session not found, service failures, etc.)
  console.error('Failed to process message:', error);
}
```

Common error scenarios:
- Session not found or expired
- NLP service unavailable
- Inventory service errors
- Invalid message format

## Session Lifecycle

1. **Initialize**: Create session with `initializeSession()`
2. **Welcome**: Get welcome message with `getWelcomeMessage()`
3. **Conversation**: Process messages with `processMessage()`
4. **Cleanup**: End session with `endSession()`

Sessions automatically expire after 30 minutes of inactivity and are cleaned up automatically.

## Integration with Other Services

The Agent Core integrates with:

- **NLP Service**: Intent classification and response generation
- **Inventory Service**: Product data and availability
- **Personality Service**: Response tone and negotiation behavior
- **Session Manager**: Conversation state and lifecycle

## Performance Considerations

- Sessions are stored in memory for fast access
- Automatic cleanup prevents memory leaks
- Response caching reduces AI API costs
- Graceful degradation when services are unavailable

## Example Conversation Flow

```typescript
// Initialize
const agent = await AgentFactory.createAgent();
const session = await agent.initializeSession();

// Welcome
const welcome = await agent.getWelcomeMessage(session.sessionId);
console.log(welcome.text); // "Hello! Welcome to our farm store!"

// Browse products
const browse = await agent.processMessage(session.sessionId, "What vegetables do you have?");
console.log(browse.products); // List of available vegetables

// Product inquiry
const inquiry = await agent.processMessage(session.sessionId, "Tell me about tomatoes");
console.log(inquiry.text); // Detailed tomato information

// Add to cart
const addCart = await agent.processMessage(session.sessionId, "Add 2 tomatoes to cart");
console.log(addCart.text); // "Added 2 lb of Fresh Tomatoes to your cart!"

// Negotiate
const negotiate = await agent.processMessage(session.sessionId, "Can you do $3 for tomatoes?");
console.log(negotiate.text); // Negotiation response based on personality

// Farewell
const farewell = await agent.processMessage(session.sessionId, "Thank you!");
console.log(farewell.text); // "Thank you for visiting!"

// Cleanup
await agent.endSession(session.sessionId);
```

This completes the Agent Core implementation, providing a complete conversational interface for the Sari Sari store!