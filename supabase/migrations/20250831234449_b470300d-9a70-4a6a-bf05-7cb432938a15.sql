-- First, transfer any actions assigned to the inactive Lester to the active one
-- From: 21e553db-c27c-4bd7-8619-896a22d0dfce (inactive)
-- To: 7dd4187f-ff2a-4367-9e7b-0c8741f25495 (active)

UPDATE actions 
SET assigned_to = '7dd4187f-ff2a-4367-9e7b-0c8741f25495'
WHERE assigned_to = '21e553db-c27c-4bd7-8619-896a22d0dfce';

-- Now delete the inactive Lester user profile
DELETE FROM profiles 
WHERE user_id = '21e553db-c27c-4bd7-8619-896a22d0dfce' 
AND full_name ILIKE '%lester%';