# Conversational Bedrock Agent Tools

This directory contains Lambda tools for AWS Bedrock Agent that provide conversational product search capabilities for the sari-sari store.

## Quick Setup (15 minutes)

### Prerequisites
- AWS CLI configured with appropriate permissions
- Node.js 18+ installed
- CDK CLI installed (`npm install -g aws-cdk`)
- Database password for RDS connection

### Step 1: Deploy Lambda Tools (5 minutes)

```bash
# Set your database password
export DB_PASSWORD="your_rds_password"

# Deploy the Lambda function and IAM roles
./deploy.sh
```

This will:
- Install dependencies
- Deploy the pgvector search tool Lambda function
- Create IAM roles for Bedrock Agent
- Output the ARNs you need for agent configuration

### Step 2: Create Bedrock Agent (5 minutes)

1. Go to AWS Bedrock console → Agents
2. Click "Create Agent"
3. Configure basic settings:
   - **Agent name**: `SariSariAgent`
   - **Model**: `Claude 3 Haiku`
   - **Instructions**: Copy the personality instructions below

#### Agent Personality Instructions

```
You are Aling Maria, a warm and knowledgeable sari-sari store owner who loves helping customers find exactly what they need. You have a friendly, conversational personality and deep knowledge about your products.

Your conversation style:
- Always greet customers warmly and ask how you can help
- When customers ask vague questions, ask follow-up questions to understand their needs better
- Provide 2-3 specific product suggestions with reasons why each is perfect for their needs
- Tell stories about your products - where they come from, how to use them, what makes them special
- Use Filipino cultural context when appropriate (but keep it accessible)
- Engage in friendly price negotiations while respecting your business needs
- Suggest complementary items that would be useful
- If something is unavailable, enthusiastically suggest alternatives and explain why they're great substitutes

Example responses:
- Instead of 'Here are noodles under 30 pesos:', say 'Ah, looking for affordable noodles! I have three perfect options for you...'
- Instead of listing features, tell stories: 'This pancit canton is my customers' favorite because it cooks so quickly and the flavor is just right for busy families'
- Ask engaging questions: 'Are you cooking for the family tonight? Or maybe preparing something special?'

Always be helpful, engaging, and make customers feel like they're talking to a real person who cares about their needs.
```

4. Create Action Group:
   - **Action group name**: `ProductSearch`
   - **Description**: `Search for products using semantic search and return conversational recommendations`
   - **Action group type**: `Define with function details`
   - **Lambda function**: Use the ARN from Step 1 deployment output
   - **Function parameters**:
     ```json
     {
       "query": {
         "type": "string",
         "description": "The customer's search query or product description"
       },
       "limit": {
         "type": "string", 
         "description": "Maximum number of products to return (default: 5)"
       },
       "priceMax": {
         "type": "string",
         "description": "Maximum price filter in pesos"
       },
       "priceMin": {
         "type": "string", 
         "description": "Minimum price filter in pesos"
       },
       "excludeTerms": {
         "type": "string",
         "description": "Comma-separated terms to exclude from results"
       }
     }
     ```

5. Save and prepare the agent

### Step 3: Test the Agent (2 minutes)

1. In the Bedrock console, go to your agent
2. Click "Test" in the right panel
3. Try these test queries:
   - `"Hello! I'm looking for noodles under 30 pesos"`
   - `"Something hot for cooking"`
   - `"Fresh vegetables for tonight's dinner"`

Expected response format:
```
Ah, looking for affordable noodles! I have three perfect options for you:

1. **Pancit Canton (₱25)** - This is my customers' favorite because it cooks so quickly and the flavor is just right for busy families. We have plenty in stock and it's very fresh.

2. **Rice Noodles (₱18)** - Great value for money and perfect if you're making pancit. These are freshly harvested and cook beautifully.

3. **Egg Noodles (₱28)** - Premium quality but still within your budget. These have a rich taste and go well with vegetables and meat.

Are you cooking for the family tonight? I can also suggest some vegetables and seasonings that would go perfectly with any of these noodles!
```

### Step 4: Frontend Integration (3 minutes)

Update your React chat component to use the Bedrock Agent:

```javascript
// Example integration with Bedrock Agent
import { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand } from "@aws-sdk/client-bedrock-agent-runtime";

const client = new BedrockAgentRuntimeClient({ region: "us-west-2" });

async function chatWithAgent(message) {
  const command = new RetrieveAndGenerateCommand({
    input: {
      text: message
    },
    retrieveAndGenerateConfiguration: {
      type: "EXTERNAL_SOURCES",
      externalSourcesConfiguration: {
        modelArn: "arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-3-haiku-20240307-v1:0",
        sources: [{
          sourceType: "BEDROCK_AGENT",
          bedrockAgentConfiguration: {
            agentId: "YOUR_AGENT_ID", // Get from Bedrock console
            agentAliasId: "TSTALIASID"
          }
        }]
      }
    }
  });
  
  const response = await client.send(command);
  return response.output.text;
}
```

## Architecture

```
Customer Query → Bedrock Agent → pgvector Search Tool → RDS Database
                      ↓
              Conversational Response ← Product Context ← Vector Search Results
```

## Features

### Conversational Context
- **Relevance Reasons**: Why each product matches the customer's need
- **Selling Points**: Key benefits highlighted conversationally
- **Stock Descriptions**: "plenty in stock", "only a few left", etc.
- **Freshness Info**: "harvested today", "very fresh", etc.
- **Complementary Items**: Suggestions for related products

### Search Capabilities
- **Semantic Search**: Vector similarity using pgvector
- **Price Filtering**: Support for budget constraints
- **Stock Filtering**: Only shows available products (sellable=true)
- **Negation Support**: Exclude unwanted items
- **Cultural Context**: Filipino sari-sari store personality

### Example Interactions

**Customer**: "something hot"
**Agent**: "Ah, looking for something with heat! Are you cooking for the family tonight? I have three perfect options - this Long neck vinegar spice is my customers' favorite because it adds just the right kick to any dish..."

**Customer**: "noodles under 30 pesos"  
**Agent**: "Perfect! I have some great affordable noodles for you. This pancit canton at ₱25 is flying off the shelves because it cooks so quickly..."

## Troubleshooting

### Common Issues

1. **Lambda timeout**: Increase timeout in CDK stack if searches are slow
2. **Database connection**: Verify RDS security groups allow Lambda access
3. **Embedding errors**: Check Bedrock permissions for Titan model
4. **No results**: Verify products table has `sellable=true` and `embedding_vector` data

### Logs
- Lambda logs: CloudWatch → Log Groups → `/aws/lambda/BedrockToolsStack-PgvectorSearchTool`
- Bedrock traces: Bedrock console → Agent → Traces

### Testing Locally

```bash
cd pgvector-search
node test-local.js
```

## Cost Optimization

- **Claude 3 Haiku**: ~$0.25 per 1M input tokens
- **Titan Embeddings**: ~$0.0001 per 1K tokens  
- **Lambda**: ~$0.20 per 1M requests
- **RDS**: Uses existing database (no additional cost)

Estimated cost for 1000 customer interactions: **~$2-3/month**

## Next Steps

1. Add inventory and pricing Lambda tools
2. Implement negotiation capabilities
3. Add product storytelling features
4. Set up monitoring and alerts
5. Deploy to production environment