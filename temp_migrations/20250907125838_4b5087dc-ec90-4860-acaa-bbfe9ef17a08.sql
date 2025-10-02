-- Make Stefan Hamilton a super admin
UPDATE profiles 
SET super_admin = true 
WHERE full_name = 'Stefan Hamilton';