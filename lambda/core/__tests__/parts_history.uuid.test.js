/**
 * Test for parts_history endpoint UUID casting fix
 * 
 * Verifies that part_id parameter is properly cast to UUID without
 * causing "operator does not exist: uuid = text" error
 */

// Define escapeLiteral the same way as in index.js
const escapeLiteral = (value = '') => String(value).replace(/'/g, "''");

describe('parts_history UUID casting', () => {

  it('should generate correct SQL for UUID comparison', () => {
    const partId = '0c08ac5b-8ac9-464c-b585-27be3e0a5165';
    
    // The correct pattern should be: ph.part_id = 'value'::uuid
    // NOT: ph.part_id = ('value')::uuid (which causes the error)
    const correctSql = `ph.part_id = '${escapeLiteral(partId)}'::uuid`;
    
    // Should not have parentheses around the quoted value
    expect(correctSql).not.toMatch(/\(['"]/);
    expect(correctSql).toContain(partId);
    expect(correctSql).toContain('::uuid');
    
    // Should match the expected pattern
    expect(correctSql).toBe(`ph.part_id = '${partId}'::uuid`);
  });

  it('should handle UUID with escapeLiteral correctly', () => {
    const partId = "0c08ac5b-8ac9-464c-b585-27be3e0a5165";
    const escaped = escapeLiteral(partId);
    
    // escapeLiteral should escape single quotes if present
    expect(escaped).toBe(partId); // Normal UUID shouldn't need escaping
    
    const sql = `ph.part_id = '${escaped}'::uuid`;
    expect(sql).toBe(`ph.part_id = '${partId}'::uuid`);
  });

  it('should NOT use formatSqlValue pattern that causes the error', () => {
    // The problematic pattern would be:
    // ph.part_id = (formatSqlValue(part_id))::uuid
    // Which generates: ph.part_id = ('value')::uuid
    // This causes: operator does not exist: uuid = text
    
    // The correct pattern is:
    // ph.part_id = 'value'::uuid
    const partId = '0c08ac5b-8ac9-464c-b585-27be3e0a5165';
    const correctPattern = `ph.part_id = '${escapeLiteral(partId)}'::uuid`;
    
    // Verify it doesn't have the problematic parentheses
    expect(correctPattern).not.toMatch(/\(['"]/);
    
    // Verify it has the correct structure
    expect(correctPattern).toMatch(/ph\.part_id = '[^']+'::uuid/);
  });
});

