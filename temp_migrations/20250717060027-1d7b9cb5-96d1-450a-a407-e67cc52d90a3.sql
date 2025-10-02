-- Add pre_existing_issues column to checkouts table to track issues found during checkout inspection
ALTER TABLE public.checkouts 
ADD COLUMN pre_existing_issues TEXT;