-- Create action implementation updates table for tracking daily progress
CREATE TABLE public.action_implementation_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES public.actions(id) ON DELETE CASCADE,
  updated_by UUID NOT NULL REFERENCES auth.users(id),
  update_text TEXT NOT NULL,
  update_type TEXT NOT NULL DEFAULT 'progress' CHECK (update_type IN ('progress', 'blocker', 'question', 'completion')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  organization_id UUID NOT NULL
);

-- Add indexes for performance
CREATE INDEX idx_action_implementation_updates_action_id ON public.action_implementation_updates(action_id);
CREATE INDEX idx_action_implementation_updates_created_at ON public.action_implementation_updates(created_at DESC);
CREATE INDEX idx_action_implementation_updates_updated_by ON public.action_implementation_updates(updated_by);

-- Enable RLS
ALTER TABLE public.action_implementation_updates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Authenticated users can view implementation updates" 
ON public.action_implementation_updates 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create implementation updates" 
ON public.action_implementation_updates 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Create trigger to auto-populate organization_id
CREATE OR REPLACE FUNCTION set_organization_id_for_implementation_updates()
RETURNS TRIGGER AS $$
BEGIN
  NEW.organization_id = get_user_organization_id();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_set_organization_id_implementation_updates
  BEFORE INSERT ON public.action_implementation_updates
  FOR EACH ROW
  EXECUTE FUNCTION set_organization_id_for_implementation_updates();

-- Add comment
COMMENT ON TABLE public.action_implementation_updates IS 'Tracks daily implementation updates for actions with full history and accountability';
