-- Clean up: Drop the old asset_scores table since we've migrated to action_scores
DROP TABLE IF EXISTS public.asset_scores;