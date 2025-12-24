/**
 * Sari-Sari Chat Lambda
 * Handles chat interactions with NLP intent extraction
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { query: dbQuery } = require('./shared/db');
const { success: successResponse, error: errorResponse } = require('./shared/response');
const { getAuthorizerContext } = require('./shared/authorizerContext');
const { ResultFormatter } = require('./ResultFormatter');
const { SearchPipeline } = require('./SearchPipeline');
const { QueryRewriter, FilterMapper, HybridRetriever, ResponseGenerator } = require('./PipelineComponents');

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-west-2' });
const MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-haiku-20241022-v1:0';
const NEGATION_SIMILARITY_THRESHOLD = 0.7;

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const authContext = getAuthorizerContext(event);
  if (!authContext.organization_id) {
    return errorResponse('Unauthorized: No organization context', 401);
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { message, sessionId, conversationHistory = [] } = body;

    if (!message) {
      return errorResponse('Message is required', 400);
    }

    // Initialize SearchPipeline
    const pipeline = new SearchPipeline(
      new QueryRewriter((msg) => extractIntent(msg, conversationHistory)),
      new FilterMapper(),
      new HybridRetriever(dbQuery, filterNegatedProducts, generateEmbedding, cosineSimilarity),
      ResultFormatter,
      new ResponseGenerator(generateConversationalResponse)
    );
    
    // Execute pipeline
    const result = await pipeline.execute(message, authContext.organization_id);
    
    // Build updated conversation history
    const updatedHistory = [
      ...conversationHistory.slice(-4), // Keep last 2 exchanges (4 messages)
      { role: 'user', content: message },
      { role: 'assistant', content: result.text, products: result.products?.slice(0, 3).map(p => p.name) }
    ];

    return successResponse({
      intent: result.filters_applied,
      response: result.text,
      products: result.products || [],
      sessionId: sessionId || `session-${Date.now()}`,
      conversationHistory: updatedHistory,
      debug: {
        requestId: result.requestId,
        executionTimeMs: result.executionTimeMs,
        queryComponents: result.queryComponents,
        sqlQuery: result.sqlQuery
      }
    });

  } catch (error) {
    console.error('Error:', error);
    return errorResponse(error.message, 500);
  }
};

async function extractIntent(message, conversationHistory = []) {
  let contextSection = '';
  if (conversationHistory.length > 0) {
    const recentContext = conversationHistory.slice(-4).map(msg => {
      if (msg.role === 'user') return `Customer: ${msg.content}`;
      if (msg.products) return `Assistant showed: ${msg.products.join(', ')}`;
      return '';
    }).filter(Boolean).join('\n');
    
    if (recentContext) {
      contextSection = `\n\nRecent conversation:\n${recentContext}\n`;
    }
  }
  
  const prompt = `Extract intent and product search terms from the customer query.${contextSection}

Customer query: "${message}"

Respond with ONLY valid JSON:
{
  "intent": "PRODUCT_SEARCH",
  "productTerms": ["extracted", "terms"],
  "priceConstraints": {"min": null, "max": null},
  "negatedTerms": [],
  "extractedQuery": "extracted terms"
}

Intent types: PRODUCT_SEARCH, GENERAL_CHAT, GREETING, HELP, UNKNOWN

Only set priceConstraints if customer explicitly mentions price.`;

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 200,
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

async function filterNegatedProducts(products, negatedTerms, excludedProducts) {
  const negatedEmbeddings = await Promise.all(
    negatedTerms.map(term => generateEmbedding(term))
  );
  
  return products.filter(product => {
    const productText = `${product.name} ${product.description || ''}`;
    
    for (let i = 0; i < negatedTerms.length; i++) {
      const similarity = cosineSimilarity(product.embedding, negatedEmbeddings[i]);
      
      if (similarity >= NEGATION_SIMILARITY_THRESHOLD) {
        excludedProducts.push({
          id: product.id,
          name: product.name,
          negatedTerm: negatedTerms[i],
          similarity: similarity.toFixed(3)
        });
        return false;
      }
    }
    return true;
  });
}

async function generateEmbedding(text) {
  const payload = {
    inputText: text
  };
  
  const command = new InvokeModelCommand({
    modelId: 'amazon.titan-embed-text-v1',
    body: JSON.stringify(payload),
    contentType: 'application/json',
    accept: 'application/json'
  });
  
  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  return responseBody.embedding;
}

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function generateConversationalResponse(userQuery, products, intentResult, priceConstraints, excludedProducts) {
  if (products.length === 0) {
    return { text: "I don't have any products matching that right now. Can I help you find something else?", productIds: [] };
  }

  const productList = products.map((p, i) => 
    `${i + 1}. ${p.name}: ₱${p.price} (ID: ${p.id})`
  ).join('\n');
  
  let context = `Customer asked: "${userQuery}"\n\nAvailable products:\n${productList}`;
  
  if (priceConstraints.min || priceConstraints.max) {
    context += `\n\nPrice filter: `;
    if (priceConstraints.min && priceConstraints.max) {
      context += `₱${priceConstraints.min} to ₱${priceConstraints.max}`;
    } else if (priceConstraints.max) {
      context += `under ₱${priceConstraints.max}`;
    } else {
      context += `above ₱${priceConstraints.min}`;
    }
  }
  
  if (excludedProducts.length > 0) {
    context += `\n\nExcluded items: ${excludedProducts.map(p => p.name).join(', ')} (based on "${excludedProducts[0].negatedTerm}")`;
  }
  
  const systemPrompt = `You are a helpful store assistant. Generate a response and select which products to display.

RULES:
1. Match the customer's language (English or Tagalog/Filipino)
2. Be brief and direct (1-2 sentences)
3. Select 2-3 most relevant products to display
4. Return JSON: {"text": "your response", "productIds": ["id1", "id2"]}`;

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 150,
    temperature: 0.7,
    system: systemPrompt,
    messages: [{ role: "user", content: context }]
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
  
  return { text: `I found ${products.length} items for you!`, productIds: products.slice(0, 3).map(p => p.id) };
}
