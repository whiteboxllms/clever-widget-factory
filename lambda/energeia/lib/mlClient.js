const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const client = new LambdaClient({ region: process.env.AWS_REGION || 'us-west-2' });

/**
 * Invoke the cwf-energeia-ml-lambda Python function to run k-means + dimensionality reduction.
 *
 * @param {{ vectors: number[][], entity_ids: string[], k: number, reductionMethod: string }} params
 * @returns {Promise<{ labels: number[], centroids: number[][], coords_3d: number[][] }>}
 */
async function invokeMlLambda({ vectors, entity_ids, k, reductionMethod = 'umap' }) {
  const payload = JSON.stringify({ vectors, entity_ids, k, reduction_method: reductionMethod });

  const command = new InvokeCommand({
    FunctionName: process.env.ML_LAMBDA_NAME || 'cwf-energeia-ml-lambda',
    InvocationType: 'RequestResponse',
    Payload: Buffer.from(payload)
  });

  const response = await client.send(command);

  const responseText = Buffer.from(response.Payload).toString('utf-8');
  const result = JSON.parse(responseText);

  if (result.error) {
    throw new Error(result.error);
  }

  return result;
}

module.exports = { invokeMlLambda };
