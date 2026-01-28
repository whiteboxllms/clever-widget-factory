/**
 * Action Scoring Lambda
 * 
 * Generates accountability scores using AWS Bedrock.
 * Frontend sends the complete prompt with action context.
 * 
 * Endpoints:
 * - POST /action-scoring/generate: Generate scores from a prompt
 */

const {
  generateScoresWithBedrock
} = require('./shared/action-scoring');

/**
 * Lambda handler
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS'
  };

  // Handle OPTIONS for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'OK' })
    };
  }

  // Only POST allowed
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { prompt, model = 'haiku', auto_save = false } = body;

    // Validate model
    if (!['haiku', 'sonnet'].includes(model)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid model. Must be "haiku" or "sonnet"' })
      };
    }

    // Validate required fields
    if (!prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required field: prompt' })
      };
    }

    // Call Bedrock with the prompt
    console.log('Calling Bedrock for scoring with model:', model);
    console.log('Prompt length:', prompt.length);
    const responseText = await generateScoresWithBedrock(prompt, model);

    // Return raw response - let frontend handle parsing
    console.log('Bedrock response received, length:', responseText.length);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          ai_response: responseText
        }
      })
    };

  } catch (error) {
    console.error('Error generating scores:', error);

    // Determine appropriate status code
    let statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error.message.includes('Bedrock')) {
      statusCode = 503;
      errorMessage = 'AI service error';
    } else if (error.message.includes('Invalid JSON') || error.message.includes('Invalid response')) {
      statusCode = 422;
      errorMessage = error.message;
    } else if (error.message.includes('timeout')) {
      statusCode = 504;
      errorMessage = 'AI service timeout';
    }

    return {
      statusCode,
      headers,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};
