# Requirements Document

## Introduction

The Energeia Membrane extends the existing Energeia Schema visualization with four interconnected capabilities: energy classification of actions and clusters, spatial separation of internal vs. external organizational activity, a rendered amoeba-shaped membrane that visually encloses internal work, an energy allocation bar showing how organizational effort is distributed across the three energy types, and barycentric color blending that renders each action node as a chromatic mix of its energy weights.

The feature builds directly on the existing pipeline: the same Claude labeling call that already generates cluster titles is extended to also classify every action by energy weights (a probability distribution across `dynamis`, `oikonomia`, and `techne`) and every cluster by boundary type. Post-processing of PCA coordinates then separates internal and external clusters spatially, and the Three.js scene gains a metaball membrane surface, a 2D energy bar overlay, and a ternary triangle legend showing the global energy average.

## Glossary

- **Energeia_Schema**: The existing Energeia Schema feature — pipeline, cache, and visualization — that this feature extends.
- **Energeia_Map**: The existing React Three Fiber 3D visualization component rendered in the Analytics Dashboard.
- **Action_Point**: A single rendered point representing one action-person relationship, as defined in the existing system.
- **Cluster**: A group of Action_Points with similar embedding vectors, as defined in the existing system.
- **Cluster_Centroid**: The mean 3D position of a Cluster's Action_Points after PCA reduction and normalization, as defined in the existing system.
- **Energy_Type**: The dominant energy classification of an action — one of `dynamis`, `oikonomia`, or `techne`. Derived as the argmax of the action's Energy_Weights vector. Used for filtering and the energy bar.
  - `dynamis` — activities that expand capability, revenue, or reach (Aristotle's concept of potential / RL exploration).
  - `oikonomia` — activities that sustain existing operations (household management and stable order / RL exploitation).
  - `techne` — activities that improve how work is done (practical wisdom and skilled governance / RL meta-policy).
- **Energy_Weights**: The per-action probability distribution assigned by Claude — a vector `{ dynamis: number, oikonomia: number, techne: number }` where all three values are non-negative and sum to 1.0. Captures the degree to which an action participates in each energy type. Used for barycentric color blending.
- **Barycentric_Color**: The RGB color of an action node computed as a weighted blend of the three energy-type corner colors, using the action's Energy_Weights as barycentric coordinates. A pure-oikonomia action is deep indigo; a pure-dynamis action is electric cyan; a mixed action is a chromatic blend.
- **Energy_Triangle**: A ternary diagram UI element showing the three energy-type colors at the corners, a smooth gradient interior, and a crosshair at the global energy average position. Serves as the legend for the barycentric color mode.
- **Boundary_Type**: The per-cluster classification assigned by Claude — one of `internal` or `external`.
  - `internal` — clusters representing core operations of the organization (e.g. Poultry Care, Agriculture, Food Production).
  - `external` — clusters representing interactions with outside entities (e.g. Compliance, Government, Vendors, Purchases).
- **Internal_Cluster**: A Cluster whose Boundary_Type is `internal`.
- **External_Cluster**: A Cluster whose Boundary_Type is `external`.
- **Center_of_Mass**: The mean 3D position of all Internal_Cluster Cluster_Centroids, computed after PCA normalization.
- **Membrane_Boundary**: The implicit surface distance threshold beyond which External_Cluster centroids are pushed during spatial separation post-processing.
- **Membrane**: The single organic blob surface rendered in Three.js that encloses all Internal_Cluster Action_Points, implemented as a metaball implicit surface.
- **Metaball**: An implicit surface technique where one sphere of influence is placed at each Internal_Cluster Cluster_Centroid; the union of all spheres forms a single merged blob.
- **Energy_Bar**: The horizontal proportional bar displayed above the Energeia_Map showing the distribution of organizational energy across the three Energy_Types, weighted by observation count.
- **Labeling_Pipeline**: The existing Claude-via-Bedrock labeling step in `lambda/energeia/lib/bedrockClient.js` and `lambda/energeia/handlers/refresh.js`, which this feature extends.
- **Energeia_Cache**: The existing `energeia_cache` database table storing the computed payload for each organization.
- **Observation_Count**: The `observation_count` field already present on each Action_Point in the existing cache payload, representing the number of state observations linked to that action.

---

## Requirements

### Requirement 1: Per-Action Energy Weights

**User Story:** As an analytics user, I want every action assigned a probability distribution across the three energy types, so that I can see how actions blend growth, maintenance, and process improvement rather than being forced into a single category.

#### Acceptance Criteria

1. WHEN a Refresh is triggered, THE Labeling_Pipeline SHALL classify every action in the dataset with an Energy_Weights vector `{ dynamis, oikonomia, techne }` where all three values are non-negative and sum to 1.0.
2. THE Labeling_Pipeline SHALL perform per-action Energy_Weights classification within the same Claude invocation that generates the cluster title and description, passing all action titles in the cluster to Claude in a single request.
3. THE Labeling_Pipeline SHALL instruct Claude to return one Energy_Weights object per action title, keyed by action title, alongside the cluster-level title and description in the same JSON response.
4. THE Labeling_Pipeline SHALL store the Energy_Weights vector on each Action_Point in the Energeia_Cache payload.
5. THE Labeling_Pipeline SHALL derive and store the dominant Energy_Type (argmax of Energy_Weights) on each Action_Point alongside the weights, for use by the filter system and energy bar.
6. IF Claude does not return Energy_Weights for a specific action, THEN THE Labeling_Pipeline SHALL assign that action default weights of `{ dynamis: 0, oikonomia: 1, techne: 0 }` and continue without failing.
7. IF Claude returns Energy_Weights that do not sum to approximately 1.0 (within ±0.05 tolerance), THEN THE Labeling_Pipeline SHALL normalize the weights by dividing each by their sum before storing.
8. IF Claude returns any negative weight value, THEN THE Labeling_Pipeline SHALL clamp it to 0 before normalizing.
9. THE Labeling_Pipeline SHALL NOT make a separate Claude invocation solely for Energy_Weights classification — it SHALL be part of the existing cluster labeling call.

---

### Requirement 2: Per-Cluster Boundary Classification

**User Story:** As an analytics user, I want each cluster classified as internal or external, so that I can distinguish core organizational operations from boundary interactions with outside entities.

#### Acceptance Criteria

1. WHEN a Refresh is triggered, THE Labeling_Pipeline SHALL classify every Cluster with a Boundary_Type of `internal` or `external`.
2. THE Labeling_Pipeline SHALL perform Boundary_Type classification within the same Claude invocation as the cluster title, description, and per-action Energy_Type classification.
3. THE Labeling_Pipeline SHALL instruct Claude to return the Boundary_Type as a field in the cluster-level JSON response alongside the title and description.
4. THE Labeling_Pipeline SHALL store the Boundary_Type on each ClusterInfo record in the Energeia_Cache payload.
5. IF Claude does not return a Boundary_Type for a specific cluster, THEN THE Labeling_Pipeline SHALL assign that cluster a default Boundary_Type of `internal` and continue without failing.
6. IF Claude returns a Boundary_Type value that is not `internal` or `external`, THEN THE Labeling_Pipeline SHALL assign that cluster a default Boundary_Type of `internal`.
7. THE Energeia_Schema SHALL NOT provide a UI mechanism for users to override Claude's Boundary_Type classification — re-running Refresh is the only way to change a classification.

---

### Requirement 3: Spatial Separation Post-Processing

**User Story:** As an analytics user, I want external clusters and their action points pushed spatially outside the internal point cloud, so that the membrane boundary is visually meaningful and external activity is clearly separated.

#### Acceptance Criteria

1. WHEN a Refresh is triggered, THE Refresh_Pipeline SHALL compute the Center_of_Mass as the mean 3D position of all Internal_Cluster Cluster_Centroids, after PCA normalization.
2. WHEN a Refresh is triggered, THE Refresh_Pipeline SHALL compute the Membrane_Boundary distance as the maximum radial distance from the Center_of_Mass to any Internal_Cluster Cluster_Centroid, multiplied by a fixed expansion factor of 1.5.
3. FOR EACH External_Cluster centroid whose radial distance from the Center_of_Mass is less than the Membrane_Boundary distance, THE Refresh_Pipeline SHALL push that centroid radially outward from the Center_of_Mass until its distance equals the Membrane_Boundary distance.
4. FOR EACH Action_Point belonging to an External_Cluster, THE Refresh_Pipeline SHALL apply the same radial displacement vector that was applied to that cluster's centroid, preserving the relative position of each Action_Point within its cluster.
5. WHEN all clusters are classified as `internal`, THE Refresh_Pipeline SHALL skip spatial separation and store coordinates as-is.
6. WHEN all clusters are classified as `external`, THE Refresh_Pipeline SHALL skip spatial separation and store coordinates as-is.
7. THE Refresh_Pipeline SHALL perform spatial separation after PCA normalization and before writing the Energeia_Cache, so that stored coordinates already reflect the separated positions.
8. THE Refresh_Pipeline SHALL NOT modify the PCA computation itself — spatial separation is a post-processing step applied to the normalized output coordinates.

---

### Requirement 4: The Membrane

**User Story:** As an analytics user, I want to see a glowing organic membrane enclosing the internal clusters, so that I can immediately perceive the boundary between core organizational activity and external interactions.

#### Acceptance Criteria

1. THE Energeia_Map SHALL render a single Membrane surface that encloses all Internal_Cluster Action_Points.
2. THE Energeia_Map SHALL implement the Membrane as a metaball implicit surface, placing one sphere of influence at each Internal_Cluster Cluster_Centroid position.
3. THE Energeia_Map SHALL merge all metaball spheres into a single unified blob surface — the Membrane SHALL always be a single connected surface, not multiple separate bubbles.
4. THE Energeia_Map SHALL render the Membrane as a semi-transparent surface with a teal/cyan emissive glow, consistent with the existing dark space-like aesthetic of the visualization.
5. THE Energeia_Map SHALL render Internal_Cluster Action_Points inside the Membrane using their existing color treatment.
6. THE Energeia_Map SHALL render External_Cluster Action_Points outside the Membrane with a visually desaturated treatment to indicate they are boundary interactions.
7. THE Energeia_Map SHALL render External_Cluster Cluster_Centroid stars outside the Membrane.
8. WHEN the number of Internal_Clusters changes (due to a new Refresh), THE Membrane SHALL adapt its shape to reflect the new set of Internal_Cluster Cluster_Centroid positions.
9. WHEN there are no Internal_Clusters, THE Energeia_Map SHALL NOT render a Membrane.
10. THE Membrane SHALL be rendered behind Action_Points and Cluster_Centroid stars in the depth order of the scene, so that points are visible through the semi-transparent surface.

---

### Requirement 5: Energy Allocation Bar

**User Story:** As an analytics user, I want to see a proportional bar showing how organizational energy is distributed across growth, maintenance, and process improvement, so that I can understand the overall energy profile at a glance.

#### Acceptance Criteria

1. THE Energeia_Schema SHALL display an Energy_Bar as a horizontal bar positioned above the Energeia_Map canvas.
2. THE Energy_Bar SHALL contain three segments: Dynamis (electric cyan), Oikonomia (indigo), and Techne (violet/magenta).
3. THE Energy_Bar SHALL compute each segment's proportion by summing `energy_weights[type] * max(1, observation_count)` across all Action_Points for that type, then dividing by the total weighted sum across all Action_Points and all types.
4. WHEN an Action_Point has an Observation_Count of zero, THE Energy_Bar SHALL use a weight of 1 as the observation multiplier, so that actions with no observations are not invisible in the allocation.
5. THE Energy_Bar SHALL display the percentage for each segment as a label within or adjacent to that segment (e.g. "Dynamis 45%").
6. THE Energy_Bar SHALL display no absolute units — proportions only.
7. WHEN a Refresh completes and new cache data is loaded, THE Energy_Bar SHALL update to reflect the new Energy_Weights distribution.
8. WHEN no Energeia_Cache exists, THE Energy_Bar SHALL NOT be rendered.
9. THE Energy_Bar SHALL use the same Action_Points that are currently stored in the Energeia_Cache — it SHALL NOT apply the active UI filters (person, relationship type, status) to the energy proportions, so that the bar always reflects the full organizational picture.

---

### Requirement 6: Extended Cache Payload

**User Story:** As a developer, I want the Energeia_Cache payload to carry the new classification fields, so that the frontend can render the membrane and energy bar without additional API calls.

#### Acceptance Criteria

1. THE Energeia_Cache payload SHALL include an `energy_weights` object on every Action_Point, containing `{ dynamis: number, oikonomia: number, techne: number }` where all three values are non-negative and sum to 1.0.
2. THE Energeia_Cache payload SHALL include an `energy_type` field on every Action_Point containing the dominant energy type (argmax of `energy_weights`), for use by the filter system.
3. THE Energeia_Cache payload SHALL include a `boundary_type` field on every ClusterInfo record, containing one of `internal` or `external`.
4. THE Energeia_Cache payload SHALL remain backward-compatible — existing fields (`id`, `action_id`, `person_id`, `cluster_id`, `x`, `y`, `z`, `bloom_level`, `action_title`, `status`, `observation_count`) SHALL be preserved unchanged.
5. THE Energeia_Cache payload SHALL include a `center_of_mass` object at the top level containing `x`, `y`, `z` coordinates of the Center_of_Mass, so that the frontend can use it for membrane positioning without recomputing it.
6. THE Energeia_Cache payload SHALL include a `membrane_boundary_distance` number at the top level, so that the frontend can use it to size the metaball spheres without recomputing it.
7. WHEN the Energeia_Cache is read by the `GET /api/energeia/schema` endpoint, THE response SHALL include all new fields defined in this requirement.

---

### Requirement 7: Extended TypeScript Types

**User Story:** As a frontend developer, I want the TypeScript types in `src/types/energeia.ts` to reflect the new classification fields, so that the compiler enforces correct usage throughout the visualization components.

#### Acceptance Criteria

1. THE `ActionPoint` TypeScript interface SHALL include an `energy_weights` field typed as `{ dynamis: number; oikonomia: number; techne: number }`.
2. THE `ActionPoint` TypeScript interface SHALL retain the `energy_type` field typed as `EnergyType`, representing the dominant type derived from `energy_weights`.
3. THE `ClusterInfo` TypeScript interface SHALL include a `boundary_type` field typed as `'internal' | 'external'`.
4. THE `EnergeiaSchemaData` TypeScript interface SHALL include a `center_of_mass` field typed as `{ x: number; y: number; z: number }`.
5. THE `EnergeiaSchemaData` TypeScript interface SHALL include a `membrane_boundary_distance` field typed as `number`.
6. THE Energeia_Schema frontend components SHALL use the updated TypeScript interfaces — no `any` casts SHALL be introduced to work around missing type fields.

---

### Requirement 9: Barycentric Color Blending

**User Story:** As an analytics user, I want each action node's color to reflect its blend of energy types, so that I can see at a glance whether an action is purely one type or a mix — and perceive the chromatic texture of the organization's work.

#### Acceptance Criteria

1. WHEN `colorMode` is `energy_type`, THE ActionPointCloud SHALL compute each node's color as a barycentric blend of the three energy-type corner colors, using the node's `energy_weights` as barycentric coordinates.
2. THE three corner colors SHALL be: Dynamis = `#00e5ff` (electric cyan), Oikonomia = `#4f46e5` (deep indigo), Techne = `#a855f7` (vibrant violet).
3. A node with `energy_weights = { dynamis: 1, oikonomia: 0, techne: 0 }` SHALL render as pure `#00e5ff`.
4. A node with `energy_weights = { dynamis: 0, oikonomia: 1, techne: 0 }` SHALL render as pure `#4f46e5`.
5. A node with `energy_weights = { dynamis: 0, oikonomia: 0, techne: 1 }` SHALL render as pure `#a855f7`.
6. A node with equal weights `{ dynamis: 1/3, oikonomia: 1/3, techne: 1/3 }` SHALL render as the centroid blend of all three colors.
7. THE barycentric blend SHALL be computed in linear RGB space (not sRGB/hex) to avoid muddy midpoints, then converted back to hex for the material color.
8. WHEN `colorMode` is NOT `energy_type`, THE existing color logic (cluster, person, status) SHALL be unchanged.
9. THE emissive color of each node SHALL match its blended color, so the glow reflects the energy mix.

---

### Requirement 10: Energy Triangle Legend

**User Story:** As an analytics user, I want a ternary triangle legend showing the three energy types at the corners and a crosshair at the global average, so that I can interpret the barycentric colors at a glance.

#### Acceptance Criteria

1. THE Energeia_Schema SHALL display an Energy_Triangle component when `colorMode` is `energy_type`.
2. THE Energy_Triangle SHALL be an equilateral triangle with Dynamis at the top vertex, Oikonomia at the bottom-left vertex, and Techne at the bottom-right vertex.
3. THE interior of the Energy_Triangle SHALL display a smooth ternary gradient matching the barycentric color blend used for node coloring.
4. THE Energy_Triangle SHALL display a white crosshair or dot at the position corresponding to the global average of all Action_Point `energy_weights`, weighted by `max(1, observation_count)`.
5. THE Energy_Triangle SHALL label each vertex with the energy type name and its corner color.
6. THE Energy_Triangle SHALL be positioned as a compact overlay (e.g. bottom-right corner of the canvas or below the energy bar) and SHALL NOT obscure the main point cloud.
7. WHEN `colorMode` is NOT `energy_type`, THE Energy_Triangle SHALL NOT be rendered.
8. WHEN no Energeia_Cache exists, THE Energy_Triangle SHALL NOT be rendered.

---

### Requirement 8: Out of Scope

**User Story:** As a product owner, I want to explicitly define what is excluded from this release, so that scope is clear and deferred work is documented.

#### Acceptance Criteria

1. THE Energeia_Membrane feature SHALL NOT include a UI mechanism for users to override Claude's Energy_Weights or Boundary_Type classifications.
2. THE Energeia_Membrane feature SHALL NOT introduce a separate Claude invocation for classification — all classification SHALL occur within the existing cluster labeling call.
3. THE Energeia_Membrane feature SHALL NOT add `energy_exporter` or `energy_consumer` classification types — these are explicitly out of scope.
4. THE Energeia_Membrane feature SHALL NOT constrain or modify the PCA computation — spatial separation is post-processing only.
5. THE Energeia_Membrane feature SHALL NOT render multiple separate membrane bubbles — the metaball approach guarantees a single merged surface.
6. THE Energy_Bar SHALL NOT display absolute observation counts or action counts — proportions only.
7. THE barycentric color blending SHALL NOT be applied in colorModes other than `energy_type` — cluster, person, and status modes retain their existing discrete color logic.
