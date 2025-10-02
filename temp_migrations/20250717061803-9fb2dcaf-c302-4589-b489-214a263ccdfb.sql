-- Add motor field to tools table
ALTER TABLE public.tools 
ADD COLUMN has_motor boolean NOT NULL DEFAULT false;

-- Add usage hours to checkins table
ALTER TABLE public.checkins 
ADD COLUMN hours_used numeric;

-- Add comment for the new columns
COMMENT ON COLUMN public.tools.has_motor IS 'Indicates if the tool has a motor and requires hour tracking';
COMMENT ON COLUMN public.checkins.hours_used IS 'Number of hours the tool was used (for motor tools only)';