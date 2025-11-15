-- Add Cognito user mapping to organization_members table
ALTER TABLE organization_members 
ADD COLUMN IF NOT EXISTS cognito_user_id TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_organization_members_cognito_id ON organization_members(cognito_user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_email ON organization_members(email);

-- Update existing members with email addresses (you'll need to update these with actual emails)
UPDATE organization_members SET email = 'stefan@cleverwf.com' WHERE user_id = '08617390-b001-708d-f61e-07a1698282ec';
UPDATE organization_members SET email = 'mae@cleverwf.com' WHERE user_id = '1891f310-c071-705a-2c72-0d0a33c92bf0';
UPDATE organization_members SET email = 'antonette@cleverwf.com' WHERE user_id = '5b3f7beb-cd85-463f-94d7-832fd0445255';
UPDATE organization_members SET email = 'gelmar@cleverwf.com' WHERE user_id = '01dbe4ed-bd76-4180-a39d-8760b24800e1';
UPDATE organization_members SET email = 'lester@cleverwf.com' WHERE user_id = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE organization_members SET email = 'malone@cleverwf.com' WHERE user_id = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';

-- When you get actual Cognito user IDs, update them like this:
-- UPDATE organization_members SET cognito_user_id = 'actual-cognito-id' WHERE email = 'stefan@cleverwf.com';
