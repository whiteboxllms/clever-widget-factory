import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from 'pg';
import { randomUUID } from 'crypto';

// Database configuration for testing
const dbConfig = {
  host: process.env.DB_HOST || 'cwf-dev-postgres.ctmma86ykgeb.us-west-2.rds.amazonaws.com',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

describe('Database Constraints Property Tests', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client(dbConfig);
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  /**
   * Property 4: Exploration-Action Relationship
   * For any action marked as an exploration, there should be exactly one corresponding 
   * exploration record, and conversely, every exploration record should reference exactly one action
   * Validates: Requirements 2.4
   */
  it('should enforce one-to-one relationship between action and exploration', async () => {
    // Feature: exploration-data-collection-flow, Property 4: Exploration-Action Relationship
    
    const testOrgId = randomUUID();
    const testUserId = randomUUID();
    
    // Create a test action
    const actionId = randomUUID();
    await client.query(`
      INSERT INTO actions (id, title, description, status, organization_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [actionId, 'Test Action', 'Test Description', 'not_started', testOrgId, testUserId]);

    try {
      // Create an exploration linked to this action
      const explorationId = randomUUID();
      const explorationCode = `SF010126EX01`;
      
      await client.query(`
        INSERT INTO exploration (id, action_id, exploration_code, exploration_notes_text, public_flag)
        VALUES ($1, $2, $3, $4, $5)
      `, [explorationId, actionId, explorationCode, 'Test exploration notes', false]);

      // Verify one-to-one relationship: action should have exactly one exploration
      const explorationResult = await client.query(`
        SELECT COUNT(*) as count FROM exploration WHERE action_id = $1
      `, [actionId]);
      
      expect(parseInt(explorationResult.rows[0].count)).toBe(1);

      // Verify reverse relationship: exploration should reference exactly one action
      const actionResult = await client.query(`
        SELECT action_id FROM exploration WHERE id = $1
      `, [explorationId]);
      
      expect(actionResult.rows[0].action_id).toBe(actionId);

      // Test constraint: attempting to create another exploration for the same action should fail
      const duplicateExplorationId = randomUUID();
      const duplicateExplorationCode = `SF010126EX02`;
      
      await expect(
        client.query(`
          INSERT INTO exploration (id, action_id, exploration_code, exploration_notes_text, public_flag)
          VALUES ($1, $2, $3, $4, $5)
        `, [duplicateExplorationId, actionId, duplicateExplorationCode, 'Duplicate exploration', false])
      ).rejects.toThrow(); // Should violate unique constraint on action_id

    } finally {
      // Clean up test data
      await client.query('DELETE FROM exploration WHERE action_id = $1', [actionId]);
      await client.query('DELETE FROM actions WHERE id = $1', [actionId]);
    }
  });

  /**
   * Property 18: Exploration Code Uniqueness
   * For any two exploration records in the system, their exploration_code values should be unique
   * Validates: Requirements 7.2
   */
  it('should enforce exploration code uniqueness across all explorations', async () => {
    // Feature: exploration-data-collection-flow, Property 18: Exploration Code Uniqueness
    
    const testOrgId = randomUUID();
    const testUserId = randomUUID();
    
    // Create two test actions
    const actionId1 = randomUUID();
    const actionId2 = randomUUID();
    
    await client.query(`
      INSERT INTO actions (id, title, description, status, organization_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6), ($7, $8, $9, $10, $11, $12)
    `, [
      actionId1, 'Test Action 1', 'Test Description 1', 'not_started', testOrgId, testUserId,
      actionId2, 'Test Action 2', 'Test Description 2', 'not_started', testOrgId, testUserId
    ]);

    try {
      const explorationCode = `SF010126EX03`;
      
      // Create first exploration with a specific code
      const explorationId1 = randomUUID();
      await client.query(`
        INSERT INTO exploration (id, action_id, exploration_code, exploration_notes_text, public_flag)
        VALUES ($1, $2, $3, $4, $5)
      `, [explorationId1, actionId1, explorationCode, 'First exploration', false]);

      // Verify the exploration was created
      const firstResult = await client.query(`
        SELECT exploration_code FROM exploration WHERE id = $1
      `, [explorationId1]);
      
      expect(firstResult.rows[0].exploration_code).toBe(explorationCode);

      // Attempt to create second exploration with the same code should fail
      const explorationId2 = randomUUID();
      
      await expect(
        client.query(`
          INSERT INTO exploration (id, action_id, exploration_code, exploration_notes_text, public_flag)
          VALUES ($1, $2, $3, $4, $5)
        `, [explorationId2, actionId2, explorationCode, 'Second exploration', false])
      ).rejects.toThrow(); // Should violate unique constraint on exploration_code

    } finally {
      // Clean up test data
      await client.query('DELETE FROM exploration WHERE action_id IN ($1, $2)', [actionId1, actionId2]);
      await client.query('DELETE FROM actions WHERE id IN ($1, $2)', [actionId1, actionId2]);
    }
  });

  /**
   * Property 19: Referential Integrity
   * For any action with a non-null policy_id, the referenced policy should exist, 
   * and policies should be validated at application layer before deletion to prevent orphaned references
   * Validates: Requirements 7.3
   */
  it('should enforce referential integrity between actions and policies', async () => {
    // Feature: exploration-data-collection-flow, Property 19: Referential Integrity
    
    const testUserId = randomUUID();
    const testOrgId = randomUUID();
    
    // Create a test policy
    const policyId = randomUUID();
    await client.query(`
      INSERT INTO policy (id, title, description_text, status, created_by_user_id)
      VALUES ($1, $2, $3, $4, $5)
    `, [policyId, 'Test Policy', 'Test policy description', 'draft', testUserId]);

    try {
      // Create an action that references this policy
      const actionId = randomUUID();
      await client.query(`
        INSERT INTO actions (id, title, description, status, organization_id, created_by, policy_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [actionId, 'Test Action', 'Test Description', 'not_started', testOrgId, testUserId, policyId]);

      // Verify the action references the correct policy
      const actionResult = await client.query(`
        SELECT policy_id FROM actions WHERE id = $1
      `, [actionId]);
      
      expect(actionResult.rows[0].policy_id).toBe(policyId);

      // Verify the policy exists and can be joined
      const joinResult = await client.query(`
        SELECT a.id as action_id, p.id as policy_id, p.title
        FROM actions a
        JOIN policy p ON a.policy_id = p.id
        WHERE a.id = $1
      `, [actionId]);
      
      expect(joinResult.rows).toHaveLength(1);
      expect(joinResult.rows[0].action_id).toBe(actionId);
      expect(joinResult.rows[0].policy_id).toBe(policyId);
      expect(joinResult.rows[0].title).toBe('Test Policy');

      // Test constraint: attempting to reference a non-existent policy should fail
      const nonExistentPolicyId = randomUUID();
      const actionId2 = randomUUID();
      
      await expect(
        client.query(`
          INSERT INTO actions (id, title, description, status, organization_id, created_by, policy_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [actionId2, 'Test Action 2', 'Test Description 2', 'not_started', testOrgId, testUserId, nonExistentPolicyId])
      ).rejects.toThrow(); // Should violate foreign key constraint

      // Clean up the action first
      await client.query('DELETE FROM actions WHERE id = $1', [actionId]);

      // Test policy deletion constraint: should be able to delete policy after removing references
      const deleteResult = await client.query('DELETE FROM policy WHERE id = $1 RETURNING id', [policyId]);
      expect(deleteResult.rows).toHaveLength(1);

    } catch (error) {
      // Clean up in case of error
      await client.query('DELETE FROM actions WHERE policy_id = $1', [policyId]);
      await client.query('DELETE FROM policy WHERE id = $1', [policyId]);
      throw error;
    }
  });
});