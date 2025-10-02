-- Add RLS policies to allow organization members to view analytics data

-- Policy for worker_performance table
CREATE POLICY "Users can view worker performance in their organization" 
ON public.worker_performance 
FOR SELECT 
USING (organization_id = get_user_organization_id());

-- Policy for checkouts table  
CREATE POLICY "Users can view checkouts in their organization"
ON public.checkouts
FOR SELECT
USING (organization_id = get_user_organization_id());

-- Policy for checkins table
CREATE POLICY "Users can view checkins in their organization" 
ON public.checkins
FOR SELECT
USING (organization_id = get_user_organization_id());