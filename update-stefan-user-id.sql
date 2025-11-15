-- Update Stefan's user ID from old Supabase ID to Cognito ID
-- Old ID: 48155769-4d22-4d36-9982-095ac9ad6b2c
-- New ID: 68a18380-7011-70b9-85e7-435f2964154d

BEGIN;

-- Update organization_members
UPDATE organization_members 
SET user_id = '68a18380-7011-70b9-85e7-435f2964154d' 
WHERE user_id = '48155769-4d22-4d36-9982-095ac9ad6b2c';

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

-- Update profiles table (the old profile should be removed and the new one should remain)
UPDATE profiles 
SET user_id = '68a18380-7011-70b9-85e7-435f2964154d' 
WHERE user_id = '48155769-4d22-4d36-9982-095ac9ad6b2c';

-- Show summary of changes
SELECT 'organization_members' as table_name, COUNT(*) as updated_rows 
FROM organization_members WHERE user_id = '68a18380-7011-70b9-85e7-435f2964154d'
UNION ALL
SELECT 'actions (created_by)', COUNT(*) 
FROM actions WHERE created_by = '68a18380-7011-70b9-85e7-435f2964154d'
UNION ALL
SELECT 'actions (updated_by)', COUNT(*) 
FROM actions WHERE updated_by = '68a18380-7011-70b9-85e7-435f2964154d'
UNION ALL
SELECT 'actions (assigned_to)', COUNT(*) 
FROM actions WHERE assigned_to = '68a18380-7011-70b9-85e7-435f2964154d';

COMMIT;
