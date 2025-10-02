-- Add fields to store additional AI response data
ALTER TABLE asset_scores 
ADD COLUMN ai_response jsonb DEFAULT '{}'::jsonb,
ADD COLUMN likely_root_causes text[] DEFAULT '{}';

-- Add comment to explain the new fields
COMMENT ON COLUMN asset_scores.ai_response IS 'Full AI response including likely_root_causes and other analysis';
COMMENT ON COLUMN asset_scores.likely_root_causes IS 'Array of likely root causes identified by AI analysis';