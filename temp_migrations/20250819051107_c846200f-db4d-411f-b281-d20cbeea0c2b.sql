-- Create tool_issues table to track individual issues
CREATE TABLE public.tool_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_id UUID NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'functional' CHECK (severity IN ('safety', 'functional', 'cosmetic', 'maintenance')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'removed')),
  reported_by UUID NOT NULL,
  reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  root_cause TEXT,
  resolution_notes TEXT,
  resolution_photo_urls TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tool_issue_history table for audit trail
CREATE TABLE public.tool_issue_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.tool_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_issue_history ENABLE ROW LEVEL SECURITY;

-- Create policies for tool_issues
CREATE POLICY "Authenticated users can view tool issues" 
ON public.tool_issues 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create tool issues" 
ON public.tool_issues 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND reported_by = auth.uid());

CREATE POLICY "Authenticated users can update tool issues" 
ON public.tool_issues 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Create policies for tool_issue_history
CREATE POLICY "Authenticated users can view issue history" 
ON public.tool_issue_history 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create issue history" 
ON public.tool_issue_history 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND changed_by = auth.uid());

-- Create trigger for updated_at on tool_issues
CREATE TRIGGER update_tool_issues_updated_at
BEFORE UPDATE ON public.tool_issues
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for resolution photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('tool-resolution-photos', 'tool-resolution-photos', true);

-- Create storage policies for resolution photos
CREATE POLICY "Authenticated users can upload resolution photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'tool-resolution-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Resolution photos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'tool-resolution-photos');

CREATE POLICY "Users can update resolution photos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'tool-resolution-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete resolution photos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'tool-resolution-photos' AND auth.uid() IS NOT NULL);