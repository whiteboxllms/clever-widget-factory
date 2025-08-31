-- Delete the inactive Lester user profile (the one that doesn't login)
-- Keep user_id: 7dd4187f-ff2a-4367-9e7b-0c8741f25495 (active user from auth logs)
-- Delete user_id: 21e553db-c27c-4bd7-8619-896a22d0dfce (inactive user)

DELETE FROM profiles 
WHERE user_id = '21e553db-c27c-4bd7-8619-896a22d0dfce' 
AND full_name ILIKE '%lester%';