-- Step 1: Reassign the 2 mission tasks from old malone profile to active malone profile
UPDATE public.mission_tasks 
SET assigned_to = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8'
WHERE assigned_to = '21b25c9a-9a60-4a71-a8b7-47b912b4995a';

-- Step 2: Delete the old malone profile record
DELETE FROM public.profiles 
WHERE user_id = '21b25c9a-9a60-4a71-a8b7-47b912b4995a';

-- Step 3: Delete the old auth user record (this will cascade to any remaining references)
DELETE FROM auth.users 
WHERE id = '21b25c9a-9a60-4a71-a8b7-47b912b4995a';