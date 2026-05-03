# Requirements Document

## Introduction

The Energeia Schema is an analytics visualization that reveals how an organization spends its collective energy — what people are actually doing, not what they could do. The name draws from Aristotle: *energeia* ("being-at-work", the actualization of potential) and *schema* ("visible form or shape"). Together, The Energeia Schema is the visible shape of organizational energy. It is the counterpart to Dynamis (areas of focus / potential).

The feature clusters all organizational actions within a configurable time window using k-means on existing action embeddings, reduces them to 3D coordinates via t-SNE, and renders the result as an interactive point cloud in the Analytics Dashboard. Each point represents one action-person relationship. Clusters are labeled by Claude (AWS Bedrock) with inferred role titles and energeia descriptions, surfacing the emergent roles the organization is actually performing.

## Glossary

- **Energeia_Schema**: The Energeia Schema feature as a whole — the pipeline, cache, and visualization that reveals the visible shape of organizational energy.
- **Energeia_Map**: The React Three Fiber 3D visualization component rendered in the Analytics Dashboard showing the org-wide action point cloud.
- **Action_Point**: A single rendered point in the Energeia_Map representing one action-person relationship (either `assigned` or `participant`).
- **Relationship_Type**: The attribute on an Action_Point indicating how the person relates to the action — either `assigned` (primary assignee via `assigned_to` field) or `participant` (appears in the `participants` array).
- **Cluster**: A group of Action_Points with similar embedding vectors, identified by k-means on the original 1536-dimensional vectors.
- **Cluster_Centroid**: The mean vector of a Cluster, used to identify representative actions and rendered as a glowing star node in the Energeia_Map.
- **Cluster_Label**: The AI-generated short role title (2–3 words) and one-sentence energeia description produced by Claude for each Cluster.
- **ML_Lambda**: The new Python AWS Lambda function responsible solely for k-means clustering and t-SNE dimensionality reduction.
- **Energeia_Cache**: The stored result of a completed compute run, containing 3D coordinates, cluster assignments, Cluster_Labels, and a timestamp.
- **Bloom_Level**: The competency engagement score derived from an action's `scoring_data` field, used to determine Action_Point size in the visualization.
- **Refresh**: The on-demand user-triggered pipeline that runs k-means, t-SNE, and AI labeling, then updates the Energeia_Cache.
- **unified_embeddings**: The existing database table storing 1536-dimensional embedding vectors for actions (and other entity types), keyed by `entity_type`, `entity_id`, `embedding_source`, and `organization_id`.

---

## Requirements

### Requirement 1: Action Scope and Relationship Type Tagging

**User Story:** As an organization administrator, I want to see all org actions within a configurable time window represented as points, so that I can understand the full scope of what the organization is actually doing.

#### Acceptance Criteria

1. WHEN the Energeia_Map is loaded, THE Energeia_Map SHALL include all actions whose `created_at` timestamp falls within the configured time window for the current organization.
2. THE Energeia_Map SHALL default to a time window of the last 30 days when no explicit window is configured.
3. THE Energeia_Map SHALL tag each Action_Point with a Relationship_Type of `assigned` when the person is the action's `assigned_to` value.
4. THE Energeia_Map SHALL tag each Action_Point with a Relationship_Type of `participant` when the person appears in the action's `participants` array.
5. WHEN a single action has both an `assigned_to` person and one or more `participants`, THE Energeia_Map SHALL produce one Action_Point per person-action relationship, each with its own Relationship_Type attribute.
6. THE Energeia_Map SHALL render `assigned` and `participant` Action_Points in a single unified point cloud, with Relationship_Type as a visual attribute rather than a separate layer.
7. WHEN the UI relationship type filter is active, THE Energeia_Map SHALL display only Action_Points whose Relationship_Type matches the selected filter values.
8. THE Energeia_Map SHALL provide checkboxes to toggle `assigned` and `participant` Relationship_Types on and off independently, with both enabled by default.

---

### Requirement 2: Embedding Reuse

**User Story:** As a developer, I want the Energeia Map to reuse existing action embeddings, so that no new embedding generation pipeline is needed and the feature stays within the existing architecture.

#### Acceptance Criteria

1. WHEN the ML_Lambda retrieves vectors for clustering, THE ML_Lambda SHALL query the `unified_embeddings` table filtered by `entity_type = 'action'` and the current `organization_id`.
2. THE ML_Lambda SHALL use the `embedding` column (1536-dimensional vector) from `unified_embeddings` as the input to k-means and t-SNE.
3. THE ML_Lambda SHALL use the `embedding_source` text from `unified_embeddings` as the input text sent to Claude for Cluster_Label generation.
4. IF an action does not have a corresponding row in `unified_embeddings`, THEN THE ML_Lambda SHALL exclude that action from the clustering run without failing the pipeline.
5. THE Energeia_Map SHALL NOT trigger any new embedding generation as part of the Refresh pipeline.

---

### Requirement 3: Clustering and Dimensionality Reduction

**User Story:** As an analytics user, I want actions grouped into meaningful clusters and displayed in 3D space, so that I can visually identify patterns in how the organization spends its energy.

#### Acceptance Criteria

1. WHEN a Refresh is triggered, THE ML_Lambda SHALL run k-means clustering on the original 1536-dimensional embedding vectors.
2. THE ML_Lambda SHALL use the number of clusters (k) configured by the user in the UI, defaulting to a sensible value when not explicitly set.
3. WHEN a Refresh is triggered, THE ML_Lambda SHALL run t-SNE to reduce the 1536-dimensional vectors to 3D coordinates for visualization.
4. THE ML_Lambda SHALL assign each Action_Point the cluster membership determined by k-means and paint that membership as the default color attribute on the corresponding t-SNE 3D point.
5. THE ML_Lambda SHALL compute Cluster_Centroids from k-means results and return them alongside the 3D point coordinates.
6. THE ML_Lambda SHALL perform only ML math (k-means and t-SNE); all other pipeline logic SHALL remain in Node.js Lambda functions consistent with the existing stack.
7. WHEN the user changes the k value in the UI, THE Energeia_Map SHALL require a new Refresh to apply the updated cluster count.

---

### Requirement 4: AI Cluster Labeling

**User Story:** As an analytics user, I want each cluster to have a human-readable role title and description, so that I can understand what kind of work each cluster represents without reading individual action titles.

#### Acceptance Criteria

1. WHEN a Refresh is triggered, THE Labeling_Pipeline SHALL identify the 3 to 5 actions with the lowest Euclidean distance to each Cluster_Centroid in the original 1536-dimensional space.
2. THE Labeling_Pipeline SHALL send the `embedding_source` text of those representative actions to Claude via AWS Bedrock.
3. THE Labeling_Pipeline SHALL instruct Claude to generate a short role title of 2 to 3 words and a one-sentence energeia description for each Cluster.
4. THE Labeling_Pipeline SHALL store Claude's generated title and description as the Cluster_Label for that Cluster without any supervisor override step.
5. THE Labeling_Pipeline SHALL run as part of the same on-demand Refresh pipeline as k-means and t-SNE, completing before the Energeia_Cache is updated.
6. IF Claude returns an error for a specific Cluster, THEN THE Labeling_Pipeline SHALL store a fallback label (e.g., "Cluster N") for that Cluster and continue labeling remaining clusters.

---

### Requirement 5: Compute and Caching

**User Story:** As an analytics user, I want the Energeia Map to load instantly from a cache and let me trigger a fresh compute on demand, so that I get fast page loads without waiting for ML computation every time.

#### Acceptance Criteria

1. WHEN the Analytics Dashboard loads, THE Energeia_Map SHALL display the most recent Energeia_Cache immediately without triggering a new compute run.
2. THE Energeia_Map SHALL display the timestamp of the last compute run alongside the visualization.
3. WHEN the user clicks the Refresh button, THE Energeia_Map SHALL trigger the full pipeline (k-means, t-SNE, AI labeling) and update the Energeia_Cache upon completion.
4. THE Energeia_Cache SHALL store: 3D coordinates for each Action_Point, cluster assignment for each Action_Point, Cluster_Labels for each Cluster, and the compute timestamp.
5. WHILE a Refresh is in progress, THE Energeia_Map SHALL display a loading indicator and SHALL NOT replace the currently displayed cached data until the new compute completes.
6. IF no Energeia_Cache exists for the current organization, THEN THE Energeia_Map SHALL display an empty state prompting the user to click Refresh.

---

### Requirement 6: Visualization — The Energeia Schema

**User Story:** As an analytics user, I want an interactive 3D point cloud visualization of all org actions called The Energeia Schema, so that I can explore the organization's collective work patterns spatially and intuitively.

#### Acceptance Criteria

1. THE Energeia_Map SHALL be rendered in the Analytics Dashboard (`src/pages/AnalyticsDashboard.tsx`) positioned after the ObservationsChart component.
2. THE Energeia_Map SHALL render all Action_Points for the current organization as a single unified point cloud on one canvas using React Three Fiber (Three.js).
3. THE Energeia_Map SHALL use a dark, space-like background aesthetic.
4. THE Energeia_Map SHALL auto-rotate by default and SHALL pause rotation when the user interacts with the canvas.
5. WHEN the user stops interacting with the canvas, THE Energeia_Map SHALL resume auto-rotation after an idle timeout.
6. THE Energeia_Map SHALL support orbital controls: drag to rotate, scroll to zoom, and right-click drag to pan.
7. THE Energeia_Map SHALL vary Action_Point size based on the action's Bloom_Level derived from `scoring_data`, where higher competency engagement produces larger points.
8. THE Energeia_Map SHALL render each Cluster_Centroid as a visually distinct glowing star node.
9. WHEN the user hovers over a Cluster_Centroid node, THE Energeia_Map SHALL display the Cluster_Label (AI-generated role title) as a tooltip.
10. WHEN the user hovers over an Action_Point, THE Energeia_Map SHALL display a tooltip containing: action title, person name, Relationship_Type, and Cluster_Label.
11. WHEN the user clicks an Action_Point, THE Energeia_Map SHALL navigate to the action detail page for that action.
12. THE Energeia_Map SHALL support coloring Action_Points by a switchable color attribute, defaulting to cluster membership, with additional options for person and accountable person.
13. THE Energeia_Map SHALL provide filters for: person, participant, Relationship_Type (assigned/participant), and time window.
14. THE Energeia_Map SHALL integrate with the existing date range and user filters already present in the Analytics Dashboard.

---

### Requirement 7: Out of Scope

**User Story:** As a product owner, I want to explicitly define what is excluded from this release, so that scope is clear and deferred work is documented.

#### Acceptance Criteria

1. THE Energeia_Map SHALL NOT include issue flow integration (backlog conversion or development suggestions) in this release.
2. THE Energeia_Map SHALL NOT include a supervisor label override mechanism for Cluster_Labels in this release.
3. THE Energeia_Map SHALL NOT render Dynamis (areas of focus embeddings) on the same canvas as action points in this release.
4. THE Energeia_Map SHALL NOT include a per-person role view on user profile pages in this release.
5. THE Energeia_Map SHALL NOT generate new embeddings; it SHALL rely exclusively on embeddings already present in the `unified_embeddings` table.
