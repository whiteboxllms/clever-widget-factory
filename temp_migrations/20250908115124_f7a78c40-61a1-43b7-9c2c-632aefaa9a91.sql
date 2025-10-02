-- Create pending_invitations table for existing users
CREATE TABLE public.pending_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  invitee_user_id UUID NOT NULL,
  invited_by UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  UNIQUE(organization_id, invitee_user_id)
);

-- Enable RLS
ALTER TABLE public.pending_invitations ENABLE ROW LEVEL SECURITY;

-- Users can view their own pending invitations
CREATE POLICY "Users can view their own pending invitations" 
ON public.pending_invitations 
FOR SELECT 
USING (invitee_user_id = auth.uid());

-- Organization admins can manage invitations for their org
CREATE POLICY "Organization admins can manage pending invitations" 
ON public.pending_invitations 
FOR ALL 
USING ((organization_id = get_user_organization_id()) AND is_organization_admin());

-- Users can update their own invitations (accept/decline)
CREATE POLICY "Users can update their own pending invitations" 
ON public.pending_invitations 
FOR UPDATE 
USING (invitee_user_id = auth.uid());