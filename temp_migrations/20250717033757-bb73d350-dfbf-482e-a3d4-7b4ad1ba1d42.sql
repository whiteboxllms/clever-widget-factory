-- Add role column to profiles table
ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user';

-- Update Stefan Hamilton to be an admin
UPDATE public.profiles 
SET role = 'admin' 
WHERE user_id = 'b8006f2b-0ec7-4107-b05a-b4c6b49541fd';