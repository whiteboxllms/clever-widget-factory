// Mock for ./shared/embeddings — not needed for buildSubquery unit tests
module.exports = {
  generateEmbeddingV1: async () => { throw new Error('Bedrock not available in unit tests'); },
};
