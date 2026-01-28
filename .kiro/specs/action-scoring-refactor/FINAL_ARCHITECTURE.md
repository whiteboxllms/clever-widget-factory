# Scoring System - FINAL

## Schema

```sql
-- Analysis event (container/metadata)
CREATE TABLE analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  created_by uuid,                  -- Who created this analysis
  prompt_id uuid NOT NULL,          -- Required: which prompt was used
  ai_response jsonb,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

-- Scores (numeric values)
CREATE TABLE analysis_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES analyses(id) ON DELETE CASCADE NOT NULL,
  
  score_name text NOT NULL,         -- 'quality', 'efficiency', 'safety'
  score numeric NOT NULL,           -- -2 to +2
  reason text NOT NULL,
  how_to_improve text,
  
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW(),
  UNIQUE(analysis_id, score_name)
);

-- Analysis attributes (categorical, non-numeric)
CREATE TABLE analysis_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES analyses(id) ON DELETE CASCADE NOT NULL,
  
  attribute_name text NOT NULL,     -- 'likely_root_cause', 'risk_factors'
  attribute_values text[] NOT NULL, -- ['equipment failure', 'user error']
  
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW(),
  UNIQUE(analysis_id, attribute_name)
);

-- Context links (to the service that built context)
CREATE TABLE analysis_contexts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid REFERENCES analyses(id) ON DELETE CASCADE NOT NULL,
  
  context_service text NOT NULL,    -- 'action_score', 'issue_score'
  context_id uuid NOT NULL,
  
  created_at timestamp DEFAULT NOW(),
  UNIQUE(analysis_id, context_service, context_id)
);

-- Indexes
CREATE INDEX idx_analyses_org ON analyses(organization_id);
CREATE INDEX idx_analyses_created_by ON analyses(created_by);
CREATE INDEX idx_scores_analysis ON analysis_scores(analysis_id);
CREATE INDEX idx_scores_analysis_name ON analysis_scores(analysis_id, score_name);
CREATE INDEX idx_scores_name ON analysis_scores(score_name);
CREATE INDEX idx_scores_value ON analysis_scores(score);
CREATE INDEX idx_contexts_service_id ON analysis_contexts(context_service, context_id);
CREATE INDEX idx_attrs_name ON analysis_attributes(attribute_name);
CREATE INDEX idx_attrs_values ON analysis_attributes USING GIN(attribute_values);
```

---

## API

```javascript
POST /api/analyses
{
  "organization_id": "org-uuid",
  "scores": [
    { "score_name": "quality", "score": 2, "reason": "...", "how_to_improve": "..." },
    { "score_name": "efficiency", "score": -1, "reason": "...", "how_to_improve": "..." }
  ],
  "analysis_attributes": [
    { "attribute_name": "likely_root_cause", "attribute_values": ["equipment failure", "user error"] }
  ],
  "contexts": [
    { "context_service": "action_score", "context_id": "action-uuid" }
  ]
}
```

---

## Queries

```sql
-- Get scores for an action
SELECT s.score_name, s.score, s.reason, s.how_to_improve
FROM analyses e
JOIN analysis_contexts ec ON ec.analysis_id = e.id
JOIN analysis_scores s ON s.analysis_id = e.id
WHERE ec.context_service = 'action_score' 
  AND ec.context_id = 'action-uuid';

-- Find low efficiency scores
SELECT 
  ec.context_id as action_id,
  s.score,
  s.how_to_improve
FROM analysis_contexts ec
JOIN analysis_scores s ON s.analysis_id = ec.analysis_id
WHERE ec.context_service = 'action_score'
  AND s.score_name = 'efficiency'
  AND s.score < 0;

-- Trend analysis
SELECT 
  DATE_TRUNC('week', e.created_at) as week,
  s.score_name,
  AVG(s.score) as avg_score
FROM analyses e
JOIN analysis_contexts ec ON ec.analysis_id = e.id
JOIN analysis_scores s ON s.analysis_id = e.id
WHERE ec.context_service = 'action_score'
  AND e.organization_id = 'org-uuid'
GROUP BY week, s.score_name;
```

---

## Migration

```sql
BEGIN;

CREATE TABLE analyses (...);
CREATE TABLE analysis_scores (...);
CREATE TABLE analysis_attributes (...);
CREATE TABLE analysis_contexts (...);

-- Migrate action_scores → analyses
INSERT INTO analyses (id, organization_id, prompt_id, ai_response, created_at, updated_at)
SELECT 
  asc.id,
  COALESCE(a.organization_id, '00000000-0000-0000-0000-000000000000'::uuid),
  asc.prompt_id,
  asc.ai_response,
  asc.created_at,
  asc.updated_at
FROM action_scores asc
LEFT JOIN actions a ON a.id = asc.action_id;

-- Migrate scores
INSERT INTO analysis_scores (analysis_id, score_name, score, reason, how_to_improve, created_at)
SELECT 
  e.id,
  dimension.key,
  (dimension.value->>'score')::numeric,
  dimension.value->>'reason',
  dimension.value->>'how_to_improve',
  e.created_at
FROM analyses e
CROSS JOIN LATERAL jsonb_each(
  COALESCE((SELECT scores FROM action_scores WHERE id = e.id), '{}'::jsonb)
) AS dimension(key, value)
WHERE dimension.value ? 'score';

-- Migrate analysis attributes
INSERT INTO analysis_attributes (analysis_id, attribute_name, attribute_values, created_at)
SELECT e.id, 'likely_root_cause', asc.likely_root_causes, e.created_at
FROM analyses e
JOIN action_scores asc ON asc.id = e.id
WHERE asc.likely_root_causes IS NOT NULL;

-- Create contexts
INSERT INTO analysis_contexts (analysis_id, context_service, context_id, created_at)
SELECT e.id, 'action_score', asc.action_id, e.created_at
FROM analyses e
JOIN action_scores asc ON asc.id = e.id
WHERE asc.action_id IS NOT NULL;

COMMIT;
```
