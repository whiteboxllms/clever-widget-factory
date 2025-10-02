-- Update Stefan's role to leadership
UPDATE public.profiles 
SET role = 'leadership' 
WHERE full_name ILIKE '%stefan%' OR user_id IN (
  SELECT id FROM auth.users WHERE email ILIKE '%stefan%'
);