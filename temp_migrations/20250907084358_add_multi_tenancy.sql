-- Add multi-tenancy support
-- ================================

-- 1. Create organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  domain TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Add organization_id to all main tables
ALTER TABLE public.profiles ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.tools ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.parts ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.checkouts ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.checkins ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.issues ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.missions ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 3. Create indexes for performance
CREATE INDEX idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX idx_tools_organization_id ON public.tools(organization_id);
CREATE INDEX idx_parts_organization_id ON public.parts(organization_id);
CREATE INDEX idx_checkouts_organization_id ON public.checkouts(organization_id);
CREATE INDEX idx_checkins_organization_id ON public.checkins(organization_id);
CREATE INDEX idx_issues_organization_id ON public.issues(organization_id);
CREATE INDEX idx_missions_organization_id ON public.missions(organization_id);

-- 4. Create helper function for tenant isolation
CREATE OR REPLACE FUNCTION auth.user_organization_id()
RETURNS UUID AS $$
  SELECT organization_id 
  FROM public.profiles 
  WHERE user_id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- 5. Create default organization for existing data
INSERT INTO public.organizations (id, name, slug, domain) 
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Default Organization',
  'default',
  'default.local'
);

-- 6. Update existing data to belong to default organization
UPDATE public.profiles SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.tools SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.parts SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.checkouts SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.checkins SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.issues SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.missions SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;

-- 7. Make organization_id NOT NULL after populating
ALTER TABLE public.profiles ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.tools ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.parts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.checkouts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.checkins ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.issues ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.missions ALTER COLUMN organization_id SET NOT NULL;

-- 8. Update RLS policies for tenant isolation
-- Drop existing policies that don't have tenant isolation
DROP POLICY IF EXISTS "Anyone can view tools" ON public.tools;
DROP POLICY IF EXISTS "Authenticated users can manage tools" ON public.tools;

-- Create new tenant-aware policies
CREATE POLICY "Users can view tools in their organization" ON public.tools
  FOR SELECT USING (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Authenticated users can manage tools in their organization" ON public.tools
  FOR ALL USING (
    organization_id = auth.user_organization_id()
    AND auth.role() = 'authenticated'
  );

-- Similar updates for other tables
DROP POLICY IF EXISTS "Anyone can view parts" ON public.parts;
DROP POLICY IF EXISTS "Authenticated users can manage parts" ON public.parts;

CREATE POLICY "Users can view parts in their organization" ON public.parts
  FOR SELECT USING (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Authenticated users can manage parts in their organization" ON public.parts
  FOR ALL USING (
    organization_id = auth.user_organization_id()
    AND auth.role() = 'authenticated'
  );

-- Update checkouts policies
DROP POLICY IF EXISTS "Users can view their own checkouts" ON public.checkouts;
DROP POLICY IF EXISTS "Leadership can view all checkouts" ON public.checkouts;

CREATE POLICY "Users can view checkouts in their organization" ON public.checkouts
  FOR SELECT USING (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Leadership can view all checkouts in their organization" ON public.checkouts
  FOR SELECT USING (
    organization_id = auth.user_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role = 'leadership'
    )
  );

-- Update checkins policies
DROP POLICY IF EXISTS "Users can view their own checkins" ON public.checkins;
DROP POLICY IF EXISTS "Leadership can view all checkins" ON public.checkins;

CREATE POLICY "Users can view checkins in their organization" ON public.checkins
  FOR SELECT USING (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Leadership can view all checkins in their organization" ON public.checkins
  FOR SELECT USING (
    organization_id = auth.user_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role = 'leadership'
    )
  );

-- Update issues policies
DROP POLICY IF EXISTS "Authenticated users can view issues" ON public.issues;

CREATE POLICY "Users can view issues in their organization" ON public.issues
  FOR SELECT USING (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Authenticated users can manage issues in their organization" ON public.issues
  FOR ALL USING (
    organization_id = auth.user_organization_id()
    AND auth.role() = 'authenticated'
  );

-- Update missions policies
DROP POLICY IF EXISTS "Anyone can view missions" ON public.missions;
DROP POLICY IF EXISTS "Leadership can create missions" ON public.missions;

CREATE POLICY "Users can view missions in their organization" ON public.missions
  FOR SELECT USING (
    organization_id = auth.user_organization_id()
  );

CREATE POLICY "Leadership can create missions in their organization" ON public.missions
  FOR INSERT USING (
    organization_id = auth.user_organization_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() 
      AND role = 'leadership'
    )
  );

-- Enable RLS on organizations table
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create policy for organizations (users can only see their own organization)
CREATE POLICY "Users can view their own organization" ON public.organizations
  FOR SELECT USING (
    id = auth.user_organization_id()
  );
