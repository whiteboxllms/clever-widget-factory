-- Get the current user's profile and update their role to tool_keeper
UPDATE profiles 
SET role = 'tool_keeper' 
WHERE user_id = auth.uid();

-- Also update any existing leadership users to have tool_keeper permissions
-- (since tool keepers are essentially a type of leadership role)
UPDATE profiles 
SET role = 'tool_keeper' 
WHERE role = 'leadership';