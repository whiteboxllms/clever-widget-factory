# Implementation Plan: Energeia Membrane

## Overview

Extend the existing Energeia Schema pipeline and visualization with energy classification, boundary classification, spatial separation post-processing, a metaball membrane surface, and an energy allocation bar. All changes are additive — the existing pipeline, cache schema, and TypeScript types are extended, not replaced.

Implementation language: **TypeScript** (frontend) and **JavaScript** (Lambda).

## Tasks

- [x] 1. Extend TypeScript types in `src/types/energeia.ts`
  - Add `EnergyType = 'dynamis' | 'oikonomia' | 'techne'` type alias
  - Add `BoundaryType = 'internal' | 'external'` type alias
  - Add `EnergyWeights = { dynamis: number; oikonomia: number; techne: number }` interface
  - Add `energy_weights: EnergyWeights` field to `ActionPoint` interface
  - Retain `energy_type: EnergyType` field on `ActionPoint` (dominant type, argmax of weights)
  - Add `boundary_type: BoundaryType` field to `ClusterInfo` interface
  - Add `center_of_mass: { x: number; y: number; z: number }` field to `EnergeiaSchemaData`
  - Add `membrane_boundary_distance: number` field to `EnergeiaSchemaData`
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 2. Extend `lambda/energeia/lib/bedrockClient.js` — replace discrete energy type with weight vectors
  - [x] 2.1 Update `buildClaudePrompt()` to request `boundary_type` and `action_energy_map` with weight objects
    - Replace the existing prompt template with the extended version from the design doc
    - Instruct Claude to return `boundary_type` (`"internal"` or `"external"`) at the cluster level
    - Instruct Claude to return `action_energy_map` mapping each action title to `{ dynamis, oikonomia, techne }` weights summing to 1.0
    - Increase `max_tokens` from 512 to 768 to accommodate the larger weight-object response
    - _Requirements: 1.2, 1.3, 2.2, 2.3_
  - [x] 2.2 Add `validateAndNormalizeWeights(raw)` helper function
    - Accept any value from Claude's response
    - Clamp negative values to 0 (Req 1.8)
    - Normalize by dividing each value by their sum (Req 1.7)
    - Return `{ dynamis: 0, oikonomia: 1, techne: 0 }` when input is missing, non-object, or all-zero (Req 1.6)
    - _Requirements: 1.6, 1.7, 1.8_
  - [x] 2.3 Update `labelClusters()` to validate and return weight vectors
    - After parsing Claude's JSON, validate `boundary_type` against `['internal', 'external']`; default to `'internal'` if missing or invalid
    - For each action title in the cluster, call `validateAndNormalizeWeights` on the raw value from `action_energy_map`
    - Include `boundary_type` and `action_energy_map` (now `Record<string, EnergyWeights>`) in each result record
    - Update the fallback object (in the `catch` block) to include `boundary_type: 'internal'` and `action_energy_map: {}` (each title will get default weights)
    - _Requirements: 1.6, 1.7, 1.8, 2.5, 2.6_
  - [ ]* 2.4 Write unit tests for `buildClaudePrompt()`, `validateAndNormalizeWeights()`, and `labelClusters()` fallback logic
    - Verify prompt contains `action_energy_map` with weight object format, `boundary_type`, all action titles
    - Verify `validateAndNormalizeWeights` normalizes weights that don't sum to 1.0
    - Verify `validateAndNormalizeWeights` clamps negative values and returns default for all-zero input
    - Verify `labelClusters()` returns `boundary_type: 'internal'` when Claude omits or returns an invalid value
    - Verify `labelClusters()` returns default weights `{ dynamis: 0, oikonomia: 1, techne: 0 }` when Claude omits an action title
    - _Requirements: 1.6, 1.7, 1.8, 2.5, 2.6_

- [x] 3. Extend `lambda/energeia/handlers/refresh.js` — weight vector assembly and spatial separation
  - [x] 3.1 Update `titleEnergyMap` build to store weight vectors
    - Iterate over all cluster labels and build a `Map<actionTitle, EnergyWeights>` for O(1) lookup
    - Add `dominantEnergyType(weights)` helper that returns the argmax type name
    - _Requirements: 1.4, 1.5_
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
  - [x] 3.8 Update `ActionPoint` assembly to use `separatedCoords`, `energy_weights`, and `energy_type`
    - Replace `normalizedCoords[i]` with `separatedCoords[i]` for `x`, `y`, `z`
    - Add `energy_weights: titleEnergyMap.get(ap.actionTitle) ?? DEFAULT_WEIGHTS`
    - Add `energy_type: dominantEnergyType(energyWeights)` (argmax of weights)
    - _Requirements: 1.4, 1.5, 6.1, 6.2, 6.4_
  - [x] 3.9 Update `ClusterInfo` assembly to include `boundary_type`
    - Add `boundary_type: label.boundary_type` when building each cluster record
    - Ensure the fallback label object also includes `boundary_type: 'internal'`
    - _Requirements: 2.4, 6.3, 6.4_
  - [x] 3.10 Update cache payload to include `center_of_mass` and `membrane_boundary_distance`
    - Add `center_of_mass: centerOfMass` and `membrane_boundary_distance: membraneBoundaryDistance` to the `payload` object written by `cacheWriter.writeCache()`
    - _Requirements: 6.5, 6.6, 6.7_

- [x] 4. Checkpoint — Lambda layer complete
  - Ensure all Lambda unit and property tests pass, ask the user if questions arise.

- [x] 5. Update `src/components/EnergeiaSchema/EnergyBar.tsx` — use `energy_weights` for proportions
  - Update `computeEnergyProportions()` to sum `energy_weights[type] * max(1, observation_count)` per type instead of bucketing by discrete `energy_type`
  - Each point contributes a fractional weight to all three segments proportional to its `energy_weights` vector
  - Retain the existing rendering, gradient, and info panel — only the proportion computation changes
  - Update the legacy map to convert old discrete `energy_type` strings to a degenerate weight vector (e.g. `'dynamis'` → `{ dynamis: 1, oikonomia: 0, techne: 0 }`) for backward compatibility with old cache data
  - _Requirements: 5.3, 5.4_
  - [ ]* 5.1 Write property test for `computeEnergyProportions` — Property 8
    - **Property 8: Energy bar proportions are observation-count weighted and sum to 1**
    - **Validates: Requirements 5.3, 5.4**
    - Generator: `fc.array(fc.record({ energy_weights: fc.record({ dynamis: fc.float({min:0,max:1}), oikonomia: fc.float({min:0,max:1}), techne: fc.float({min:0,max:1}) }), observation_count: fc.nat() }), { minLength: 1, maxLength: 50 })` (normalize weights in generator)
    - Assert each proportion equals `sum(energy_weights[type] * max(1, obs_count)) / total` for its energy type
    - Assert the three proportions sum to 1.0 within floating-point tolerance (`Math.abs(sum - 1) < 1e-9`)
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

- [x] 7. Extend `src/components/EnergeiaSchema/ActionPointCloud.tsx` — barycentric color blending
  - Add `barycentricColor(weights: EnergyWeights): string` pure function that computes a linear RGB blend of the three corner colors using the weight vector as barycentric coordinates
  - Corner colors in linear RGB: Dynamis `#00e5ff`, Oikonomia `#4f46e5`, Techne `#a855f7`
  - Perform interpolation in linear RGB space (not sRGB) to avoid muddy midpoints; convert result back to hex
  - In the per-point color computation, when `colorMode === 'energy_type'`, call `barycentricColor(point.energy_weights)` instead of the discrete lookup
  - Set emissive color to match the blended color so the glow reflects the energy mix (Req 9.9)
  - Retain existing gray desaturation for external points in all non-`energy_type` modes (Req 4.6, 8.7)
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_
  - [ ]* 7.1 Write property test for `barycentricColor` — Property 9
    - **Property 9: Barycentric color is a valid convex combination of corner colors**
    - **Validates: Requirements 9.1–9.7**
    - Generator: `fc.record({ dynamis: fc.float({min:0,max:1}), oikonomia: fc.float({min:0,max:1}), techne: fc.float({min:0,max:1}) })` — normalize in test
    - Assert each RGB channel of the result equals the weighted sum of the corresponding corner channels
    - Assert pure-weight inputs produce the exact corner color (within rounding tolerance)
    - Place in `src/components/EnergeiaSchema/ActionPointCloud.property.test.ts`
  - [ ]* 7.2 Write unit tests for external point desaturation
    - Render `ActionPointCloud` with a mix of internal and external cluster points in non-`energy_type` mode
    - Assert external points use `#6b7280` color and reduced emissive intensity
    - Assert internal points retain their cluster/person color
    - _Requirements: 4.5, 4.6_

- [x] 8. Extend `src/components/EnergeiaSchema/EnergeiaMap.tsx`
  - Add `membraneBoundaryDistance: number` to `EnergeiaMapProps`
  - Import and render `<EnergyBar points={points} />` above the `<Canvas>` element (outside R3F context), using the full unfiltered `points` prop
  - Import and render `<EnergyTriangle points={points} />` below the `EnergyBar`, only when `colorMode === 'energy_type'`
  - Import and render `<MembraneShell clusters={clusters} membraneBoundaryDistance={membraneBoundaryDistance} />` inside `<Canvas>`, before `<ActionPointCloud>` so depth ordering is correct
  - Pass `clusters={clusters}` to `<ActionPointCloud>` (new prop added in task 7)
  - _Requirements: 4.1, 4.10, 5.1, 5.7, 5.9, 10.1, 10.6, 10.7_

- [x] 8a. Create `src/components/EnergeiaSchema/EnergyTriangle.tsx`
  - Implement the `EnergyTriangle` component as specified in the design doc
  - Accept `points: ActionPoint[]` prop; return `null` when `points.length === 0`
  - Render an equilateral triangle SVG (120×104px) with Dynamis at top, Oikonomia at bottom-left, Techne at bottom-right
  - Fill the interior with three overlapping radial gradients (one per corner color) using `mix-blend-mode: screen` for additive color mixing
  - Compute the global average `EnergyWeights` as `sum(energy_weights[type] * max(1, obs_count)) / total_obs` for each type
  - Convert average weights to Cartesian position via `weightsToXY` and render a white crosshair circle + crosshair lines at that position
  - Label each vertex with the energy type name in its corner color
  - Add `aria-label="Energy triangle legend"` for accessibility
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.8_
  - [ ]* 8a.1 Write property test for `EnergyTriangle` crosshair position — Property 10
    - **Property 10: Triangle crosshair position is the observation-weighted mean of all point positions**
    - **Validates: Requirement 10.4**
    - Generator: same as P8 (array of points with `energy_weights` and `observation_count`)
    - Extract the computed average weights from the component (or extract `computeAverageWeights` as a testable helper)
    - Assert each average weight equals `sum(energy_weights[type] * max(1, obs_count)) / total_obs`
    - Place in `src/components/EnergeiaSchema/EnergyTriangle.property.test.ts`

- [x] 9. Extend `src/components/EnergeiaSchema/EnergeiaSchema.tsx`
  - Pass `membraneBoundaryDistance={data.membrane_boundary_distance}` to `<EnergeiaMap>`
  - _Requirements: 6.4, 6.5_

- [x] 10. Checkpoint — Frontend complete
  - Ensure all frontend unit and property tests pass, ask the user if questions arise.

- [x] 11. Deploy `cwf-energeia-lambda` with updated code
  - Run `./scripts/deploy/deploy-lambda-with-layer.sh lambda/energeia cwf-energeia-lambda` to deploy the updated refresh handler and Bedrock client
  - Verify the deployment succeeds and the Lambda function is updated
  - _Requirements: 6.6_

- [x] 12. Final checkpoint — End-to-end validation
  - Trigger a Refresh from the UI and verify the cache payload includes `energy_weights` and `energy_type` on points, `boundary_type` on clusters, `center_of_mass`, and `membrane_boundary_distance`
  - Verify the membrane renders as a single merged blob enclosing internal clusters
  - Verify external action points appear visually desaturated in non-`energy_type` modes
  - Verify the energy bar displays above the canvas with correct proportions (now weight-vector based)
  - Verify that in `energy_type` mode, nodes show chromatic blends — a mixed action appears as a color between its dominant types
  - Verify the energy triangle appears in `energy_type` mode with a crosshair at the correct global average position
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use `fast-check` (already in the TypeScript/Vite stack)
- Lambda property tests live in `lambda/energeia/lib/` alongside the modules they test
- Frontend property tests live in `src/components/EnergeiaSchema/` alongside the components
- The `MarchingCubes` import path is `three/examples/jsm/objects/MarchingCubes.js` — verify this resolves in the Vite build before implementing task 6
- Spatial separation helper functions (`computeCenterOfMass`, `computeMembraneBoundaryDistance`) should be extracted to a separate module (e.g., `lambda/energeia/lib/spatialSeparation.js`) so they can be imported by both `refresh.js` and the property tests
- Tasks 2, 3.1, and 3.8 are the critical path for the weight vector change — they must be completed before any frontend work that reads `energy_weights`
- The `barycentricColor` function in task 7 should be exported as a pure function so it can be tested independently of the React component
- The `computeAverageWeights` logic in task 8a should be extracted as a named export for testability (Property 10)
