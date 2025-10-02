-- Add new SOP fields to checkins table
ALTER TABLE public.checkins 
ADD COLUMN IF NOT EXISTS sop_best_practices TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS what_did_you_do TEXT NOT NULL DEFAULT '';

-- Remove old sop_deviation column if it exists
ALTER TABLE public.checkins 
DROP COLUMN IF EXISTS sop_deviation;