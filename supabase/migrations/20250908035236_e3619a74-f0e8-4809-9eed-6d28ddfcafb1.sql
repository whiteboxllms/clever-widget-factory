-- Update action_scores RLS policy to filter by organization
-- First, drop the existing view policy
DROP POLICY IF EXISTS "Authenticated users can view action scores" ON action_scores;

-- Create a new policy that filters by organization using the action's organization_id
CREATE POLICY "Users can view action scores in their organization" 
ON action_scores 
FOR SELECT 
USING (organization_id = get_user_organization_id());

-- Update the other policies to also use organization filtering for consistency
DROP POLICY IF EXISTS "Authenticated users can create action scores" ON action_scores;
DROP POLICY IF EXISTS "Authenticated users can update action scores" ON action_scores;

CREATE POLICY "Users can create action scores in their organization" 
ON action_scores 
FOR INSERT 
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update action scores in their organization" 
ON action_scores 
FOR UPDATE 
USING (organization_id = get_user_organization_id());