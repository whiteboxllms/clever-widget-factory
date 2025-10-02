-- Remove duplicate records, keeping only the latest one for each action_id
DELETE FROM action_scores 
WHERE id NOT IN (
  SELECT DISTINCT ON (action_id) id 
  FROM action_scores 
  ORDER BY action_id, created_at DESC
);

-- Update the unique constraint to be on action_id only (not action_id + prompt_id)
-- since we want only one score per action
ALTER TABLE action_scores DROP CONSTRAINT IF EXISTS action_scores_action_id_prompt_id_key;
ALTER TABLE action_scores ADD CONSTRAINT action_scores_action_id_unique UNIQUE (action_id);