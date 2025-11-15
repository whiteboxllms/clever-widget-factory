-- Add cognito_user_id column to tables that reference user_id
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS cognito_user_id VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cognito_user_id VARCHAR(255);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_organization_members_cognito_user_id ON organization_members(cognito_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_cognito_user_id ON profiles(cognito_user_id);

-- Update organization_members with Cognito user IDs
-- (Run this after user migration with actual mapping data)
-- UPDATE organization_members SET cognito_user_id = 'cognito_id' WHERE user_id = 'supabase_id';

-- Update profiles with Cognito user IDs  
-- (Run this after user migration with actual mapping data)
-- UPDATE profiles SET cognito_user_id = 'cognito_id' WHERE id = 'supabase_id';

-- After migration is complete and verified, you can:
-- 1. Update application code to use cognito_user_id instead of user_id
-- 2. Drop the old user_id columns (after backup)
-- ALTER TABLE organization_members DROP COLUMN user_id;
-- ALTER TABLE profiles DROP COLUMN id;
