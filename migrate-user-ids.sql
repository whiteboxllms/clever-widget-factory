-- Migration script to update database user IDs to match new Cognito user IDs
-- This allows the new Cognito users to see their existing data

BEGIN;

-- User ID mappings (Old Database ID -> New Cognito ID)
-- Carl Hilo: 4d7124f9-c0f2-490d-a765-3a3f8d1dbad8 -> 989163e0-7011-70ee-6d93-853674acd43c
-- Lester Paniel: 7dd4187f-ff2a-4367-9e7b-0c8741f25495 -> 68d173b0-60f1-70ea-6084-338e74051fcc  
-- Vicky Yap: 0cb0a42d-272b-43ee-b047-7c0b6ec62f6e -> f8d11370-e031-70b4-3e58-081a2e482848
-- Stefan and Mae already have matching IDs

-- 1. Update organization_members
UPDATE organization_members SET user_id = '989163e0-7011-70ee-6d93-853674acd43c' WHERE user_id = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE organization_members SET user_id = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE user_id = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE organization_members SET user_id = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE user_id = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

-- 2. Update profiles
UPDATE profiles SET user_id = '989163e0-7011-70ee-6d93-853674acd43c' WHERE user_id = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE profiles SET user_id = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE user_id = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE profiles SET user_id = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE user_id = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

-- 3. Update actions table
UPDATE actions SET created_by = '989163e0-7011-70ee-6d93-853674acd43c' WHERE created_by = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE actions SET created_by = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE created_by = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE actions SET created_by = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE created_by = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

UPDATE actions SET updated_by = '989163e0-7011-70ee-6d93-853674acd43c' WHERE updated_by = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE actions SET updated_by = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE updated_by = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE actions SET updated_by = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE updated_by = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

UPDATE actions SET assigned_to = '989163e0-7011-70ee-6d93-853674acd43c' WHERE assigned_to = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE actions SET assigned_to = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE assigned_to = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE actions SET assigned_to = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE assigned_to = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

-- 4. Update checkouts
UPDATE checkouts SET user_id = '989163e0-7011-70ee-6d93-853674acd43c' WHERE user_id = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE checkouts SET user_id = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE user_id = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE checkouts SET user_id = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE user_id = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

-- 5. Update action_implementation_updates
UPDATE action_implementation_updates SET updated_by = '989163e0-7011-70ee-6d93-853674acd43c' WHERE updated_by = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE action_implementation_updates SET updated_by = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE updated_by = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE action_implementation_updates SET updated_by = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE updated_by = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

-- 6. Update worker tables
UPDATE worker_attributes SET user_id = '989163e0-7011-70ee-6d93-853674acd43c' WHERE user_id = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE worker_attributes SET user_id = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE user_id = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE worker_attributes SET user_id = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE user_id = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

UPDATE worker_strategic_attributes SET user_id = '989163e0-7011-70ee-6d93-853674acd43c' WHERE user_id = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE worker_strategic_attributes SET user_id = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE user_id = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE worker_strategic_attributes SET user_id = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE user_id = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

UPDATE worker_performance SET user_id = '989163e0-7011-70ee-6d93-853674acd43c' WHERE user_id = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE worker_performance SET user_id = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE user_id = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE worker_performance SET user_id = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE user_id = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

-- 7. Update asset tables
UPDATE asset_history SET changed_by = '989163e0-7011-70ee-6d93-853674acd43c' WHERE changed_by = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE asset_history SET changed_by = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE changed_by = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE asset_history SET changed_by = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE changed_by = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

UPDATE parts SET accountable_person_id = '989163e0-7011-70ee-6d93-853674acd43c' WHERE accountable_person_id = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE parts SET accountable_person_id = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE accountable_person_id = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE parts SET accountable_person_id = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE accountable_person_id = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

UPDATE tools SET accountable_person_id = '989163e0-7011-70ee-6d93-853674acd43c' WHERE accountable_person_id = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE tools SET accountable_person_id = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE accountable_person_id = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE tools SET accountable_person_id = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE accountable_person_id = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

-- 8. Update other tables
UPDATE five_whys_sessions SET created_by = '989163e0-7011-70ee-6d93-853674acd43c' WHERE created_by = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE five_whys_sessions SET created_by = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE created_by = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE five_whys_sessions SET created_by = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE created_by = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

UPDATE tool_audits SET last_user_identified = '989163e0-7011-70ee-6d93-853674acd43c' WHERE last_user_identified = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE tool_audits SET last_user_identified = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE last_user_identified = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE tool_audits SET last_user_identified = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE last_user_identified = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

-- Show migration results
SELECT 'Migration Summary' as result;
SELECT 'Carl Hilo actions' as user_name, COUNT(*) as count FROM actions WHERE created_by = '989163e0-7011-70ee-6d93-853674acd43c'
UNION ALL
SELECT 'Lester Paniel actions', COUNT(*) FROM actions WHERE created_by = '68d173b0-60f1-70ea-6084-338e74051fcc'
UNION ALL  
SELECT 'Vicky Yap actions', COUNT(*) FROM actions WHERE created_by = 'f8d11370-e031-70b4-3e58-081a2e482848'
UNION ALL
SELECT 'Stefan Hamilton actions', COUNT(*) FROM actions WHERE created_by = 'b8006f2b-0ec7-4107-b05a-b4c6b49541fd';

COMMIT;
