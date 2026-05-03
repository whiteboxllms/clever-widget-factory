/**
 * Upsert the energeia_cache row for an organization.
 * One row per organization — INSERT ... ON CONFLICT DO UPDATE.
 *
 * @param {import('pg').Pool} pool
 * @param {string} organizationId
 * @param {number} k
 * @param {number} timeWindowDays
 * @param {object} payload - The full cache payload (ActionPoint[] + ClusterInfo[])
 * @returns {Promise<void>}
 */
async function writeCache(pool, organizationId, k, timeWindowDays, payload) {
  const sql = `
    INSERT INTO energeia_cache
      (organization_id, k, time_window_days, payload, computed_at, created_at, updated_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())
    ON CONFLICT (organization_id) DO UPDATE SET
      payload          = EXCLUDED.payload,
      k                = EXCLUDED.k,
      time_window_days = EXCLUDED.time_window_days,
      computed_at      = NOW(),
      updated_at       = NOW()
  `;

  await pool.query(sql, [organizationId, k, timeWindowDays, JSON.stringify(payload)]);
}

module.exports = { writeCache };
