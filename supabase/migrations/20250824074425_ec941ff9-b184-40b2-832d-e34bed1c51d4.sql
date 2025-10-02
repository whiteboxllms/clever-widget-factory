-- Add policy category enum
CREATE TYPE policy_category_type AS ENUM ('experiment', 'legal', 'product_development', 'training');

-- Add new columns to mission_actions table
ALTER TABLE public.mission_actions 
ADD COLUMN policy_category policy_category_type,
ADD COLUMN asset_id uuid,
ADD COLUMN score numeric,
ADD COLUMN scoring_data jsonb DEFAULT '{}'::jsonb;

-- Add comment for clarity
COMMENT ON COLUMN public.mission_actions.policy_category IS 'Policy category for RL-based scoring alignment';
COMMENT ON COLUMN public.mission_actions.asset_id IS 'Optional link to specific asset/tool';
COMMENT ON COLUMN public.mission_actions.score IS 'RL-based score for completed actions';
COMMENT ON COLUMN public.mission_actions.scoring_data IS 'Detailed scoring information and metadata';