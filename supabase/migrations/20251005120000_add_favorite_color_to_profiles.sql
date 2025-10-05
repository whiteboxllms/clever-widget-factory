-- Add favorite_color column to profiles table
ALTER TABLE public.profiles ADD COLUMN favorite_color TEXT;

-- Add a check constraint to ensure valid hex colors
ALTER TABLE public.profiles ADD CONSTRAINT valid_hex_color 
CHECK (favorite_color IS NULL OR favorite_color ~ '^#[0-9A-Fa-f]{6}$');

-- Add comment
COMMENT ON COLUMN public.profiles.favorite_color IS 'User selected favorite color in hex format (e.g., #FF5733)';
