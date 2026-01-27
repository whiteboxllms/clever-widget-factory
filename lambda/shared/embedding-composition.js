/**
 * Embedding Source Composition Functions
 * 
 * This module provides functions to compose natural language descriptions
 * from entity fields for embedding generation. Each entity type has specific
 * logic for combining relevant fields into a single text string.
 * 
 * The composed text is used as the embedding_source for generating vector
 * embeddings via AWS Bedrock Titan models.
 * 
 * Design principles:
 * - Include fields that provide semantic meaning
 * - Avoid categorical labels or codes
 * - Filter out null/undefined/empty values
 * - Join fields with '. ' for natural language flow
 */

/**
 * Compose embedding source for a part
 * 
 * Parts include name, description (physical characteristics), and policy
 * (use case, benefits, operational context).
 * 
 * @param {Object} part - Part entity
 * @param {string} part.name - Part name
 * @param {string} [part.description] - Physical/anatomical description
 * @param {string} [part.policy] - Use case, benefits, operational context
 * @returns {string} - Composed embedding source text
 * 
 * @example
 * composePartEmbeddingSource({
 *   name: 'Banana Wine',
 *   description: 'Fermented banana beverage',
 *   policy: 'Rich in potassium and B vitamins. May support heart health.'
 * })
 * // Returns: "Banana Wine. Fermented banana beverage. Rich in potassium and B vitamins. May support heart health."
 */
function composePartEmbeddingSource(part) {
  const parts = [
    part.name,
    part.description,
    part.policy
  ].filter(Boolean);
  
  return parts.join('. ');
}

/**
 * Compose embedding source for a tool
 * 
 * Tools include name and description (physical characteristics and usage).
 * 
 * @param {Object} tool - Tool entity
 * @param {string} tool.name - Tool name
 * @param {string} [tool.description] - Tool description
 * @returns {string} - Composed embedding source text
 * 
 * @example
 * composeToolEmbeddingSource({
 *   name: 'Hand Drill',
 *   description: 'Manual drilling tool with adjustable chuck'
 * })
 * // Returns: "Hand Drill. Manual drilling tool with adjustable chuck"
 */
function composeToolEmbeddingSource(tool) {
  const parts = [
    tool.name,
    tool.description
  ].filter(Boolean);
  
  return parts.join('. ');
}

/**
 * Compose embedding source for an action
 * 
 * Actions include description, evidence_description (what was done),
 * policy (lessons learned, best practices), and observations (field notes).
 * 
 * @param {Object} action - Action entity
 * @param {string} [action.description] - Action description
 * @param {string} [action.evidence_description] - Evidence of what was done
 * @param {string} [action.policy] - Lessons learned, best practices
 * @param {string} [action.observations] - Field observations
 * @returns {string} - Composed embedding source text
 * 
 * @example
 * composeActionEmbeddingSource({
 *   description: 'Applied compost to banana plants',
 *   evidence_description: 'Spread 2 inches of compost around base',
 *   policy: 'Organic matter improves soil structure',
 *   observations: 'Plants showed improved vigor after 2 weeks'
 * })
 * // Returns: "Applied compost to banana plants. Spread 2 inches of compost around base. Organic matter improves soil structure. Plants showed improved vigor after 2 weeks"
 */
function composeActionEmbeddingSource(action) {
  const parts = [
    action.description,
    action.evidence_description,
    action.policy,
    action.observations
  ].filter(Boolean);
  
  return parts.join('. ');
}

/**
 * Compose embedding source for an issue
 * 
 * Issues include title, description, and resolution_notes.
 * 
 * @param {Object} issue - Issue entity
 * @param {string} [issue.title] - Issue title
 * @param {string} [issue.description] - Issue description
 * @param {string} [issue.resolution_notes] - Resolution notes
 * @returns {string} - Composed embedding source text
 * 
 * @example
 * composeIssueEmbeddingSource({
 *   title: 'Banana wine fermentation stopped',
 *   description: 'Fermentation ceased after 3 days',
 *   resolution_notes: 'Added more yeast and increased temperature'
 * })
 * // Returns: "Banana wine fermentation stopped. Fermentation ceased after 3 days. Added more yeast and increased temperature"
 */
function composeIssueEmbeddingSource(issue) {
  const parts = [
    issue.title,
    issue.description,
    issue.resolution_notes
  ].filter(Boolean);
  
  return parts.join('. ');
}

/**
 * Compose embedding source for a policy
 * 
 * Policies include title and description_text (policy content).
 * 
 * @param {Object} policy - Policy entity
 * @param {string} [policy.title] - Policy title
 * @param {string} [policy.description_text] - Policy description/content
 * @returns {string} - Composed embedding source text
 * 
 * @example
 * composePolicyEmbeddingSource({
 *   title: 'Organic Pest Control',
 *   description_text: 'Use only natural pesticides like neem oil'
 * })
 * // Returns: "Organic Pest Control. Use only natural pesticides like neem oil"
 */
function composePolicyEmbeddingSource(policy) {
  const parts = [
    policy.title,
    policy.description_text
  ].filter(Boolean);
  
  return parts.join('. ');
}

module.exports = {
  composePartEmbeddingSource,
  composeToolEmbeddingSource,
  composeActionEmbeddingSource,
  composeIssueEmbeddingSource,
  composePolicyEmbeddingSource
};
