-- Update Stefan Hamilton's record with Cognito user ID
-- Replace 'YOUR_COGNITO_USER_ID' with your actual Cognito user ID from the frontend
UPDATE organization_members 
SET cognito_user_id = 'YOUR_COGNITO_USER_ID' 
WHERE user_id = '08617390-b001-708d-f61e-07a1698282ec' 
AND full_name = 'Stefan Hamilton';

-- Verify the update
SELECT user_id, full_name, email, cognito_user_id 
FROM organization_members 
WHERE full_name = 'Stefan Hamilton';
