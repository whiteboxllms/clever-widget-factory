-- Add score attribution type to action_scores table
ALTER TABLE action_scores 
ADD COLUMN score_attribution_type text DEFAULT 'action'::text;

-- Add index for efficient queries by attribution type
CREATE INDEX idx_action_scores_attribution_type ON action_scores(score_attribution_type);

-- Update existing records to have 'action' attribution type
UPDATE action_scores SET score_attribution_type = 'action' WHERE score_attribution_type IS NULL;