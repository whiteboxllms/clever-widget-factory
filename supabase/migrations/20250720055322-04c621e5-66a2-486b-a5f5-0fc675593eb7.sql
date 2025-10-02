-- Add template information to missions table
ALTER TABLE public.missions 
ADD COLUMN template_id text,
ADD COLUMN template_name text,
ADD COLUMN template_color text,
ADD COLUMN template_icon text;