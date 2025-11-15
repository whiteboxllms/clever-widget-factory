-- Migrate Stefan's data to new Cognito user ID
-- Old ID: 48155769-4d22-4d36-9982-095ac9ad6b2c  
-- New Cognito ID: 7871f320-d031-70a1-541b-748f221805f3

BEGIN;

-- First, add the new user to auth.users (required for foreign key constraints)
INSERT INTO auth.users (id, email, email_confirmed_at, created_at, updated_at, instance_id, aud, role) 
VALUES (
  '7871f320-d031-70a1-541b-748f221805f3', 
  'stefan@stargazer-farm.com', 
  NOW(), 
  NOW(), 
  NOW(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Update organization_members (remove old, keep new)
DELETE FROM organization_members WHERE user_id = '48155769-4d22-4d36-9982-095ac9ad6b2c';
UPDATE organization_members 
SET user_id = '7871f320-d031-70a1-541b-748f221805f3' 
WHERE user_id = '68a18380-7011-70b9-85e7-435f2964154d';

-- Update actions
UPDATE actions SET created_by = '7871f320-d031-70a1-541b-748f221805f3' WHERE created_by = '48155769-4d22-4d36-9982-095ac9ad6b2c';
UPDATE actions SET updated_by = '7871f320-d031-70a1-541b-748f221805f3' WHERE updated_by = '48155769-4d22-4d36-9982-095ac9ad6b2c';
UPDATE actions SET assigned_to = '7871f320-d031-70a1-541b-748f221805f3' WHERE assigned_to = '48155769-4d22-4d36-9982-095ac9ad6b2c';

-- Update other tables
UPDATE missions SET created_by = '7871f320-d031-70a1-541b-748f221805f3' WHERE created_by = '48155769-4d22-4d36-9982-095ac9ad6b2c';
UPDATE missions SET qa_assigned_to = '7871f320-d031-70a1-541b-748f221805f3' WHERE qa_assigned_to = '48155769-4d22-4d36-9982-095ac9ad6b2c';
UPDATE action_implementation_updates SET updated_by = '7871f320-d031-70a1-541b-748f221805f3' WHERE updated_by = '48155769-4d22-4d36-9982-095ac9ad6b2c';
UPDATE checkouts SET user_id = '7871f320-d031-70a1-541b-748f221805f3' WHERE user_id = '48155769-4d22-4d36-9982-095ac9ad6b2c';
UPDATE issues SET assigned_to = '7871f320-d031-70a1-541b-748f221805f3' WHERE assigned_to = '48155769-4d22-4d36-9982-095ac9ad6b2c';
UPDATE worker_attributes SET user_id = '7871f320-d031-70a1-541b-748f221805f3' WHERE user_id = '48155769-4d22-4d36-9982-095ac9ad6b2c';
UPDATE worker_strategic_attributes SET user_id = '7871f320-d031-70a1-541b-748f221805f3' WHERE user_id = '48155769-4d22-4d36-9982-095ac9ad6b2c';

-- Update profiles (keep the new Cognito one, remove old ones)
DELETE FROM profiles WHERE user_id IN ('48155769-4d22-4d36-9982-095ac9ad6b2c', '68a18380-7011-70b9-85e7-435f2964154d');
INSERT INTO profiles (id, user_id, created_at, updated_at, super_admin) 
VALUES ('7871f320-d031-70a1-541b-748f221805f3', '7871f320-d031-70a1-541b-748f221805f3', NOW(), NOW(), true)
ON CONFLICT (user_id) DO UPDATE SET super_admin = true;

-- Show results
SELECT 'Actions assigned to Stefan' as description, COUNT(*) as count 
FROM actions WHERE created_by = '7871f320-d031-70a1-541b-748f221805f3';

COMMIT;
