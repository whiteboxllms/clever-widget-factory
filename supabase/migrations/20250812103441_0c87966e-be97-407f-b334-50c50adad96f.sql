-- Add cost_evidence_url column to parts table
ALTER TABLE public.parts 
ADD COLUMN cost_evidence_url text;