/**
 * Spatial separation utilities for the Energeia Membrane feature.
 *
 * After PCA normalization, external clusters are pushed radially outward
 * from the center of mass of internal clusters, ensuring they land outside
 * the membrane boundary. Internal cluster positions are never modified.
 */

/**
 * Compute the center of mass (arithmetic mean) of a set of 3D positions.
 *
 * @param {Array<{ x: number, y: number, z: number }>} centroids
 * @returns {{ x: number, y: number, z: number }}
 */
function computeCenterOfMass(centroids) {
  if (centroids.length === 0) return { x: 0, y: 0, z: 0 };

  let sx = 0, sy = 0, sz = 0;
  for (const c of centroids) {
    sx += c.x;
    sy += c.y;
    sz += c.z;
  }
  const n = centroids.length;
  return { x: sx / n, y: sy / n, z: sz / n };
}

/**
 * Compute the membrane boundary distance:
 * 1.5 × the maximum Euclidean distance from the center of mass to any internal centroid.
 * Capped at DISPLAY_RANGE (20) so external clusters stay within the visible scene.
 *
 * @param {{ x: number, y: number, z: number }} centerOfMass
 * @param {Array<{ x: number, y: number, z: number }>} internalCentroids
 * @param {number} [displayRange=20] - Scene coordinate range (±displayRange)
 * @returns {number}
 */
function computeMembraneBoundaryDistance(centerOfMass, internalCentroids, displayRange = 20) {
  if (internalCentroids.length === 0) return 0;

  let maxRadius = 0;
  for (const c of internalCentroids) {
    const dx = c.x - centerOfMass.x;
    const dy = c.y - centerOfMass.y;
    const dz = c.z - centerOfMass.z;
    const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (r > maxRadius) maxRadius = r;
  }
  // Cap at displayRange so external clusters remain visible in the scene
  return Math.min(maxRadius * 1.5, displayRange * 0.85);
}

/**
 * Apply spatial separation to normalized 3D coordinates.
 *
 * For each external cluster whose centroid is closer to the center of mass
 * than `membraneBoundaryDistance`, push the centroid (and all its points)
 * radially outward until the centroid sits exactly at `membraneBoundaryDistance`.
 *
 * Internal cluster points are never modified.
 * Skips separation when all clusters are internal or all are external.
 *
 * @param {Array<[number, number, number]>} coords - Normalized 3D coordinates, one per action point
 * @param {number[]} labels - Cluster label per action point (parallel to coords)
 * @param {Set<number>} internalClusterIds - Set of cluster IDs classified as internal
 * @param {{ x: number, y: number, z: number }} centerOfMass
 * @param {number} membraneBoundaryDistance
 * @returns {Array<[number, number, number]>} - New coordinates array (original is not mutated)
 */
function applySpatialSeparation(coords, labels, internalClusterIds, centerOfMass, membraneBoundaryDistance) {
  if (membraneBoundaryDistance <= 0) return coords;

  // Compute current centroid of each external cluster from the coords
  const clusterSums = new Map(); // clusterId → { sx, sy, sz, count }
  for (let i = 0; i < coords.length; i++) {
    const clusterId = labels[i];
    if (internalClusterIds.has(clusterId)) continue;
    if (!clusterSums.has(clusterId)) {
      clusterSums.set(clusterId, { sx: 0, sy: 0, sz: 0, count: 0 });
    }
    const s = clusterSums.get(clusterId);
    s.sx += coords[i][0];
    s.sy += coords[i][1];
    s.sz += coords[i][2];
    s.count += 1;
  }

  // Compute push delta per external cluster
  const clusterPush = new Map(); // clusterId → [pushX, pushY, pushZ]
  for (const [clusterId, s] of clusterSums) {
    const cx = s.sx / s.count;
    const cy = s.sy / s.count;
    const cz = s.sz / s.count;

    const dx = cx - centerOfMass.x;
    const dy = cy - centerOfMass.y;
    const dz = cz - centerOfMass.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < membraneBoundaryDistance) {
      if (dist === 0) {
        // Centroid is exactly at CoM — push along +x axis as a tiebreaker
        clusterPush.set(clusterId, [membraneBoundaryDistance, 0, 0]);
      } else {
        const pushFactor = (membraneBoundaryDistance - dist) / dist;
        clusterPush.set(clusterId, [dx * pushFactor, dy * pushFactor, dz * pushFactor]);
      }
    } else {
      clusterPush.set(clusterId, [0, 0, 0]);
    }
  }

  // Apply push to all points in external clusters
  const separated = coords.map((coord, i) => {
    const clusterId = labels[i];
    if (internalClusterIds.has(clusterId)) return coord;
    const push = clusterPush.get(clusterId);
    if (!push) return coord;
    return [coord[0] + push[0], coord[1] + push[1], coord[2] + push[2]];
  });

  return separated;
}

module.exports = { computeCenterOfMass, computeMembraneBoundaryDistance, applySpatialSeparation };
