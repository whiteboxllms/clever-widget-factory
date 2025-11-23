/**
 * AWS Secrets Manager Helper
 * 
 * Retrieves secrets from AWS Secrets Manager with in-memory caching
 * to minimize API calls and costs.
 * 
 * Pricing (2025):
 * - $0.40 per secret per month
 * - $0.05 per 10,000 API calls
 * 
 * With caching, you'll typically make < 100 API calls/month per Lambda,
 * so cost is approximately $0.40/month per secret + minimal API costs.
 */

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-west-2' });

// In-memory cache for secrets (Lambda containers are reused, so this persists)
const secretCache = new Map();

/**
 * Get secret from AWS Secrets Manager with caching
 * 
 * @param {string} secretName - Name or ARN of the secret
 * @param {number} cacheTTL - Cache TTL in milliseconds (default: 1 hour)
 * @returns {Promise<string|object>} Secret value (parsed JSON if possible, otherwise string)
 */
async function getSecret(secretName, cacheTTL = 3600000) {
  // Check cache first
  const cached = secretCache.get(secretName);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const command = new GetSecretValueCommand({
      SecretId: secretName
    });

    const response = await secretsClient.send(command);
    
    // Parse JSON if possible, otherwise return as string
    let secretValue;
    try {
      secretValue = JSON.parse(response.SecretString);
    } catch {
      secretValue = response.SecretString;
    }

    // Cache the result
    secretCache.set(secretName, {
      value: secretValue,
      expiresAt: Date.now() + cacheTTL
    });

    return secretValue;
  } catch (error) {
    console.error(`Error retrieving secret ${secretName}:`, error);
    throw new Error(`Failed to retrieve secret ${secretName}: ${error.message}`);
  }
}

/**
 * Get database credentials from Secrets Manager
 * 
 * Expects secret to be stored as JSON:
 * {
 *   "username": "postgres",
 *   "password": "your-password",
 *   "host": "your-host",
 *   "port": 5432,
 *   "database": "postgres"
 * }
 * 
 * @param {string} secretName - Name of the secret (default: 'cwf/rds/postgres')
 * @returns {Promise<object>} Database configuration object
 */
async function getDatabaseCredentials(secretName = 'cwf/rds/postgres') {
  const secret = await getSecret(secretName);
  
  return {
    host: secret.host || secret.hostname,
    port: secret.port || 5432,
    database: secret.database || secret.dbname || 'postgres',
    user: secret.username || secret.user || 'postgres',
    password: secret.password
  };
}

module.exports = {
  getSecret,
  getDatabaseCredentials
};

