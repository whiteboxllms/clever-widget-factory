-- Phase 4: Now safely remove the role column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;