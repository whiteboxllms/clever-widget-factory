# Implementation Plan: The Energeia Schema (action-inferred-roles)

## Overview

This plan implements The Energeia Schema end-to-end: database migration, Python ML Lambda (k-means + t-SNE), Node.js orchestration Lambda (data fetching, ML invocation, Claude labeling, cache write/read), API Gateway endpoints, and the full React Three Fiber visualization integrated into the Analytics Dashboard. Tasks are ordered so each layer is testable before the next is built: database → backend Lambdas → API Gateway → frontend types and hook → visualization components → dashboard integration.

## Tasks

- [x] 1. Create database migration for `energeia_cache` table
  - [x] 1.1 Create `migrations/add-energeia-cache.sql` with the `energeia_cache` table
    - `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
    - `organization_id` UUID NOT NULL REFERENCES organizations(id)
    - `k` INTEGER NOT NULL
    - `time_window_days` INTEGER NOT NULL DEFAULT 30
    - `payload` JSONB NOT NULL
    - `computed_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    - `created_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    - `updated_at` TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    - UNIQUE constraint on `(organization_id)` — one row per org
    - `CREATE INDEX idx_energeia_cache_org_id ON energeia_cache(organization_id)`
    - Run migration via `aws lambda invoke --function-name cwf-db-migration`
    - _Requirements: 5.4_

- [x] 2. Implement Python ML Lambda (`cwf-energeia-ml-lambda`)
  - [x] 2.1 Create `lambda/energeia-ml/requirements.txt` with `scikit-learn` and `numpy`
    - Pin exact versions: `scikit-learn==1.4.2`, `numpy==1.26.4`
    - _Requirements: 3.1, 3.3, 3.6_

  - [x] 2.2 Create `lambda/energeia-ml/ml/clustering.py` — k-means clustering
    - Implement `run_kmeans(vectors: list[list[float]], k: int) -> dict` using `sklearn.cluster.KMeans`
    - Return `{ "labels": [...], "centroids": [...] }` where labels are integer cluster indices and centroids are the k mean vectors in the original 1536-dim space
    - Raise `ValueError` if `k > len(vectors)` with message: `"k ({k}) exceeds the number of available action embeddings ({n}). Reduce k or expand the time window."`
    - _Requirements: 3.1, 3.2, 3.5_

  - [x] 2.3 Create `lambda/energeia-ml/ml/reduction.py` — t-SNE dimensionality reduction
    - Implement `run_tsne(vectors: list[list[float]]) -> list[list[float]]` using `sklearn.manifold.TSNE(n_components=3, random_state=42)`
    - Return list of 3D coordinate arrays, one per input vector
    - _Requirements: 3.3_

  - [x] 2.4 Create `lambda/energeia-ml/handler.py` — Lambda entry point
    - Parse event: `{ "vectors": [...], "entity_ids": [...], "k": int }`
    - Call `run_kmeans(vectors, k)` then `run_tsne(vectors)`
    - Return `{ "labels": [...], "centroids": [...], "coords_3d": [...] }`
    - Return error response `{ "error": "..." }` for `ValueError` (k > n) without raising
    - _Requirements: 3.1, 3.3, 3.5, 3.6_

  - [ ]* 2.5 Write Hypothesis property test for k-means cluster count (Property 5)
    - **Property 5: k-means Cluster Count**
    - Use `hypothesis` to generate random float vectors (N ≥ k) and k values; verify `run_kmeans` returns exactly k labels (values in [0, k-1]) and exactly k centroid vectors
    - Add test to `lambda/energeia-ml/tests/test_clustering_properties.py`
    - **Validates: Requirements 3.2, 3.5**

  - [ ]* 2.6 Write Hypothesis property test for t-SNE output dimensionality (Property 6)
    - **Property 6: t-SNE Output Dimensionality**
    - Use `hypothesis` to generate random float vector arrays; verify `run_tsne` returns exactly one 3-element array per input vector
    - Add test to `lambda/energeia-ml/tests/test_reduction_properties.py`
    - **Validates: Requirements 3.3**

- [x] 3. Checkpoint — Verify ML Lambda logic
  - Ensure all Python tests pass, ask the user if questions arise.

- [x] 4. Implement Node.js orchestration Lambda (`cwf-energeia-lambda`)
  - [x] 4.1 Create `lambda/energeia/package.json` with `@aws-sdk/client-lambda`, `@aws-sdk/client-bedrock-runtime`, and `pg` dependencies
    - Follow the pattern of existing Lambda `package.json` files in the project
    - _Requirements: 3.6, 4.2_

  - [x] 4.2 Create `lambda/energeia/lib/db.js` — PostgreSQL client
    - Follow the exact pattern of `lambda/analytics/lib/db.js` (or closest existing Lambda db module)
    - Export a `Pool` instance configured from environment variables
    - _Requirements: 2.1, 5.1_

  - [x] 4.3 Create `lambda/energeia/lib/mlClient.js` — invoke `cwf-energeia-ml-lambda`
    - Implement `invokeMlLambda({ vectors, entity_ids, k })` using `@aws-sdk/client-lambda` `InvokeCommand`
    - Parse the response payload JSON and return it
    - Throw if the response contains an `"error"` key (propagate the error message)
    - _Requirements: 3.1, 3.6_

  - [x] 4.4 Create `lambda/energeia/lib/bedrockClient.js` — Claude labeling via AWS Bedrock
    - Implement `labelClusters(clusters: Array<{ id: number, embeddingSources: string[] }>)` using `@aws-sdk/client-bedrock-runtime` `InvokeModelCommand` with `anthropic.claude-3-haiku-20240307-v1:0`
    - For each cluster, send the 3–5 representative `embedding_source` texts and instruct Claude to return `{ "title": "<2-3 word role title>", "description": "<one sentence energeia description>" }`
    - On Claude error for a specific cluster, return fallback `{ title: "Cluster N", description: "A group of related actions." }` and continue — do not throw
    - _Requirements: 4.2, 4.3, 4.4, 4.6_

  - [x] 4.5 Create `lambda/energeia/lib/cacheWriter.js` — upsert `energeia_cache`
    - Implement `writeCache(db, organizationId, k, timeWindowDays, payload)` using `INSERT ... ON CONFLICT (organization_id) DO UPDATE SET payload = EXCLUDED.payload, k = EXCLUDED.k, time_window_days = EXCLUDED.time_window_days, computed_at = NOW(), updated_at = NOW()`
    - _Requirements: 5.3, 5.4_

  - [x] 4.6 Create `lambda/energeia/handlers/getSchema.js` — read cache handler
    - Query `SELECT payload, computed_at, k, time_window_days FROM energeia_cache WHERE organization_id = $1`
    - Return `{ data: { ...payload, computed_at, k, time_window_days } }` if row exists
    - Return `{ data: null }` if no row exists
    - _Requirements: 5.1, 5.2_

  - [x] 4.7 Create `lambda/energeia/handlers/refresh.js` — full pipeline orchestrator
    - Parse and validate request body: `{ k, time_window_days }` — return 400 if k < 2 or k > 20
    - Query `unified_embeddings` WHERE `entity_type = 'action'` AND `organization_id = ?` to get vectors and `embedding_source` texts
    - Query `actions` for `id`, `title`, `assigned_to`, `participants`, `scoring_data`, `created_at` filtered to `time_window_days` and `organization_id`
    - Query `organization_members` for `user_id`, `full_name`
    - Fan out action-person relationships: one record per `assigned_to` (type `assigned`) and one per entry in `participants` array (type `participant`); join with embeddings; exclude actions with no embedding row
    - Filter to time window; log count of excluded actions (no embedding)
    - Return 400 `{ "error": "No embeddings found for the selected time window." }` if no vectors remain
    - Invoke `mlClient.invokeMlLambda({ vectors, entity_ids, k })`
    - For each cluster, find the 3–5 action vectors with smallest Euclidean distance to the centroid in the original 1536-dim space
    - Call `bedrockClient.labelClusters(...)` with the representative `embedding_source` texts
    - Derive `bloom_level` for each action from `scoring_data.bloom_levels` (max value) or `scoring_data.level`, defaulting to 1
    - Assemble `ActionPoint[]` and `ClusterInfo[]` arrays; map t-SNE coords back to action points
    - Call `cacheWriter.writeCache(...)` with the assembled payload
    - Return `{ data: { status: "complete", computed_at, point_count, cluster_count } }`
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.3, 5.4_

  - [x] 4.8 Create `lambda/energeia/index.js` — route dispatcher
    - Route `GET /api/energeia/schema` → `getSchema` handler
    - Route `POST /api/energeia/refresh` → `refresh` handler
    - Extract `organizationId` from authorizer context (follow existing Lambda pattern)
    - Return 401 if `organizationId` is missing
    - _Requirements: 5.1, 5.3_

  - [ ]* 4.9 Write fast-check property test for action-point fan-out completeness (Property 1)
    - **Property 1: Action-Point Fan-Out Completeness**
    - Use `fast-check` to generate random actions with `assigned_to` and `participants` arrays of length M; verify `buildActionPoints` produces exactly `1 + M` Action_Points
    - Add test to `lambda/energeia/tests/refresh.property.test.js`
    - **Validates: Requirements 1.3, 1.4, 1.5**

  - [ ]* 4.10 Write fast-check property test for relationship type correctness (Property 2)
    - **Property 2: Relationship Type Correctness**
    - Use `fast-check` to generate random actions; verify that for every resulting Action_Point, `person_id === assigned_to` implies `relationship_type === 'assigned'` and `person_id in participants` implies `relationship_type === 'participant'`
    - Add test to `lambda/energeia/tests/refresh.property.test.js`
    - **Validates: Requirements 1.3, 1.4**

  - [ ]* 4.11 Write fast-check property test for nearest-neighbor representative selection (Property 8)
    - **Property 8: Nearest-Neighbor Representative Selection**
    - Use `fast-check` to generate random vector sets and centroids; verify `findNearestActions(vectors, centroid, n)` returns the n actions with smallest Euclidean distance and no returned action has greater distance than any non-returned action
    - Add test to `lambda/energeia/tests/refresh.property.test.js`
    - **Validates: Requirements 4.1**

  - [ ]* 4.12 Write fast-check property test for Claude fallback completeness (Property 9)
    - **Property 9: Claude Fallback Completeness**
    - Use `fast-check` to generate random patterns of Claude success/failure across k clusters; verify `labelClusters` always returns exactly k Cluster_Labels (Claude response for successes, `"Cluster N"` fallback for failures) and never throws
    - Add test to `lambda/energeia/tests/bedrockClient.property.test.js`
    - **Validates: Requirements 4.6**

  - [ ]* 4.13 Write fast-check property test for cache payload round-trip (Property 10)
    - **Property 10: Cache Payload Round-Trip**
    - Use `fast-check` to generate random `ActionPoint[]` and `ClusterInfo[]` arrays; verify `JSON.parse(JSON.stringify(payload))` deep-equals the original — no data loss through JSONB serialization
    - Add test to `lambda/energeia/tests/cacheWriter.property.test.js`
    - **Validates: Requirements 5.4**

- [x] 5. Checkpoint — Verify Node.js Lambda logic and property tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add API Gateway endpoints and deploy both Lambdas
  - [x] 6.1 Deploy `cwf-energeia-ml-lambda` (Python)
    - Build Python deployment package with scikit-learn layer: `./scripts/deploy/deploy-lambda-with-layer.sh energeia-ml cwf-energeia-ml-lambda`
    - Set runtime Python 3.12, memory 1024 MB, timeout 5 minutes
    - _Requirements: 3.1, 3.3_

  - [x] 6.2 Deploy `cwf-energeia-lambda` (Node.js)
    - Deploy using `./scripts/deploy/deploy-lambda-with-layer.sh energeia cwf-energeia-lambda`
    - Set timeout 5 minutes (ML step can be slow for large orgs)
    - Configure environment variable `ML_LAMBDA_NAME=cwf-energeia-ml-lambda`
    - _Requirements: 5.1, 5.3_

  - [x] 6.3 Add API Gateway routes and deploy
    - `GET /api/energeia/schema` → `cwf-energeia-lambda` via `./scripts/add-api-endpoint.sh /api/energeia/schema GET cwf-energeia-lambda`
    - `POST /api/energeia/refresh` → `cwf-energeia-lambda` via `./scripts/add-api-endpoint.sh /api/energeia/refresh POST cwf-energeia-lambda`
    - Deploy API Gateway: `aws apigateway create-deployment --rest-api-id 0720au267k --stage-name prod --region us-west-2`
    - _Requirements: 5.1, 5.3_

- [x] 7. Create frontend TypeScript types
  - [x] 7.1 Create `src/types/energeia.ts` with all shared types
    - Export `ActionPoint` interface: `id`, `action_id`, `person_id`, `person_name`, `relationship_type: 'assigned' | 'participant'`, `cluster_id`, `x`, `y`, `z`, `bloom_level`, `action_title`
    - Export `ClusterInfo` interface: `id`, `title`, `description`, `centroid_x`, `centroid_y`, `centroid_z`
    - Export `EnergeiaSchemaData` interface: `computed_at`, `k`, `time_window_days`, `points: ActionPoint[]`, `clusters: ClusterInfo[]`
    - Export `EnergeiaFilters` interface: `personIds: string[]`, `relationshipTypes: ('assigned' | 'participant')[]`, `timeWindowDays: number`
    - _Requirements: 1.3, 1.4, 3.4, 6.2_

- [x] 8. Create `useEnergeiaSchema` hook
  - [x] 8.1 Create `src/hooks/useEnergeiaSchema.ts`
    - On mount: fire `GET /api/energeia/schema` via TanStack Query with `queryKey: ['energeia-schema', organizationId]`, `staleTime: Infinity`, `gcTime: 30 * 60 * 1000`
    - Expose `data: EnergeiaSchemaData | null`, `isLoading`, `isRefreshing`, `isEmpty`, `computedAt`, `refresh(k, timeWindowDays)`
    - `refresh()`: call `POST /api/energeia/refresh` then `queryClient.invalidateQueries(['energeia-schema', organizationId])` to re-read updated cache
    - While refresh is in progress, `isRefreshing = true`; do not clear `data` until new cache is loaded
    - Follow the TanStack Query patterns used in `useEnhancedStrategicAttributes` and `useScoredActions`
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6_

  - [ ]* 8.2 Write fast-check property test for time window filter completeness (Property 3)
    - **Property 3: Time Window Filter Completeness**
    - Use `fast-check` to generate sets of Action_Points with varying `created_at` timestamps and time windows; verify the filtered set contains exactly those whose `created_at` falls within `[start, end]`
    - Add test to `src/hooks/__tests__/useEnergeiaSchema.property.test.ts`
    - **Validates: Requirements 1.1**

  - [ ]* 8.3 Write fast-check property test for relationship type filter correctness (Property 4)
    - **Property 4: Relationship Type Filter Correctness**
    - Use `fast-check` to generate sets of Action_Points and non-empty subsets of relationship types; verify the filtered set contains only points whose `relationship_type` is in the selected subset
    - Add test to `src/hooks/__tests__/useEnergeiaSchema.property.test.ts`
    - **Validates: Requirements 1.7**

- [x] 9. Implement `EnergeiaSchema` top-level component
  - [x] 9.1 Create `src/components/EnergeiaSchema/EnergeiaSchema.tsx`
    - Accept props: `startDate: string`, `endDate: string`, `selectedUsers: string[]`
    - Use `useEnergeiaSchema` hook for data and refresh state
    - Render a Card wrapper with header: "The Energeia Schema", `computed_at` timestamp, and Refresh button
    - While `isRefreshing`: show loading spinner overlay; keep existing visualization visible
    - When `isEmpty`: render `EnergeiaEmptyState` component
    - When data exists: render `EnergeiaMap` and `EnergeiaControls`
    - Manage local state: `k` (default 8), `colorMode` (`'cluster' | 'person' | 'accountable'`), `filters: EnergeiaFilters`
    - Pass `startDate`/`endDate`/`selectedUsers` into `EnergeiaFilters` initial state to integrate with existing dashboard filters
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 6.1, 6.3_

  - [x] 9.2 Create `src/components/EnergeiaSchema/EnergeiaEmptyState.tsx`
    - Display informational empty state with guidance to click Refresh
    - Show when `isEmpty === true` and `isRefreshing === false`
    - _Requirements: 5.6_

- [x] 10. Implement `EnergeiaMap` React Three Fiber canvas
  - [x] 10.1 Create `src/components/EnergeiaSchema/EnergeiaMap.tsx` — RTF Canvas wrapper
    - Import `Canvas` from `@react-three/fiber`; import `Stars` from `@react-three/drei`
    - Set up `<Canvas camera={{ position: [0, 0, 30], fov: 60 }} style={{ background: '#050510', height: '600px' }} gl={{ antialias: true }}>`
    - Add `<ambientLight intensity={0.3} />`, `<pointLight position={[10, 10, 10]} intensity={1} />`, `<Stars radius={100} depth={50} count={3000} factor={4} fade />`
    - Compose `filteredPoints` by applying `filters.personIds`, `filters.relationshipTypes` to `points`
    - Render `<ActionPointCloud>`, `<CentroidStars>`, `<HoverTooltip>`, `<SceneControls>` as children
    - Manage `hoveredPoint: ActionPoint | null` and `hoveredCluster: ClusterInfo | null` state; pass down as props
    - Accept `onPointClick: (actionId: string) => void` prop
    - _Requirements: 1.6, 1.7, 6.2, 6.3, 6.6_

- [x] 11. Implement `ActionPointCloud` instanced mesh
  - [x] 11.1 Create `src/components/EnergeiaSchema/ActionPointCloud.tsx`
    - Use `THREE.InstancedMesh` with `THREE.SphereGeometry(1, 8, 8)` for performance with thousands of points
    - Implement `bloomToSize(level: number): number` — maps bloom_level 1–6 to radius 0.08–0.22 via `0.06 + (level / 6) * 0.16`
    - Set per-instance scale via `setMatrixAt` using `bloomToSize(point.bloom_level)`
    - Set per-instance color via `setColorAt` based on `colorMode`: cluster index → `CLUSTER_COLORS` palette (12 distinct hues), person → hash of `person_id`, accountable → hash of `person_id` in accountable mode
    - Handle `onPointerMove` to set `hoveredPoint` via `instanceId` lookup; handle `onClick` to call `onPointClick(point.action_id)`
    - Call `instancedMesh.instanceMatrix.needsUpdate = true` and `instancedMesh.instanceColor.needsUpdate = true` when points change
    - _Requirements: 1.6, 3.4, 6.2, 6.7, 6.11, 6.12_

  - [ ]* 11.2 Write fast-check property test for Bloom level size monotonicity (Property 11)
    - **Property 11: Bloom Level Size Monotonicity**
    - Use `fast-check` to generate pairs of Bloom levels `a > b`; verify `bloomToSize(a) >= bloomToSize(b)`
    - Add test to `src/components/EnergeiaSchema/__tests__/ActionPointCloud.property.test.ts`
    - **Validates: Requirements 6.7**

  - [ ]* 11.3 Write fast-check property test for cluster assignment consistency (Property 7)
    - **Property 7: Cluster Assignment Consistency**
    - Use `fast-check` to generate Action_Points with cluster_ids and a k value; verify every `cluster_id` is in `[0, k-1]` and every point's color assignment uses the correct cluster palette index
    - Add test to `src/components/EnergeiaSchema/__tests__/ActionPointCloud.property.test.ts`
    - **Validates: Requirements 3.4**

- [x] 12. Implement `CentroidStars` glowing centroid nodes
  - [x] 12.1 Create `src/components/EnergeiaSchema/CentroidStars.tsx`
    - Render one `<mesh>` per cluster centroid at `(centroid_x, centroid_y, centroid_z)`
    - Use `THREE.SphereGeometry(0.4, 16, 16)` with `meshStandardMaterial` set to `emissive` color matching the cluster's color in the point cloud and `emissiveIntensity={2}`
    - On pointer enter: set `hoveredCluster` to the cluster; on pointer leave: clear it
    - Use `@react-three/drei` `<Html>` to render cluster label as DOM overlay on hover (title + description)
    - _Requirements: 6.8, 6.9_

- [x] 13. Implement `SceneControls` auto-rotation and orbital controls
  - [x] 13.1 Create `src/components/EnergeiaSchema/SceneControls.tsx`
    - Import `OrbitControls` from `@react-three/drei`
    - Use `useRef` for a scene group; use `useFrame` to rotate the group at 0.002 rad/frame when `isAutoRotating === true`
    - On `onStart` (pointer down on canvas): set `isAutoRotating = false`; start a 3-second idle timer
    - On `onEnd` (pointer up): reset the idle timer; after 3 seconds of no interaction, set `isAutoRotating = true`
    - Configure `<OrbitControls enableDamping dampingFactor={0.05} />` for drag=rotate, scroll=zoom, right-drag=pan
    - _Requirements: 6.4, 6.5, 6.6_

- [x] 14. Implement `HoverTooltip` 2D overlay
  - [x] 14.1 Create `src/components/EnergeiaSchema/HoverTooltip.tsx`
    - Render as an absolutely-positioned `<div>` overlaid on the canvas (outside the RTF Canvas)
    - Use `useThree` camera and `size` to project the hovered point's 3D position to 2D screen coordinates via `vector.project(camera)` → CSS `left`/`top`
    - When `hoveredPoint` is set: display action title, person name, relationship type badge (`assigned` / `participant`), and cluster label (AI-generated title from `clusters` array)
    - When `hoveredCluster` is set: display cluster title (2–3 words) and cluster description (one sentence)
    - Hide when neither is set
    - _Requirements: 6.9, 6.10_

  - [ ]* 14.2 Write fast-check property test for tooltip content completeness (Property 12)
    - **Property 12: Tooltip Content Completeness**
    - Use `fast-check` to generate Action_Points with known `action_title`, `person_name`, `relationship_type`, and `cluster_id`; verify `buildTooltipContent(point, clusters)` returns a value containing all four fields
    - Add test to `src/components/EnergeiaSchema/__tests__/HoverTooltip.property.test.ts`
    - **Validates: Requirements 6.10**

- [x] 15. Implement `EnergeiaControls` panel
  - [x] 15.1 Create `src/components/EnergeiaSchema/EnergeiaControls.tsx`
    - Render a k slider (range 2–20, default 8) with label "Clusters (k)"; changing k updates local state but does NOT trigger a new Refresh automatically — show a "Refresh required" hint when k has changed since last compute
    - Render color mode selector: "Cluster" / "Person" / "Accountable Person" (maps to `'cluster' | 'person' | 'accountable'`)
    - Render relationship type checkboxes: "Assigned" and "Participant", both checked by default; toggling updates `filters.relationshipTypes`
    - Render person filter: multi-select of unique `person_name` values from points; updates `filters.personIds`
    - Use shadcn-ui `Slider`, `Select`, `Checkbox` components consistent with the rest of the dashboard
    - _Requirements: 1.7, 1.8, 3.2, 3.7, 6.12, 6.13, 6.14_

- [x] 16. Checkpoint — Verify all visualization components compile and render
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Integrate `EnergeiaSchema` into `AnalyticsDashboard.tsx`
  - [x] 17.1 Add `EnergeiaSchema` import and render it after `<ObservationsChart>` in `src/pages/AnalyticsDashboard.tsx`
    - Import `EnergeiaSchema` from `@/components/EnergeiaSchema/EnergeiaSchema`
    - Add `<EnergeiaSchema startDate={effectiveStartDate} endDate={effectiveEndDate} selectedUsers={radarSelectedUsers} />` immediately after the `<ObservationsChart ... />` block inside the `lg:col-span-3` div
    - _Requirements: 6.1, 6.14_

- [x] 18. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The Python ML Lambda (`cwf-energeia-ml-lambda`) requires a custom Lambda layer with scikit-learn and numpy — use `deploy-lambda-with-layer.sh` with a Python layer
- The Node.js orchestration Lambda (`cwf-energeia-lambda`) timeout must be set to 5 minutes to accommodate t-SNE on large datasets
- `fast-check` is already present in the project's `node_modules`; add it to `lambda/energeia/package.json` devDependencies for backend property tests
- Property tests 1–4 and 7–12 are implemented in Node.js/TypeScript using `fast-check`; properties 5–6 are implemented in Python using `hypothesis`
- The `energeia_cache` table has a UNIQUE constraint on `organization_id` — Refresh always upserts, never inserts a second row
- While a Refresh is in progress, the frontend continues displaying the previous cache; the new cache only replaces the display after the GET re-fetches
- `@react-three/fiber` and `@react-three/drei` must be installed if not already present: `npm install @react-three/fiber @react-three/drei three`
- The `EnergeiaSchema` component is placed after `<ObservationsChart>` in the `lg:col-span-3` column of `AnalyticsDashboard.tsx`
- Deployment commands (`deploy-lambda-with-layer.sh`, `add-api-endpoint.sh`, `cwf-db-migration`) are run manually by the user
