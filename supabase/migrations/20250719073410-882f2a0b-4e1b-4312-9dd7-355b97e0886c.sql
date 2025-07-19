-- Give Cher Mac admin access
UPDATE public.profiles 
SET role = 'admin' 
WHERE full_name = 'Cher Mac' AND user_id = '0cb0a42d-272b-43ee-b047-7c0b6ec62f6e';