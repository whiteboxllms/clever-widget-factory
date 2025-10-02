-- Phase 1: Enhance organization_members table (already done in previous migration)
-- Add full_name and super_admin columns to organization_members
ALTER TABLE public.organization_members 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS super_admin BOOLEAN DEFAULT false;

-- Migrate existing data from profiles to organization_members
UPDATE public.organization_members 
SET 
  full_name = profiles.full_name,
  super_admin = COALESCE(profiles.super_admin, false)
FROM public.profiles 
WHERE organization_members.user_id = profiles.user_id
AND organization_members.full_name IS NULL;

-- Phase 2: Update RLS policies to use organization_members.role instead of profiles.role

-- Update checkouts policies
DROP POLICY IF EXISTS "Leadership can view all checkouts" ON public.checkouts;
CREATE POLICY "Leadership can view all checkouts" 
ON public.checkouts 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM organization_members
    WHERE user_id = auth.uid() 
    AND organization_id = get_user_organization_id()
    AND role IN ('leadership', 'admin')
  )
);

-- Update checkins policies  
DROP POLICY IF EXISTS "Leadership can view all checkins" ON public.checkins;
CREATE POLICY "Leadership can view all checkins" 
ON public.checkins 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM organization_members
    WHERE user_id = auth.uid() 
    AND organization_id = get_user_organization_id()
    AND role IN ('leadership', 'admin')
  )
);

-- Update mission_attachments policies
DROP POLICY IF EXISTS "Users can delete their own attachments or leadership can delete" ON public.mission_attachments;
CREATE POLICY "Users can delete their own attachments or leadership can delete" 
ON public.mission_attachments 
FOR DELETE 
USING (
  uploaded_by = auth.uid() OR 
  EXISTS (
    SELECT 1
    FROM organization_members
    WHERE user_id = auth.uid() 
    AND organization_id = get_user_organization_id()
    AND role IN ('leadership', 'admin')
  )
);

-- Update worker_attributes policies
DROP POLICY IF EXISTS "Leadership can manage all attributes" ON public.worker_attributes;
CREATE POLICY "Leadership can manage all attributes" 
ON public.worker_attributes 
FOR ALL 
USING (
  EXISTS (
    SELECT 1
    FROM organization_members
    WHERE user_id = auth.uid() 
    AND organization_id = get_user_organization_id()
    AND role IN ('leadership', 'admin')
  )
);

-- Update issue_requirements policies
DROP POLICY IF EXISTS "Tool keepers can manage issue requirements" ON public.issue_requirements;
CREATE POLICY "Tool keepers can manage issue requirements" 
ON public.issue_requirements 
FOR ALL 
USING (
  EXISTS (
    SELECT 1
    FROM organization_members
    WHERE user_id = auth.uid() 
    AND organization_id = get_user_organization_id()
    AND role IN ('leadership', 'admin')
  )
);

-- Update worker_performance policies
DROP POLICY IF EXISTS "Leadership can view all performance" ON public.worker_performance;
CREATE POLICY "Leadership can view all performance" 
ON public.worker_performance 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM organization_members
    WHERE user_id = auth.uid() 
    AND organization_id = get_user_organization_id()
    AND role IN ('leadership', 'admin')
  )
);

-- Update worker_strategic_attributes policies
DROP POLICY IF EXISTS "Leadership can manage all strategic attributes" ON public.worker_strategic_attributes;
CREATE POLICY "Leadership can manage all strategic attributes" 
ON public.worker_strategic_attributes 
FOR ALL 
USING (
  EXISTS (
    SELECT 1
    FROM organization_members
    WHERE user_id = auth.uid() 
    AND organization_id = get_user_organization_id()
    AND role IN ('leadership', 'admin')
  )
);