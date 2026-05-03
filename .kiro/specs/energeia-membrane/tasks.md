# Implementation Plan: Energeia Membrane

## Overview

Extend the existing Energeia Schema pipeline and visualization with energy classification, boundary classification, spatial separation post-processing, a metaball membrane surface, and an energy allocation bar. All changes are additive — the existing pipeline, cache schema, and TypeScript types are extended, not replaced.

Implementation language: **TypeScript** (frontend) and **JavaScript** (Lambda).

## Tasks

- [x] 1. Extend TypeScript types in `src/types/energeia.ts`
  - Add `EnergyType = 'dynamis' | 'hexis' | 'techne'` type alias
  - Add `BoundaryType = 'internal' | 'external'` type alias
  - Add `energy_type: EnergyType` field to `ActionPoint` interface
  - Add `boundary_type: BoundaryType` field to `ClusterInfo` interface
  - Add `center_of_mass: { x: number; y: number; z: number }` field to `EnergeiaSchemaData`
  - Add `membrane_boundary_distance: number` field to `EnergeiaSchemaData`
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 2. Extend `lambda/energeia/lib/bedrockClient.js` — add energy and boundary classification
  - [x] 2.1 Update `buildClaudePrompt()` to request `boundary_type` and `action_energy_map` in the JSON response
    - Replace the existing prompt template with the extended version from the design doc
    - Instruct Claude to return `boundary_type` (`"internal"` or `"external"`) at the cluster level
    - Instruct Claude to return `action_energy_map` mapping each action title to its energy type
    - Increase `max_tokens` from 256 to 512 to accommodate the larger response
    - _Requirements: 1.2, 1.3, 2.2, 2.3_
  - [x] 2.2 Update `labelClusters()` to validate and return the new fields
    - After parsing Claude's JSON, validate `boundary_type` against `['internal', 'external']`; default to `'internal'` if missing or invalid
    - For each action title in the cluster, look up its value in `action_energy_map`; validate against `['growth', 'maintenance', 'process_improvement']`; default to `'maintenance'` if missing or invalid
    - Include `boundary_type` and `action_energy_map` in each result record
    - Update the fallback object (in the `catch` block) to include `boundary_type: 'internal'` and `action_energy_map: {}`
    - _Requirements: 1.5, 1.6, 1.7, 2.5, 2.6_
  - [ ]* 2.3 Write unit tests for `buildClaudePrompt()` and `labelClusters()` fallback logic
    - Verify prompt contains `action_energy_map`, `boundary_type`, all action titles, and correct JSON format instructions
    - Verify `labelClusters()` returns `boundary_type: 'internal'` when Claude omits or returns an invalid value
    - Verify `labelClusters()` returns `energy_type: 'hexis'` for each action title when Claude omits or returns an invalid value
    - _Requirements: 1.5, 1.6, 2.5, 2.6_

- [x] 3. Extend `lambda/energeia/handlers/refresh.js` — spatial separation and updated assembly
  - [x] 3.1 Build `titleEnergyMap` after `labelClusters()` returns
    - Iterate over all cluster labels and build a `Map<actionTitle, energyType>` for O(1) lookup
    - _Requirements: 1.4_
  - [x] 3.2 Extract `computeCenterOfMass(internalCentroids)` as a named function
    - Accept an array of `{ x, y, z }` objects (internal cluster centroids)
    - Return `{ x, y, z }` as the arithmetic mean; return `{ x: 0, y: 0, z: 0 }` for empty input
    - _Requirements: 3.1_
  - [ ]* 3.3 Write property test for `computeCenterOfMass` — Property 4
    - **Property 4: Center of mass is the mean of internal centroid positions**
    - **Validates: Requirement 3.1**
    - Generator: `fc.array(fc.record({ x: fc.float({ noNaN: true }), y: fc.float({ noNaN: true }), z: fc.float({ noNaN: true }) }), { minLength: 1, maxLength: 20 })`
    - Assert each coordinate of the result equals the arithmetic mean of the corresponding input coordinates
    - Place in `lambda/energeia/lib/spatialSeparation.property.test.js`
  - [x] 3.4 Extract `computeMembraneBoundaryDistance(centerOfMass, internalCentroids)` as a named function
    - Compute the maximum Euclidean distance from `centerOfMass` to any internal centroid
    - Return that maximum multiplied by 1.5; return 0 for empty input
    - _Requirements: 3.2_
  - [ ]* 3.5 Write property test for `computeMembraneBoundaryDistance` — Property 5
    - **Property 5: Membrane boundary distance is max internal radius × 1.5**
    - **Validates: Requirement 3.2**
    - Generator: same as Property 4 (array of `{ x, y, z }` centroids)
    - Assert result equals `1.5 * max(euclideanDistance(com, centroid))` for all centroids
    - Place in `lambda/energeia/lib/spatialSeparation.property.test.js`
  - [x] 3.6 Implement spatial separation post-processing in `refresh.js`
    - After computing `clusterCoordSums` and before assembling `ActionPoint[]`, identify internal cluster IDs from `clusterLabels`
    - Call `computeCenterOfMass` and `computeMembraneBoundaryDistance` using internal cluster centroids
    - Skip separation when `internalCount === 0` or `internalCount === k` (set `membraneBoundaryDistance = 0`)
    - For each external cluster centroid closer than `membraneBoundaryDistance` from CoM, compute push delta and apply it to every point in that cluster
    - Guard against division by zero when `dist === 0`
    - Store result in `separatedCoords` array
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  - [ ]* 3.7 Write property tests for spatial separation — Properties 6 and 7
    - **Property 6: External centroids are at or beyond membrane boundary after separation**
    - **Validates: Requirement 3.3**
    - Generator: random mixed internal/external cluster configs with at least one of each type
    - Assert every external centroid's distance from CoM ≥ `membraneBoundaryDistance` after separation
    - Assert internal centroid positions are unchanged
    - **Property 7: Spatial separation applies uniform displacement to all points in an external cluster**
    - **Validates: Requirement 3.4**
    - Generator: random external cluster with 2–10 action points
    - Assert `point_after - point_before` equals the cluster centroid's displacement vector for every point
    - Place in `lambda/energeia/lib/spatialSeparation.property.test.js`
  - [x] 3.8 Update `ActionPoint` assembly to use `separatedCoords` and `energy_type`
    - Replace `normalizedCoords[i]` with `separatedCoords[i]` for `x`, `y`, `z`
    - Add `energy_type: titleEnergyMap.get(ap.actionTitle) ?? 'hexis'`
    - _Requirements: 1.4, 6.1, 6.3_
  - [x] 3.9 Update `ClusterInfo` assembly to include `boundary_type`
    - Add `boundary_type: label.boundary_type` when building each cluster record
    - Ensure the fallback label object also includes `boundary_type: 'internal'`
    - _Requirements: 2.4, 6.2, 6.3_
  - [x] 3.10 Update cache payload to include `center_of_mass` and `membrane_boundary_distance`
    - Add `center_of_mass: centerOfMass` and `membrane_boundary_distance: membraneBoundaryDistance` to the `payload` object written by `cacheWriter.writeCache()`
    - _Requirements: 6.4, 6.5, 6.6_

- [ ] 4. Checkpoint — Lambda layer complete
  - Ensure all Lambda unit and property tests pass, ask the user if questions arise.

- [x] 5. Create `src/components/EnergeiaSchema/EnergyBar.tsx`
  - Implement the `EnergyBar` component as specified in the design doc
  - Accept `points: ActionPoint[]` prop
  - Return `null` when `points.length === 0`
  - Compute per-segment weight as `sum(max(1, observation_count))` for each `energy_type`
  - Render three colored segments (Dynamis: `#00e5ff`, Hexis: `#4f46e5`, Techne: `#a855f7`) proportionally sized by weight
  - Show inline label when segment is ≥ 12% wide; always show legend row below the bar
  - Add `aria-label="Energy allocation bar"` for accessibility
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.8, 5.9_
  - [ ]* 5.1 Write property test for `EnergyBar` proportions — Property 8
    - **Property 8: Energy bar proportions are observation-count weighted and sum to 1**
    - **Validates: Requirements 5.3, 5.4**
    - Generator: `fc.array(fc.record({ energy_type: fc.constantFrom('dynamis', 'hexis', 'techne'), observation_count: fc.nat() }), { minLength: 1, maxLength: 50 })`
    - Extract computed proportions from the rendered component (or extract the pure weight computation into a testable helper)
    - Assert each proportion equals `sum(max(1, obs_count)) / total` for its energy type
    - Assert the three proportions sum to 1.0 within floating-point tolerance (`Math.abs(sum - 1) < 1e-9`)
    - Assert points with `observation_count === 0` contribute weight 1
    - Place in `src/components/EnergeiaSchema/EnergyBar.property.test.ts`

- [x] 6. Create `src/components/EnergeiaSchema/MembraneShell.tsx`
  - Implement the `MembraneShell` component using the imperative `useEffect` + `scene.add/remove` pattern from the design doc
  - Import `MarchingCubes` from `three/examples/jsm/objects/MarchingCubes.js`
  - Filter `clusters` to internal clusters only (`boundary_type === 'internal'`); return `null` when none exist
  - Use resolution 28, teal/cyan material (`color: 0x00e5ff`, `emissive: 0x006064`, `opacity: 0.18`, `transparent: true`, `depthWrite: false`)
  - Scale the `MarchingCubes` object to `SCENE_RANGE * 2` (40 units) to match the ±20 scene coordinate space
  - Transform centroid coordinates to `[0, 1]` MarchingCubes space via `(v + 20) / 40`
  - Call `mc.addBall(x, y, z, 0.5, 12)` for each internal cluster centroid
  - Set `renderOrder = -1` so the membrane renders behind action points
  - Clean up `scene.remove`, `geometry.dispose()`, `material.dispose()` on unmount
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.8, 4.9, 4.10_
  - [ ]* 6.1 Write unit tests for `MembraneShell`
    - Test that the component returns `null` (no scene.add call) when all clusters are external
    - Test that `scene.add` is called once when at least one internal cluster exists
    - Mock `MarchingCubes` and `useThree` for isolation
    - _Requirements: 4.9_

- [x] 7. Extend `src/components/EnergeiaSchema/ActionPointCloud.tsx` — desaturate external points
  - Add `clusters: ClusterInfo[]` to `ActionPointCloudProps`
  - In the per-point color computation, look up `clusters.find(c => c.id === point.cluster_id)?.boundary_type ?? 'internal'`
  - For external points: use `'#6b7280'` (neutral gray) regardless of `colorMode`; set `emissiveIntensity` to `0.1`
  - For internal points: keep existing color logic and `emissiveIntensity: 0.6`
  - _Requirements: 4.5, 4.6_
  - [ ]* 7.1 Write unit tests for external point desaturation
    - Render `ActionPointCloud` with a mix of internal and external cluster points
    - Assert external points use `#6b7280` color and reduced emissive intensity
    - Assert internal points retain their cluster/person color
    - _Requirements: 4.5, 4.6_

- [x] 8. Extend `src/components/EnergeiaSchema/EnergeiaMap.tsx`
  - Add `membraneBoundaryDistance: number` to `EnergeiaMapProps`
  - Import and render `<EnergyBar points={points} />` above the `<Canvas>` element (outside R3F context), using the full unfiltered `points` prop
  - Import and render `<MembraneShell clusters={clusters} membraneBoundaryDistance={membraneBoundaryDistance} />` inside `<Canvas>`, before `<ActionPointCloud>` so depth ordering is correct
  - Pass `clusters={clusters}` to `<ActionPointCloud>` (new prop added in task 7)
  - _Requirements: 4.1, 4.10, 5.1, 5.7, 5.9_

- [x] 9. Extend `src/components/EnergeiaSchema/EnergeiaSchema.tsx`
  - Pass `membraneBoundaryDistance={data.membrane_boundary_distance}` to `<EnergeiaMap>`
  - _Requirements: 6.4, 6.5_

- [ ] 10. Checkpoint — Frontend complete
  - Ensure all frontend unit and property tests pass, ask the user if questions arise.

- [x] 11. Deploy `cwf-energeia-lambda` with updated code
  - Run `./scripts/deploy/deploy-lambda-with-layer.sh lambda/energeia cwf-energeia-lambda` to deploy the updated refresh handler and Bedrock client
  - Verify the deployment succeeds and the Lambda function is updated
  - _Requirements: 6.6_

- [ ] 12. Final checkpoint — End-to-end validation
  - Trigger a Refresh from the UI and verify the cache payload includes `energy_type` on points, `boundary_type` on clusters, `center_of_mass`, and `membrane_boundary_distance`
  - Verify the membrane renders as a single merged blob enclosing internal clusters
  - Verify external action points appear visually desaturated
  - Verify the energy bar displays above the canvas with correct proportions
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use `fast-check` (already in the TypeScript/Vite stack)
- Lambda property tests live in `lambda/energeia/lib/` alongside the modules they test
- Frontend property tests live in `src/components/EnergeiaSchema/` alongside the components
- The `MarchingCubes` import path is `three/examples/jsm/objects/MarchingCubes.js` — verify this resolves in the Vite build before implementing task 6
- Spatial separation helper functions (`computeCenterOfMass`, `computeMembraneBoundaryDistance`) should be extracted to a separate module (e.g., `lambda/energeia/lib/spatialSeparation.js`) so they can be imported by both `refresh.js` and the property tests
