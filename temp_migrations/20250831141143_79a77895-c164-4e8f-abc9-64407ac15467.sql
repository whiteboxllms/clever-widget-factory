-- Update Cher Mac's role from admin to user
UPDATE profiles 
SET role = 'user' 
WHERE user_id = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e' 
AND full_name = 'Cher Mac';