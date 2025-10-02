-- Step 1: Add a temporary UUID column
ALTER TABLE parts_history ADD COLUMN changed_by_uuid UUID;

-- Step 2: Create a system user profile for "System User" entries
INSERT INTO profiles (user_id, full_name, role) 
VALUES ('00000000-0000-0000-0000-000000000000', 'System User', 'system')
ON CONFLICT (user_id) DO NOTHING;

-- Step 3: Update the new column with proper UUIDs
-- First, handle email mappings
UPDATE parts_history 
SET changed_by_uuid = au.id
FROM auth.users au
WHERE parts_history.changed_by = au.email;

-- Handle "System User" entries
UPDATE parts_history 
SET changed_by_uuid = '00000000-0000-0000-0000-000000000000'
WHERE parts_history.changed_by = 'System User';

-- Step 4: Drop the old column and rename the new one
ALTER TABLE parts_history DROP COLUMN changed_by;
ALTER TABLE parts_history RENAME COLUMN changed_by_uuid TO changed_by;

-- Step 5: Make the column NOT NULL and add foreign key constraint
ALTER TABLE parts_history ALTER COLUMN changed_by SET NOT NULL;
ALTER TABLE parts_history ADD CONSTRAINT fk_parts_history_changed_by 
  FOREIGN KEY (changed_by) REFERENCES profiles(user_id);

-- Step 6: Do the same for mission_inventory_usage.used_by if needed
-- First check if it has the same issue
UPDATE mission_inventory_usage 
SET used_by = au.id
FROM auth.users au
WHERE mission_inventory_usage.used_by = au.email;