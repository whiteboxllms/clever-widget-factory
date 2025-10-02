-- Add foreign key constraint for organization_id in pending_invitations table
ALTER TABLE public.pending_invitations 
ADD CONSTRAINT pending_invitations_organization_id_fkey 
FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;