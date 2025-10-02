-- Add report_photo_urls field to tool_issues table for initial issue reporting photos
ALTER TABLE public.tool_issues 
ADD COLUMN report_photo_urls text[] DEFAULT '{}';

-- Add comment to clarify the difference between report and resolution photos
COMMENT ON COLUMN public.tool_issues.report_photo_urls IS 'Photos uploaded when initially reporting the issue';
COMMENT ON COLUMN public.tool_issues.resolution_photo_urls IS 'Photos uploaded when resolving the issue';