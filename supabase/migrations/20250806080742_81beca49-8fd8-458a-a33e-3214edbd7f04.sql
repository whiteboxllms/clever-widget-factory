-- Create tool_audits table
CREATE TABLE public.tool_audits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_id uuid NOT NULL REFERENCES public.tools(id),
  audited_by uuid NOT NULL REFERENCES public.profiles(user_id),
  audited_at timestamp with time zone NOT NULL DEFAULT now(),
  found_in_vicinity boolean NOT NULL,
  found_in_location boolean NOT NULL,
  condition_found text NOT NULL CHECK (condition_found IN ('good', 'fair', 'poor', 'missing')),
  audit_comments text,
  photo_urls text[] DEFAULT '{}',
  flagged_for_maintenance boolean NOT NULL DEFAULT false,
  last_user_identified uuid REFERENCES public.profiles(user_id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add columns to tools table
ALTER TABLE public.tools 
ADD COLUMN last_audited_at timestamp with time zone,
ADD COLUMN audit_status text DEFAULT 'never_audited';

-- Enable RLS on tool_audits
ALTER TABLE public.tool_audits ENABLE ROW LEVEL SECURITY;

-- Create policies for tool_audits
CREATE POLICY "Anyone can view tool audits" 
ON public.tool_audits 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create audits" 
ON public.tool_audits 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND audited_by = auth.uid());

-- Create storage bucket for audit photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('audit-photos', 'audit-photos', true);

-- Create storage policies for audit photos
CREATE POLICY "Anyone can view audit photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'audit-photos');

CREATE POLICY "Authenticated users can upload audit photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'audit-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own audit photos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'audit-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own audit photos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'audit-photos' AND auth.uid() IS NOT NULL);