const mlClient = require('../lib/mlClient');
const bedrockClient = require('../lib/bedrockClient');
const cacheWriter = require('../lib/cacheWriter');
const {
  computeCenterOfMass,
  computeMembraneBoundaryDistance,
  applySpatialSeparation
} = require('../lib/spatialSeparation');

/**
 * Compute Euclidean distance between two equal-length vectors.
 */
function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Find the n action points with the smallest Euclidean distance to the centroid.
 */
function findNearestActions(actionPoints, centroid, n) {
  const withDistances = actionPoints.map((ap) => ({
    ...ap,
    distance: euclideanDistance(ap.vector, centroid)
  }));
  withDistances.sort((a, b) => a.distance - b.distance);
  return withDistances.slice(0, n);
}

/**
 * Derive the Bloom level from an action's scoring_data JSONB field.
 */
function deriveBloomLevel(scoringData) {
  if (!scoringData) return 1;

  if (scoringData.bloom_levels && typeof scoringData.bloom_levels === 'object') {
    const levels = Object.values(scoringData.bloom_levels).filter(
      (v) => typeof v === 'number' && v >= 1 && v <= 6
    );
    if (levels.length > 0) return Math.max(...levels);
  }

  if (typeof scoringData.level === 'number' && scoringData.level >= 1 && scoringData.level <= 6) {
    return scoringData.level;
  }

  return 1;
}

/**
 * POST /api/energeia/refresh
 * Full pipeline: fetch embeddings → invoke ML Lambda → label clusters →
 * spatial separation → write cache.
 */
async function refresh(pool, organizationId, body) {
  // --- 1. Validate input ---
  const k = parseInt(body.k, 10);
  const timeWindowDays = parseInt(body.time_window_days, 10) || 30;
  const reductionMethod = ['pca', 'tsne'].includes(body.reduction_method)
    ? body.reduction_method
    : 'pca';

  if (!Number.isInteger(k) || k < 2 || k > 20) {
    return { statusCode: 400, error: 'k must be between 2 and 20' };
  }

  // --- 2. Fetch embeddings for all org actions ---
  const embeddingsResult = await pool.query(
    `SELECT entity_id, embedding::text AS embedding, embedding_source
     FROM unified_embeddings
     WHERE entity_type = 'action'
       AND organization_id = $1`,
    [organizationId]
  );

  const embeddingMap = new Map();
  for (const row of embeddingsResult.rows) {
    const vector = row.embedding
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map(Number);
    embeddingMap.set(row.entity_id, {
      vector,
      embeddingSource: row.embedding_source
    });
  }

  // --- 3. Fetch actions within the time window (with state/observation counts) ---
  const actionsResult = await pool.query(
    `SELECT a.id, a.title, a.assigned_to, a.participants, a.scoring_data, a.created_at,
            a.status,
            COUNT(DISTINCT sl.state_id) AS observation_count
     FROM actions a
     LEFT JOIN state_links sl
       ON sl.entity_type = 'action' AND sl.entity_id = a.id
     WHERE a.organization_id = $1
       AND a.created_at >= NOW() - $2::interval
     GROUP BY a.id`,
    [organizationId, `${timeWindowDays} days`]
  );

  // --- 4. Fetch organization members for name lookup ---
  const membersResult = await pool.query(
    `SELECT user_id, full_name
     FROM organization_members
     WHERE organization_id = $1`,
    [organizationId]
  );

  const memberMap = new Map();
  for (const row of membersResult.rows) {
    memberMap.set(row.user_id, row.full_name || row.user_id);
  }

  // --- 5. Fan out action-person relationships ---
  let excludedCount = 0;
  const actionPoints = [];

  for (const action of actionsResult.rows) {
    const embedding = embeddingMap.get(action.id);
    if (!embedding) {
      excludedCount++;
      continue;
    }

    const bloomLevel = deriveBloomLevel(action.scoring_data);
    const status = action.status || 'not_started';
    const observationCount = parseInt(action.observation_count, 10) || 0;

    if (action.assigned_to) {
      actionPoints.push({
        actionId: action.id,
        personId: action.assigned_to,
        personName: memberMap.get(action.assigned_to) || action.assigned_to,
        relationshipType: 'assigned',
        vector: embedding.vector,
        embeddingSource: embedding.embeddingSource,
        bloomLevel,
        actionTitle: action.title,
        status,
        observationCount
      });
    }

    const participants = Array.isArray(action.participants) ? action.participants : [];
    const seenParticipants = new Set();
    if (action.assigned_to) seenParticipants.add(action.assigned_to);

    for (const participantId of participants) {
      if (!participantId) continue;
      if (seenParticipants.has(participantId)) continue;
      seenParticipants.add(participantId);
      actionPoints.push({
        actionId: action.id,
        personId: participantId,
        personName: memberMap.get(participantId) || participantId,
        relationshipType: 'participant',
        vector: embedding.vector,
        embeddingSource: embedding.embeddingSource,
        bloomLevel,
        actionTitle: action.title,
        status,
        observationCount
      });
    }

    // If no person was associated with this action, add an org-level unassigned point
    // so the action still appears in the visualization
    if (!action.assigned_to && participants.filter(Boolean).length === 0) {
      actionPoints.push({
        actionId: action.id,
        personId: 'unassigned',
        personName: 'Unassigned',
        relationshipType: 'assigned',
        vector: embedding.vector,
        embeddingSource: embedding.embeddingSource,
        bloomLevel,
        actionTitle: action.title,
        status,
        observationCount
      });
    }
  }

  console.log(
    `[refresh] org=${organizationId} actions_in_window=${actionsResult.rows.length} ` +
    `excluded_no_embedding=${excludedCount} action_points=${actionPoints.length}`
  );

  if (actionPoints.length === 0) {
    return { statusCode: 400, error: 'No embeddings found for the selected time window.' };
  }

  // --- 6. Invoke ML Lambda (k-means + PCA/t-SNE) ---
  const vectors = actionPoints.map((ap) => ap.vector);
  const entityIds = actionPoints.map((ap) => ap.actionId);

  let mlResult;
  try {
    mlResult = await mlClient.invokeMlLambda({ vectors, entity_ids: entityIds, k, reductionMethod });
  } catch (err) {
    console.error('[refresh] ML Lambda error:', err.message);
    return { statusCode: 500, error: `Pipeline failed: ${err.message}` };
  }

  const { labels, centroids, coords_3d: coords3d } = mlResult;

  // --- 7. Build cluster action title lists for Claude labeling ---
  const clusterActionPoints = new Map();
  for (let i = 0; i < actionPoints.length; i++) {
    const clusterId = labels[i];
    if (!clusterActionPoints.has(clusterId)) {
      clusterActionPoints.set(clusterId, []);
    }
    clusterActionPoints.get(clusterId).push({
      entityId: actionPoints[i].actionId,
      vector: actionPoints[i].vector,
      embeddingSource: actionPoints[i].embeddingSource
    });
  }

  const clustersForLabeling = [];
  for (let clusterId = 0; clusterId < k; clusterId++) {
    const clusterPoints = clusterActionPoints.get(clusterId) || [];
    const seen = new Set();
    const actionTitles = [];
    for (const ap of clusterPoints) {
      const apData = actionPoints.find(a => a.actionId === ap.entityId);
      const title = apData?.actionTitle || ap.embeddingSource;
      if (!seen.has(title)) {
        seen.add(title);
        actionTitles.push(title);
      }
    }
    clustersForLabeling.push({ id: clusterId, actionTitles });
  }

  // --- 8. Label clusters via Claude (title + description + boundary_type + action_energy_map) ---
  const clusterLabels = await bedrockClient.labelClusters(clustersForLabeling);
  const labelMap = new Map(clusterLabels.map((l) => [l.id, l]));

  // --- 8a. Build title → energy_type map for O(1) lookup ---
  const titleEnergyMap = new Map();
  for (const label of clusterLabels) {
    for (const [title, energyType] of Object.entries(label.action_energy_map || {})) {
      titleEnergyMap.set(title, energyType);
    }
  }

  // --- 9. Normalize coordinates to ±20 range ---
  let maxAbs = 1;
  for (const [x, y, z] of coords3d) {
    maxAbs = Math.max(maxAbs, Math.abs(x), Math.abs(y), Math.abs(z));
  }
  const DISPLAY_RANGE = 20;
  const scale = DISPLAY_RANGE / maxAbs;
  const normalizedCoords = coords3d.map(([x, y, z]) => [x * scale, y * scale, z * scale]);

  // --- 10. Compute cluster centroid coords in normalized space ---
  const clusterCoordSums = new Map();
  for (let i = 0; i < actionPoints.length; i++) {
    const clusterId = labels[i];
    const [x, y, z] = normalizedCoords[i];
    if (!clusterCoordSums.has(clusterId)) {
      clusterCoordSums.set(clusterId, { x: 0, y: 0, z: 0, count: 0 });
    }
    const s = clusterCoordSums.get(clusterId);
    s.x += x; s.y += y; s.z += z; s.count += 1;
  }

  // --- 11. Spatial separation: push external clusters outside the membrane ---
  const internalClusterIds = new Set(
    clusterLabels.filter(l => l.boundary_type === 'internal').map(l => l.id)
  );
  const externalCount = k - internalClusterIds.size;

  let centerOfMass = { x: 0, y: 0, z: 0 };
  let membraneBoundaryDistance = 0;
  let separatedCoords = normalizedCoords;

  if (internalClusterIds.size > 0 && externalCount > 0) {
    // Compute center of mass from internal cluster centroids
    const internalCentroids = [];
    for (const [clusterId, s] of clusterCoordSums) {
      if (!internalClusterIds.has(clusterId)) continue;
      internalCentroids.push({ x: s.x / s.count, y: s.y / s.count, z: s.z / s.count });
    }

    centerOfMass = computeCenterOfMass(internalCentroids);
    membraneBoundaryDistance = computeMembraneBoundaryDistance(centerOfMass, internalCentroids);

    separatedCoords = applySpatialSeparation(
      normalizedCoords,
      labels,
      internalClusterIds,
      centerOfMass,
      membraneBoundaryDistance
    );

    console.log(
      `[refresh] membrane: internal_clusters=${internalClusterIds.size} external_clusters=${externalCount} ` +
      `boundary_distance=${membraneBoundaryDistance.toFixed(2)}`
    );
  }

  // --- 12. Assemble ActionPoint[] ---
  const points = actionPoints.map((ap, i) => {
    const [x, y, z] = separatedCoords[i];
    const energyType = titleEnergyMap.get(ap.actionTitle) ?? 'oikonomia';
    return {
      id: `${ap.actionId}::${ap.personId}`,
      action_id: ap.actionId,
      person_id: ap.personId,
      person_name: ap.personName,
      relationship_type: ap.relationshipType,
      cluster_id: labels[i],
      x, y, z,
      bloom_level: ap.bloomLevel,
      action_title: ap.actionTitle,
      status: ap.status,
      observation_count: ap.observationCount,
      energy_type: energyType
    };
  });

  // --- 13. Assemble ClusterInfo[] ---
  // Recompute centroid coords from separatedCoords so centroid stars land in the right place
  const separatedCoordSums = new Map();
  for (let i = 0; i < actionPoints.length; i++) {
    const clusterId = labels[i];
    const [x, y, z] = separatedCoords[i];
    if (!separatedCoordSums.has(clusterId)) {
      separatedCoordSums.set(clusterId, { x: 0, y: 0, z: 0, count: 0 });
    }
    const s = separatedCoordSums.get(clusterId);
    s.x += x; s.y += y; s.z += z; s.count += 1;
  }

  const clusters = [];
  for (let clusterId = 0; clusterId < k; clusterId++) {
    const label = labelMap.get(clusterId) || {
      id: clusterId,
      title: `Cluster ${clusterId}`,
      description: 'A group of related actions.',
      boundary_type: 'internal'
    };
    const coords = separatedCoordSums.get(clusterId);
    const centroid_x = coords ? coords.x / coords.count : 0;
    const centroid_y = coords ? coords.y / coords.count : 0;
    const centroid_z = coords ? coords.z / coords.count : 0;

    clusters.push({
      id: clusterId,
      title: label.title,
      description: label.description,
      boundary_type: label.boundary_type || 'internal',
      centroid_x,
      centroid_y,
      centroid_z
    });
  }

  // --- 14. Write cache ---
  const payload = {
    k,
    time_window_days: timeWindowDays,
    reduction_method: reductionMethod,
    center_of_mass: centerOfMass,
    membrane_boundary_distance: membraneBoundaryDistance,
    points,
    clusters
  };

  await cacheWriter.writeCache(pool, organizationId, k, timeWindowDays, payload);

  const computedAt = new Date().toISOString();

  return {
    statusCode: 200,
    data: {
      status: 'complete',
      computed_at: computedAt,
      point_count: points.length,
      cluster_count: clusters.length
    }
  };
}

module.exports = { refresh, findNearestActions, deriveBloomLevel, euclideanDistance };
