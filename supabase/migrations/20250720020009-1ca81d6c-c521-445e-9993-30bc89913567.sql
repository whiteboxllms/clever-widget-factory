
-- Update Mae's role to leadership
UPDATE public.profiles 
SET role = 'leadership' 
WHERE full_name = 'Mae' OR user_id IN (
  SELECT id FROM auth.users WHERE email ILIKE '%mae%'
);

-- Create missions table
CREATE TABLE public.missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  plan TEXT NOT NULL,
  resources_required TEXT,
  all_materials_available BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'in_progress', 'qa_review', 'completed', 'cancelled')),
  created_by UUID REFERENCES public.profiles(user_id) NOT NULL,
  qa_assigned_to UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create mission tasks table
CREATE TABLE public.mission_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES public.profiles(user_id),
  done_definition TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'qa_approved')),
  evidence_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  qa_approved_at TIMESTAMP WITH TIME ZONE
);

-- Create mission attachments table for images and evidence
CREATE TABLE public.mission_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.mission_tasks(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  attachment_type TEXT NOT NULL CHECK (attachment_type IN ('problem_statement', 'evidence', 'plan')),
  uploaded_by UUID REFERENCES public.profiles(user_id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create mission tool usage tracking
CREATE TABLE public.mission_tool_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES public.mission_tasks(id) ON DELETE CASCADE,
  checkout_id UUID REFERENCES public.checkouts(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create mission inventory usage tracking
CREATE TABLE public.mission_inventory_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES public.missions(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES public.mission_tasks(id) ON DELETE CASCADE,
  part_id UUID REFERENCES public.parts(id) NOT NULL,
  quantity_used INTEGER NOT NULL,
  usage_description TEXT,
  used_by UUID REFERENCES public.profiles(user_id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for missions
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view missions" 
  ON public.missions 
  FOR SELECT 
  USING (true);

CREATE POLICY "Leadership can create missions" 
  ON public.missions 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'leadership'
    )
  );

CREATE POLICY "Leadership and creators can update missions" 
  ON public.missions 
  FOR UPDATE 
  USING (
    created_by = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'leadership'
    )
  );

-- Add RLS policies for mission tasks
ALTER TABLE public.mission_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view mission tasks" 
  ON public.mission_tasks 
  FOR SELECT 
  USING (true);

CREATE POLICY "Leadership can manage mission tasks" 
  ON public.mission_tasks 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'leadership'
    )
  );

CREATE POLICY "Assigned users can update their tasks" 
  ON public.mission_tasks 
  FOR UPDATE 
  USING (assigned_to = auth.uid());

-- Add RLS policies for mission attachments
ALTER TABLE public.mission_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view mission attachments" 
  ON public.mission_attachments 
  FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can upload attachments" 
  ON public.mission_attachments 
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

-- Add RLS policies for mission tool usage
ALTER TABLE public.mission_tool_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view mission tool usage" 
  ON public.mission_tool_usage 
  FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can track tool usage" 
  ON public.mission_tool_usage 
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

-- Add RLS policies for mission inventory usage
ALTER TABLE public.mission_inventory_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view mission inventory usage" 
  ON public.mission_inventory_usage 
  FOR SELECT 
  USING (true);

CREATE POLICY "Authenticated users can track inventory usage" 
  ON public.mission_inventory_usage 
  FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create storage buckets for mission attachments and evidence
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('mission-attachments', 'mission-attachments', true),
  ('mission-evidence', 'mission-evidence', true);

-- Add updated_at trigger for missions
CREATE TRIGGER update_missions_updated_at 
  BEFORE UPDATE ON public.missions 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger for mission tasks
CREATE TRIGGER update_mission_tasks_updated_at 
  BEFORE UPDATE ON public.mission_tasks 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
