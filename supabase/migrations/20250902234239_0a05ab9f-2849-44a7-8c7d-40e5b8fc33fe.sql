-- Grant Lester contributor role to allow asset management
-- This is done as a system-level migration to bypass role change restrictions
UPDATE profiles 
SET role = 'contributor', updated_at = now()
WHERE user_id = '7dd4187f-ff2a-4367-9e7b-0c8741f25495' 
  AND full_name LIKE '%Lester%';