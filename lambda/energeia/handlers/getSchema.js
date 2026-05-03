/**
 * GET /api/energeia/schema
 * Read the most recent energeia_cache row for the authenticated organization.
 *
 * @param {import('pg').Pool} pool
 * @param {string} organizationId
 * @returns {Promise<{ data: object | null }>}
 */
async function getSchema(pool, organizationId) {
  const result = await pool.query(
    `SELECT payload, computed_at, k, time_window_days
     FROM energeia_cache
     WHERE organization_id = $1`,
    [organizationId]
  );

  if (result.rows.length === 0) {
    return { data: null };
  }

  const row = result.rows[0];

  return {
    data: {
      ...row.payload,
      computed_at: row.computed_at,
      k: row.k,
      time_window_days: row.time_window_days
    }
  };
}

module.exports = { getSchema };
