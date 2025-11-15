-- Add cognito_user_id column to organization_members table
ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS cognito_user_id VARCHAR(255) UNIQUE;

-- Update Stefan Hamilton's record with his Cognito user ID (you'll need to replace with actual ID)
-- UPDATE organization_members 
-- SET cognito_user_id = 'your-actual-cognito-user-id' 
-- WHERE email = 'stefan@example.com';
