-- Phase 1: Core Multi-Tenant Infrastructure

-- Create organizations table (tenants)
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE,
  settings JSONB DEFAULT '{}'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create organization members table
CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  invited_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Create invitations table
CREATE TABLE public.invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  invited_by UUID NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, email)
);

-- Add organization_id to existing tables
ALTER TABLE public.tools ADD COLUMN organization_id UUID;
ALTER TABLE public.missions ADD COLUMN organization_id UUID;
ALTER TABLE public.actions ADD COLUMN organization_id UUID;
ALTER TABLE public.issues ADD COLUMN organization_id UUID;
ALTER TABLE public.parts ADD COLUMN organization_id UUID;
ALTER TABLE public.checkouts ADD COLUMN organization_id UUID;
ALTER TABLE public.checkins ADD COLUMN organization_id UUID;
ALTER TABLE public.parts_orders ADD COLUMN organization_id UUID;
ALTER TABLE public.parts_history ADD COLUMN organization_id UUID;
ALTER TABLE public.tool_audits ADD COLUMN organization_id UUID;
ALTER TABLE public.issue_history ADD COLUMN organization_id UUID;
ALTER TABLE public.storage_vicinities ADD COLUMN organization_id UUID;
ALTER TABLE public.suppliers ADD COLUMN organization_id UUID;
ALTER TABLE public.worker_attributes ADD COLUMN organization_id UUID;
ALTER TABLE public.worker_strategic_attributes ADD COLUMN organization_id UUID;
ALTER TABLE public.worker_performance ADD COLUMN organization_id UUID;
ALTER TABLE public.issue_requirements ADD COLUMN organization_id UUID;
ALTER TABLE public.scoring_prompts ADD COLUMN organization_id UUID;
ALTER TABLE public.action_scores ADD COLUMN organization_id UUID;
ALTER TABLE public.mission_attachments ADD COLUMN organization_id UUID;
ALTER TABLE public.inventory_usage ADD COLUMN organization_id UUID;
ALTER TABLE public.mission_tool_usage ADD COLUMN organization_id UUID;

-- Create default organization for existing data
INSERT INTO public.organizations (id, name, subdomain) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'default');

-- Update existing data to belong to default organization
UPDATE public.tools SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.missions SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.actions SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.issues SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.parts SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.checkouts SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.checkins SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.parts_orders SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.parts_history SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.tool_audits SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.issue_history SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.storage_vicinities SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.suppliers SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.worker_attributes SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.worker_strategic_attributes SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.worker_performance SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.issue_requirements SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.scoring_prompts SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.action_scores SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.mission_attachments SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.inventory_usage SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.mission_tool_usage SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

-- Make organization_id required after migration
ALTER TABLE public.tools ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.missions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.actions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.issues ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.parts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.checkouts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.checkins ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.parts_orders ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.parts_history ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.tool_audits ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.issue_history ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.storage_vicinities ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.suppliers ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.worker_attributes ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.worker_strategic_attributes ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.worker_performance ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.issue_requirements ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.scoring_prompts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.action_scores ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.mission_attachments ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.inventory_usage ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.mission_tool_usage ALTER COLUMN organization_id SET NOT NULL;

-- Add foreign key constraints
ALTER TABLE public.tools ADD CONSTRAINT tools_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.missions ADD CONSTRAINT missions_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.actions ADD CONSTRAINT actions_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.issues ADD CONSTRAINT issues_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.parts ADD CONSTRAINT parts_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.checkouts ADD CONSTRAINT checkouts_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.checkins ADD CONSTRAINT checkins_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.parts_orders ADD CONSTRAINT parts_orders_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.parts_history ADD CONSTRAINT parts_history_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.tool_audits ADD CONSTRAINT tool_audits_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.issue_history ADD CONSTRAINT issue_history_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.storage_vicinities ADD CONSTRAINT storage_vicinities_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.worker_attributes ADD CONSTRAINT worker_attributes_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.worker_strategic_attributes ADD CONSTRAINT worker_strategic_attributes_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.worker_performance ADD CONSTRAINT worker_performance_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.issue_requirements ADD CONSTRAINT issue_requirements_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.scoring_prompts ADD CONSTRAINT scoring_prompts_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.action_scores ADD CONSTRAINT action_scores_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.mission_attachments ADD CONSTRAINT mission_attachments_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_usage ADD CONSTRAINT inventory_usage_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.mission_tool_usage ADD CONSTRAINT mission_tool_usage_organization_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Migrate existing users to default organization
INSERT INTO public.organization_members (organization_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', user_id, 
  CASE 
    WHEN role = 'leadership' THEN 'admin'
    WHEN role = 'admin' THEN 'admin'
    ELSE 'user'
  END
FROM public.profiles
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Helper functions for tenant isolation
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id 
  FROM organization_members 
  WHERE user_id = auth.uid() 
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_organization_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM organization_members 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'leadership')
  );
$$;

-- RLS policies for organizations
CREATE POLICY "Users can view their own organization" 
ON public.organizations 
FOR SELECT 
USING (id = public.get_user_organization_id());

CREATE POLICY "Organization admins can update their organization" 
ON public.organizations 
FOR UPDATE 
USING (id = public.get_user_organization_id() AND public.is_organization_admin());

-- RLS policies for organization_members
CREATE POLICY "Users can view members of their organization" 
ON public.organization_members 
FOR SELECT 
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Organization admins can manage members" 
ON public.organization_members 
FOR ALL 
USING (organization_id = public.get_user_organization_id() AND public.is_organization_admin());

-- RLS policies for invitations
CREATE POLICY "Organization admins can manage invitations" 
ON public.invitations 
FOR ALL 
USING (organization_id = public.get_user_organization_id() AND public.is_organization_admin());

-- Update existing RLS policies to include organization isolation
-- Tools
DROP POLICY IF EXISTS "Authenticated users can manage tools" ON public.tools;
DROP POLICY IF EXISTS "Authenticated users can view tools" ON public.tools;

CREATE POLICY "Users can view tools in their organization" 
ON public.tools 
FOR SELECT 
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can manage tools in their organization" 
ON public.tools 
FOR ALL 
USING (organization_id = public.get_user_organization_id());

-- Missions
DROP POLICY IF EXISTS "Authenticated users can view missions" ON public.missions;
DROP POLICY IF EXISTS "Leadership and creators can update missions" ON public.missions;
DROP POLICY IF EXISTS "Leadership can create missions" ON public.missions;
DROP POLICY IF EXISTS "QA can provide feedback on missions" ON public.missions;

CREATE POLICY "Users can view missions in their organization" 
ON public.missions 
FOR SELECT 
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Organization admins can manage missions" 
ON public.missions 
FOR ALL 
USING (organization_id = public.get_user_organization_id() AND public.is_organization_admin());

-- Actions
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON public.actions;
DROP POLICY IF EXISTS "Authenticated users can view mission tasks" ON public.actions;
DROP POLICY IF EXISTS "Leadership can manage mission tasks" ON public.actions;

CREATE POLICY "Users can view actions in their organization" 
ON public.actions 
FOR SELECT 
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can manage actions in their organization" 
ON public.actions 
FOR ALL 
USING (organization_id = public.get_user_organization_id());

-- Issues
DROP POLICY IF EXISTS "Any authenticated user can create issues" ON public.issues;
DROP POLICY IF EXISTS "Authenticated users can update issues" ON public.issues;
DROP POLICY IF EXISTS "Authenticated users can view issues" ON public.issues;

CREATE POLICY "Users can view issues in their organization" 
ON public.issues 
FOR SELECT 
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can manage issues in their organization" 
ON public.issues 
FOR ALL 
USING (organization_id = public.get_user_organization_id());

-- Parts
DROP POLICY IF EXISTS "Authenticated users can manage parts" ON public.parts;
DROP POLICY IF EXISTS "Authenticated users can view parts" ON public.parts;

CREATE POLICY "Users can view parts in their organization" 
ON public.parts 
FOR SELECT 
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can manage parts in their organization" 
ON public.parts 
FOR ALL 
USING (organization_id = public.get_user_organization_id());

-- Add updated_at trigger for organizations
CREATE TRIGGER update_organizations_updated_at
BEFORE UPDATE ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_organization_members_user_id ON public.organization_members(user_id);
CREATE INDEX idx_organization_members_org_id ON public.organization_members(organization_id);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_email ON public.invitations(email);
CREATE INDEX idx_tools_organization_id ON public.tools(organization_id);
CREATE INDEX idx_missions_organization_id ON public.missions(organization_id);
CREATE INDEX idx_actions_organization_id ON public.actions(organization_id);
CREATE INDEX idx_issues_organization_id ON public.issues(organization_id);
CREATE INDEX idx_parts_organization_id ON public.parts(organization_id);