-- Fixed migration script - update actions first, then organization_members

BEGIN;

-- 1. Update actions table FIRST (to satisfy foreign key constraints)
UPDATE actions SET created_by = '989163e0-7011-70ee-6d93-853674acd43c' WHERE created_by = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE actions SET created_by = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE created_by = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE actions SET created_by = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE created_by = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

UPDATE actions SET updated_by = '989163e0-7011-70ee-6d93-853674acd43c' WHERE updated_by = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE actions SET updated_by = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE updated_by = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE actions SET updated_by = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE updated_by = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

UPDATE actions SET assigned_to = '989163e0-7011-70ee-6d93-853674acd43c' WHERE assigned_to = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE actions SET assigned_to = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE assigned_to = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE actions SET assigned_to = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE assigned_to = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

-- 2. Now update organization_members
UPDATE organization_members SET user_id = '989163e0-7011-70ee-6d93-853674acd43c' WHERE user_id = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE organization_members SET user_id = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE user_id = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE organization_members SET user_id = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE user_id = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

-- 3. Update profiles
UPDATE profiles SET user_id = '989163e0-7011-70ee-6d93-853674acd43c' WHERE user_id = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE profiles SET user_id = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE user_id = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE profiles SET user_id = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE user_id = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

-- 4. Update other tables
UPDATE checkouts SET user_id = '989163e0-7011-70ee-6d93-853674acd43c' WHERE user_id = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE checkouts SET user_id = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE user_id = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE checkouts SET user_id = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE user_id = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

UPDATE action_implementation_updates SET updated_by = '989163e0-7011-70ee-6d93-853674acd43c' WHERE updated_by = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8';
UPDATE action_implementation_updates SET updated_by = '68d173b0-60f1-70ea-6084-338e74051fcc' WHERE updated_by = '7dd4187f-ff2a-4367-9e7b-0c8741f25495';
UPDATE action_implementation_updates SET updated_by = 'f8d11370-e031-70b4-3e58-081a2e482848' WHERE updated_by = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';

-- Show results
SELECT 'Migration Results' as summary;
SELECT 'Carl Hilo' as name, COUNT(*) as actions FROM actions WHERE created_by = '989163e0-7011-70ee-6d93-853674acd43c'
UNION ALL
SELECT 'Lester Paniel', COUNT(*) FROM actions WHERE created_by = '68d173b0-60f1-70ea-6084-338e74051fcc'
UNION ALL  
SELECT 'Vicky Yap', COUNT(*) FROM actions WHERE created_by = 'f8d11370-e031-70b4-3e58-081a2e482848'
UNION ALL
SELECT 'Stefan Hamilton', COUNT(*) FROM actions WHERE created_by = 'b8006f2b-0ec7-4107-b05a-b4c6b49541fd';

COMMIT;
