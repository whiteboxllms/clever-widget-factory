-- Clean up organization members that don't have corresponding users in auth.users
-- First, let's see what we're dealing with
DELETE FROM organization_members 
WHERE user_id NOT IN (
  SELECT id FROM auth.users
);

-- Remove the joined_at column since it's not accurate
ALTER TABLE organization_members DROP COLUMN joined_at;