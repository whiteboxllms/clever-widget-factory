# Observations System - Architecture & Roadmap

## Vision

Create a unified observation system that captures farm/asset state over time, enabling AI to learn patterns, predict degradation, and automatically identify issues requiring intervention.

## Core Concept

**Observation = Photo-First State Capture + AI Analysis**
- Upload photos with per-photo descriptions (table format)
- Every observation automatically gets AI analysis
- Links to multiple entities (tools, parts, fields, assets)
- Observations are standalone (no action required)
- High-impact observations automatically become issues

**Proactivity Metric:**
- Observations without linked actions = proactive monitoring
- Target: 40% of updates should be observations (not action updates)
- Measures preventive mindset vs reactive firefighting

## Architecture

### Phase 1: Core Schema (MVP)

```sql
-- Core observations table
CREATE TABLE observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  
  -- Overall observation summary (optional, can be AI-generated from photos)
  observation_text text,
  
  -- Metadata
  observed_by uuid NOT NULL,  -- cognito_user_id
  observed_at timestamp with time zone NOT NULL DEFAULT NOW(),
  observation_type text,  -- 'inspection', 'monitoring', 'measurement', 'patrol'
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT NOW(),
  updated_at timestamp with time zone DEFAULT NOW()
);

-- Observation photos (one-to-many, each photo has its own description)
CREATE TABLE observation_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid REFERENCES observations(id) ON DELETE CASCADE NOT NULL,
  
  -- Photo details
  photo_url text NOT NULL,
  photo_description text,  -- User's comment on this specific photo
  photo_order integer NOT NULL,  -- Display order
  
  -- Optional metadata
  taken_at timestamp with time zone,
  location jsonb,  -- {lat, lon, accuracy}
  
  created_at timestamp with time zone DEFAULT NOW(),
  
  UNIQUE(observation_id, photo_order)
);

-- Linking table (many-to-many)
CREATE TABLE observation_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid REFERENCES observations(id) ON DELETE CASCADE NOT NULL,
  
  -- Polymorphic link
  entity_type text NOT NULL,  -- 'action', 'part', 'tool', 'issue', 'field', 'asset'
  entity_id uuid NOT NULL,
  
  -- Optional measurement for this specific link
  measured_value numeric,
  measured_unit text,
  
  created_at timestamp with time zone DEFAULT NOW(),
  UNIQUE(observation_id, entity_type, entity_id)
);

-- Indexes
CREATE INDEX idx_observations_org ON observations(organization_id);
CREATE INDEX idx_observations_observed_at ON observations(observed_at);
CREATE INDEX idx_observations_type ON observations(observation_type);
CREATE INDEX idx_observation_photos_observation ON observation_photos(observation_id);
CREATE INDEX idx_observation_links_observation ON observation_links(observation_id);
CREATE INDEX idx_observation_links_entity ON observation_links(entity_type, entity_id);
```

**Deliverables:**
- [ ] Database migration script (observations, observation_photos, observation_links)
- [ ] Lambda CRUD endpoints (`/api/observations`, `/api/observation-photos`, `/api/observation-links`)
- [ ] TypeScript types
- [ ] Photo-first UI: Upload photos → Add descriptions → Link entities → Auto-analyze
- [ ] Table view: Photo | Description | Actions (edit/delete)
- [ ] Entity linking selector (tools, parts, fields, assets)
- [ ] Automatic AI analysis on save

**Note on Relationship to Actions:**
- **Observations** = State capture ("what I see") - standalone, proactive monitoring
- **action_implementation_updates** = Actions taken ("what I did") - changes made, work performed
- Keep `action_implementation_updates` separate - different concept
- Actions may reference observations as "existing state" before work
- Future: Load "existing state" from observations when creating actions

---

### Phase 2: AI Scoring & Analysis

**Every observation triggers AI analysis on save.**

**Analysis Flow:**
1. User saves observation (photos + descriptions + entity links)
2. Backend triggers analysis Lambda
3. AI analyzes observation context (photos, descriptions, linked entities)
4. Analysis stored in `analyses` table
5. Link created via `analysis_contexts` table:
   - `context_service = 'observation_score'`
   - `context_id = observation.id`

**Note:** Using existing flexible `analysis_contexts` junction table. No direct foreign key from observations to analyses.

**Scoring Dimensions:**
- **urgency** (-2 to +2): How quickly does this need attention?
- **impact_of_inaction** (-2 to +2): What happens if we do nothing?
- **asset_degradation_risk** (-2 to +2): Will asset value decline?
- **safety_risk** (-2 to +2): Is there a safety concern?
- **cost_to_fix_now** (-2 to +2): Cost if addressed immediately
- **cost_to_fix_later** (-2 to +2): Cost if deferred

**Analysis Attributes:**
- **recommended_action**: ['immediate_repair', 'schedule_maintenance', 'monitor', 'no_action']
- **affected_systems**: ['hydraulics', 'electrical', 'structural', etc.]
- **root_cause_category**: ['wear', 'misuse', 'environmental', 'design_flaw']

**Deliverables:**
- [ ] Observation scoring prompt template (includes photo analysis)
- [ ] Lambda function to score observations (triggered on create)
- [ ] UI to display observation scores inline
- [ ] Threshold configuration for auto-issue creation
- [ ] Proactivity dashboard: observations vs action updates ratio

---

## UI/UX Design

### Photo-First Observation Creation

**Workflow:**
1. Click "New Observation" button
2. Upload photos (drag-drop or file picker, multiple at once)
3. Photos appear in table format:
   ```
   | Photo Thumbnail | Description | Actions |
   |-----------------|-------------|----------|
   | [creek.jpg]     | [text box]  | [delete] |
   | [culvert.jpg]   | [text box]  | [delete] |
   | [wingwall.jpg]  | [text box]  | [delete] |
   ```
4. User adds description for each photo (optional but encouraged)
5. User links to entities (optional): "Link to: [Tool] [Part] [Field] [Asset]"
6. Click "Save & Analyze"
7. AI analysis runs automatically
8. Results shown: Scores, recommendations, auto-issue creation if needed

**Example Use Case:**
```
Observation: Creek inspection after rain
Photos:
  1. creek-high-water.jpg - "Creek is high but flowing well"
  2. culvert-clear.jpg - "Extra culvert is clear, no debris"
  3. wingwall-intact.jpg - "Wing walls look solid, no erosion"

Linked to: [Field: North Creek Area]

AI Analysis:
  - urgency: -1 (no immediate action needed)
  - impact_of_inaction: -1 (low risk)
  - asset_degradation_risk: -1 (structures in good shape)
  - recommended_action: "monitor" (continue periodic checks)
  
Result: No issue created. Observation logged for historical tracking.
Proactivity: ✓ (observation without action = proactive monitoring)
```

### Observation List View

**Display:**
- Timeline view (most recent first)
- Each observation shows:
  - Date/time
  - Observer name
  - Photo thumbnails (click to expand)
  - Summary text (first photo description or AI-generated)
  - Linked entities (badges)
  - Analysis scores (color-coded: green=good, yellow=monitor, red=action needed)
  - Actions taken (if any)

**Filters:**
- By entity (show all observations for this tool/part/field)
- By date range
- By observer
- By analysis score (show only high-risk observations)
- By action status (observations with/without linked actions)

### Proactivity Dashboard

**Metrics:**
- Total observations this week/month
- Observations without actions (proactive monitoring %)
- Observations that became issues (% requiring intervention)
- Observations that prevented issues (estimated cost savings)
- Top observers (leaderboard)
- Most observed entities (which assets get most attention)

**Target:**
- 40% of updates should be observations (not action updates)
- Measures shift from reactive (action-driven) to proactive (observation-driven)

---

### Phase 3: Auto-Issue Creation

Automatically promote high-impact observations to issues based on scoring thresholds.

**Logic:**
```javascript
// After scoring observation
if (scores.impact_of_inaction >= 1 || scores.safety_risk >= 1) {
  // Create issue automatically
  const issue = await createIssue({
    description: observation.observation_text,
    issue_type: 'maintenance',
    status: 'reported',
    severity: calculateSeverity(scores),
    source_observation_id: observation.id
  });
  
  // Link issue back to observation
  await createObservationLink({
    observation_id: observation.id,
    entity_type: 'issue',
    entity_id: issue.id
  });
}
```

**Deliverables:**
- [ ] Auto-issue creation logic
- [ ] Issue severity calculation from scores
- [ ] UI notification when observation becomes issue
- [ ] Dashboard showing observation → issue conversion rate

---

### Phase 4: Semantic Search & Embeddings

Enable semantic search across observations to find similar historical patterns.

**Integration:**
```sql
-- Add to unified_embeddings
-- Embedding source = observation_text + all photo descriptions
INSERT INTO unified_embeddings (
  entity_type,
  entity_id,
  embedding_source,
  model_version,
  embedding,
  organization_id
)
VALUES (
  'observation',
  observation_id,
  observation_text || ' ' || string_agg(photo_description, ' '),
  'amazon.titan-embed-text-v1',
  embedding_vector,
  organization_id
);
```

**Use Cases:**
- "Find similar observations about creek flooding"
- "What observations led to expensive repairs?"
- "Show me all observations about this field in the last 6 months"
- "Find observations where wing walls were mentioned"

**Deliverables:**
- [ ] Observation embeddings generation (text + photo descriptions)
- [ ] Semantic search endpoint for observations
- [ ] UI: "Similar observations" panel
- [ ] Historical pattern analysis
- [ ] Photo similarity search (AWS Rekognition)

---

### Phase 5: Time-Series State Tracking

Track asset state changes over time using observation measurements.

**Queries:**
```sql
-- Get state trajectory for a field
SELECT 
  o.observed_at,
  ol.measured_value,
  ol.measured_unit,
  o.observation_text
FROM observations o
JOIN observation_links ol ON ol.observation_id = o.id
WHERE ol.entity_type = 'field'
  AND ol.entity_id = 'field-uuid'
  AND ol.measured_unit = 'soil_moisture_percent'
ORDER BY o.observed_at;
```

**Visualizations:**
- Time-series charts for measurements (soil moisture, pH, temperature)
- Degradation curves for asset health
- Predictive maintenance alerts based on trends

**Deliverables:**
- [ ] Time-series query endpoints
- [ ] Chart components for state visualization
- [ ] Trend analysis (linear regression, anomaly detection)
- [ ] Predictive alerts ("soil moisture dropping, irrigation needed in 3 days")

---

### Phase 6: RL Framework Integration

Use observations as state representation for reinforcement learning.

**RL Components:**
- **State**: Observation + linked entities + measurements
- **Action**: Actions taken in response to observations
- **Reward**: Outcome scores (did the action resolve the issue? cost? time?)
- **Policy**: Learn which observations require which actions

**Training Loop:**
1. Observation captured → AI scores it
2. Action taken (or not taken)
3. Outcome observed (follow-up observation)
4. Reward calculated (cost saved, asset preserved, time efficiency)
5. Policy updated (learn better observation → action mapping)

**Deliverables:**
- [ ] Observation → Action → Outcome linking
- [ ] Reward calculation from outcomes
- [ ] Policy learning pipeline
- [ ] Recommendation engine ("Based on similar observations, we recommend...")

---

### Phase 7: Advanced Features

**Image Metadata Extraction & Vision Analysis (Future Scope)**
- Extract EXIF data (GPS, timestamp, device info) from uploaded photos
- AI vision analysis of images (detect rust, cracks, wear, water levels)
- Combine image analysis with user descriptions for richer context
- Automatic tagging and categorization based on image content

**Note:** This is a separate scope of work to be defined later.

**Multi-Modal Observations:**
- Sensor integration (IoT devices auto-create observations)
- Voice notes (transcribe to observation_text)

**Collaborative Observations:**
- Multiple users can add to same observation
- Observation threads/conversations
- Expert review and validation

**Predictive Maintenance:**
- ML models predict when observations will become critical
- Maintenance scheduling optimization
- Cost-benefit analysis of preventive action

**Deliverables:**
- [ ] EXIF metadata extraction (GPS, timestamp)
- [ ] Image analysis Lambda (AWS Rekognition/Bedrock Vision)
- [ ] Vision + description context analysis
- [ ] IoT sensor integration
- [ ] Observation threading (parent_observation_id)
- [ ] Predictive models for asset degradation

---

## Migration Strategy

### Integration with Actions (Future Phase)

**Concept:**
- Observations capture "existing state" before work
- Actions reference multiple observations to document starting conditions
- action_implementation_updates capture "what was done"

**Workflow:**
```
1. User creates observations over time:
   - "Tractor hydraulic fluid is low" (2 weeks ago)
   - "Hydraulic pump making noise" (1 week ago)
   - "Hydraulic leak visible under tractor" (yesterday)
2. AI scores latest observation: impact_of_inaction = +2 (high risk)
3. User creates action: "Repair hydraulic system"
4. Action form shows recent observations for context (last 5)
5. User selects relevant observations to link as "existing state"
6. User completes work, adds implementation update: "Replaced hydraulic pump and hoses"
7. User creates follow-up observation: "Hydraulic system operating normally, no leaks"
```

**Schema Enhancement (Future):**
```sql
-- Use existing observation_links table with link_type
ALTER TABLE observation_links ADD COLUMN link_type text DEFAULT 'related';
-- link_type values: 'related', 'existing_state', 'outcome'

CREATE INDEX idx_observation_links_type ON observation_links(link_type);

-- Query: Get existing state observations for an action
SELECT o.*
FROM observations o
JOIN observation_links ol ON ol.observation_id = o.id
WHERE ol.entity_type = 'action' 
  AND ol.entity_id = 'action-uuid'
  AND ol.link_type = 'existing_state'
ORDER BY o.observed_at DESC;

-- Query: Get before/after observations for an action
SELECT 
  o.observation_text,
  o.observed_at,
  ol.link_type
FROM observations o
JOIN observation_links ol ON ol.observation_id = o.id
WHERE ol.entity_type = 'action' 
  AND ol.entity_id = 'action-uuid'
  AND ol.link_type IN ('existing_state', 'outcome')
ORDER BY o.observed_at;
```

**Deliverables (Future Phase):**
- [ ] Add `link_type` to observation_links table
- [ ] UI: Show recent observations when creating action (last 5)
- [ ] UI: Multi-select observations as "existing state"
- [ ] UI: Show before/after observations on action detail page
- [ ] Analytics: Track observation → action → outcome chains

---

## Removed: Migration from action_implementation_updates

**Decision:** Keep `action_implementation_updates` separate.
- Observations = state ("what I see")
- Implementation updates = actions ("what I did")
- Different concepts, both valuable

---

## API Endpoints

### Phase 1 (MVP)
- `POST /api/observations` - Create observation
- `GET /api/observations` - List observations (filtered by entity)
- `GET /api/observations/{id}` - Get observation details
- `PUT /api/observations/{id}` - Update observation
- `DELETE /api/observations/{id}` - Delete observation
- `POST /api/observation-links` - Link observation to entity
- `DELETE /api/observation-links/{id}` - Remove link

### Phase 2 (Scoring)
- `POST /api/observations/{id}/score` - Score observation with AI
- `GET /api/observations/{id}/analysis` - Get analysis results

### Phase 3 (Auto-Issues)
- `POST /api/observations/{id}/promote-to-issue` - Manually promote to issue
- `GET /api/observations/pending-issues` - Observations that should be issues

### Phase 4 (Search)
- `POST /api/observations/semantic-search` - Search observations by meaning
- `GET /api/observations/{id}/similar` - Find similar observations

### Phase 5 (Time-Series)
- `GET /api/observations/time-series` - Get measurements over time
- `GET /api/observations/trends` - Analyze trends for entity

---

## UI Components

### Phase 1
- `ObservationDialog` - Photo upload + table view for descriptions
- `ObservationPhotoTable` - Table with thumbnail | description | actions
- `ObservationCard` - Display observation with photo gallery
- `ObservationList` - Timeline view of observations
- `ObservationLinkSelector` - Multi-select entities to link
- `PhotoUploader` - Drag-drop photo upload component

### Phase 2
- `ObservationScoreDisplay` - Show AI scores inline
- `ObservationAnalysisPanel` - Detailed analysis view
- `ProactivityDashboard` - Observations vs actions metrics

### Phase 3
- `ObservationToIssuePrompt` - Suggest promoting to issue
- `AutoIssueNotification` - Alert when observation becomes issue

### Phase 4
- `ObservationSearch` - Semantic search interface
- `SimilarObservationsPanel` - Show related observations

### Phase 5
- `ObservationTimeSeriesChart` - Visualize measurements over time
- `AssetStateTimeline` - Show state changes for asset

---

## Success Metrics

### Phase 1 (Adoption)
- Number of observations created per week
- Percentage of actions with linked observations
- Average links per observation

### Phase 2 (AI Quality)
- Accuracy of urgency scores (validated by users)
- Correlation between scores and actual outcomes
- User agreement rate with AI recommendations

### Phase 3 (Issue Prevention)
- Percentage of issues caught early via observations
- Cost savings from preventive action
- Reduction in emergency repairs

### Phase 4 (Knowledge Reuse)
- Search usage frequency
- Time saved finding similar cases
- Pattern recognition accuracy

### Phase 5 (Predictive Value)
- Prediction accuracy for asset degradation
- Maintenance cost reduction
- Asset lifespan extension

---

## Technical Considerations

### Performance
- Index on `observed_at` for time-series queries
- Partition observations by organization_id for large datasets
- Cache frequently accessed observation chains

### Security
- All observations filtered by organization_id
- Observation visibility based on user role
- Audit trail for observation edits

### Data Quality
- Validation: observation_text minimum length
- Required fields: observed_by, observed_at
- Photo URL validation (S3 bucket check)

### Scalability
- Expect 100-1000 observations per day per organization
- Time-series queries optimized with materialized views
- Embeddings generated asynchronously via SQS

---

## Open Questions

1. **Should observations be editable or immutable?**
   - Immutable = better audit trail
   - Editable = fix typos, add details
   - Compromise: Allow edits but track history

2. **How long to retain observations?**
   - Keep all observations forever?
   - Archive old observations (>2 years)?
   - Aggregate old measurements into summaries?

3. **Who can create observations?**
   - All users?
   - Only field workers?
   - IoT sensors (automated)?

4. **Should observations support privacy levels?**
   - Public (visible to all org members)
   - Private (only creator and admins)
   - Team-level (visible to specific teams)

5. **How to handle conflicting observations?**
   - Multiple users observe same thing differently
   - Voting/consensus mechanism?
   - Expert validation required?

---

## Next Steps

1. **Review & Approve Architecture** ✓ (this document)
2. **Phase 1 Implementation**
   - Write migration SQL
   - Create Lambda endpoints
   - Build basic UI
   - Test with real data
3. **Pilot with Small Dataset**
   - Migrate 100 action_implementation_updates
   - Have users create new observations
   - Gather feedback
4. **Iterate & Expand**
   - Add scoring (Phase 2)
   - Enable auto-issues (Phase 3)
   - Roll out to full organization

---

## References

- Existing `analyses` system: `/migrations/001-create-analyses-schema.sql`
- Unified embeddings: `/migrations/create-unified-embeddings-table.sql`
- Issues workflow: `docs/DATABASE_SCHEMA.md` (issues table)
- Action implementation updates: `action_implementation_updates` table
