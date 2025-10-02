-- Update checkins table to support multiple after images
ALTER TABLE public.checkins 
DROP COLUMN after_image_url;

ALTER TABLE public.checkins 
ADD COLUMN after_image_urls TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.checkins.after_image_urls IS 'Array of URLs for multiple after-use images';