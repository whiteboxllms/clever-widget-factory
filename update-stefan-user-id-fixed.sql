-- Update Stefan's user ID from old Supabase ID to Cognito ID
-- Old ID: 48155769-4d22-4d36-9982-095ac9ad6b2c
-- New ID: 68a18380-7011-70b9-85e7-435f2964154d

BEGIN;

-- First, remove the duplicate organization member entry (keep the one with admin role)
DELETE FROM organization_members 
WHERE user_id = '48155769-4d22-4d36-9982-095ac9ad6b2c' 
AND organization_id = '00000000-0000-0000-0000-000000000001';

-- Update actions table
UPDATE actions 
SET created_by = '68a18380-7011-70b9-85e7-435f2964154d' 
WHERE created_by = '48155769-4d22-4d36-9982-095ac9ad6b2c';

UPDATE actions 
SET updated_by = '68a18380-7011-70b9-85e7-435f2964154d' 
WHERE updated_by = '48155769-4d22-4d36-9982-095ac9ad6b2c';

UPDATE actions 
SET assigned_to = '68a18380-7011-70b9-85e7-435f2964154d' 
WHERE assigned_to = '48155769-4d22-4d36-9982-095ac9ad6b2c';

-- Update missions table
UPDATE missions 
SET created_by = '68a18380-7011-70b9-85e7-435f2964154d' 
WHERE created_by = '48155769-4d22-4d36-9982-095ac9ad6b2c';

UPDATE missions 
SET qa_assigned_to = '68a18380-7011-70b9-85e7-435f2964154d' 
WHERE qa_assigned_to = '48155769-4d22-4d36-9982-095ac9ad6b2c';

-- Update action_implementation_updates table
UPDATE action_implementation_updates 
SET updated_by = '68a18380-7011-70b9-85e7-435f2964154d' 
WHERE updated_by = '48155769-4d22-4d36-9982-095ac9ad6b2c';

-- Update checkouts table
UPDATE checkouts 
SET user_id = '68a18380-7011-70b9-85e7-435f2964154d' 
WHERE user_id = '48155769-4d22-4d36-9982-095ac9ad6b2c';

-- Update issues table
UPDATE issues 
SET assigned_to = '68a18380-7011-70b9-85e7-435f2964154d' 
WHERE assigned_to = '48155769-4d22-4d36-9982-095ac9ad6b2c';

-- Update worker_attributes table
UPDATE worker_attributes 
SET user_id = '68a18380-7011-70b9-85e7-435f2964154d' 
WHERE user_id = '48155769-4d22-4d36-9982-095ac9ad6b2c';

-- Update worker_strategic_attributes table
UPDATE worker_strategic_attributes 
SET user_id = '68a18380-7011-70b9-85e7-435f2964154d' 
WHERE user_id = '48155769-4d22-4d36-9982-095ac9ad6b2c';

-- Remove the old profile (keep the new Cognito one)
DELETE FROM profiles 
WHERE user_id = '48155769-4d22-4d36-9982-095ac9ad6b2c';

-- Show summary of changes
SELECT 'Actions created by Stefan' as description, COUNT(*) as count 
FROM actions WHERE created_by = '68a18380-7011-70b9-85e7-435f2964154d'
UNION ALL
SELECT 'Actions updated by Stefan', COUNT(*) 
FROM actions WHERE updated_by = '68a18380-7011-70b9-85e7-435f2964154d'
UNION ALL
SELECT 'Organization members', COUNT(*) 
FROM organization_members WHERE user_id = '68a18380-7011-70b9-85e7-435f2964154d';

COMMIT;
