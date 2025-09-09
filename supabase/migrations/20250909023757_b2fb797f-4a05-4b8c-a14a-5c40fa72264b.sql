-- Update malone to be a contributor so he can add assets
UPDATE organization_members 
SET role = 'contributor' 
WHERE user_id = '4d7124f9-c0f2-490d-a765-3a3f8d1dbad8' 
AND organization_id = '00000000-0000-0000-0000-000000000001';