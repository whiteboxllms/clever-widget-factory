-- Create scoring_prompts table
CREATE TABLE public.scoring_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scoring_prompts ENABLE ROW LEVEL SECURITY;

-- Create policies for scoring_prompts
CREATE POLICY "Authenticated users can view prompts" 
ON public.scoring_prompts 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create prompts" 
ON public.scoring_prompts 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

CREATE POLICY "Authenticated users can update prompts" 
ON public.scoring_prompts 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Create asset_scores table
CREATE TABLE public.asset_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL,
  asset_name TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('issue', 'action')),
  source_id UUID NOT NULL,
  prompt_id UUID NOT NULL,
  prompt_text TEXT NOT NULL,
  scores JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.asset_scores ENABLE ROW LEVEL SECURITY;

-- Create policies for asset_scores
CREATE POLICY "Authenticated users can view asset scores" 
ON public.asset_scores 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create asset scores" 
ON public.asset_scores 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update asset scores" 
ON public.asset_scores 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Add foreign key references
ALTER TABLE public.asset_scores 
ADD CONSTRAINT fk_asset_scores_tool_id 
FOREIGN KEY (asset_id) REFERENCES public.tools(id) ON DELETE CASCADE;

ALTER TABLE public.asset_scores 
ADD CONSTRAINT fk_asset_scores_prompt_id 
FOREIGN KEY (prompt_id) REFERENCES public.scoring_prompts(id) ON DELETE RESTRICT;

-- Create updated_at trigger for scoring_prompts
CREATE TRIGGER update_scoring_prompts_updated_at
BEFORE UPDATE ON public.scoring_prompts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for asset_scores
CREATE TRIGGER update_asset_scores_updated_at
BEFORE UPDATE ON public.asset_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default prompt
INSERT INTO public.scoring_prompts (name, prompt_text, is_default, created_by) VALUES (
  'Default Farm Asset Scoring',
  'You are a scoring assistant. Score the following JSON issue report against the 8 attributes listed below. Each attribute should receive:
- A score from -2 (severe negative impact) to +2 (strong positive impact).
- A one-line justification.

The score should be attached to the "asset" mentioned in the JSON if available.

Growth mindset – Actively seeks better solutions, including using AI tools, and continues growing knowledge.

Root cause problem solving – Looks beyond surface issues, considers multiple options, and methodically verifies root cause before coming up with solutions.

Teamwork and transparent communication – Shares key information openly, raises concerns early, and collaborates on unclear tasks.

Quality – Follows established guidelines and quality standards rather than improvising shortcuts.

Proactive documentation – Records issues and progress before failures occur, with photos or notes for clarity.

Safety focus – Works carefully to prevent accidents and protect people, equipment, and the farm environment.

Efficiency – Uses time and tools effectively, taking time to set up one''s environment for maximum productivity.

Asset stewardship – Protects company resources by using them as intended, ensures the right parts and stock are used, and waits to purchase correct items instead of misusing expensive or unsuitable ones.

Provide output in JSON format with the following structure:
{
  "asset": "name from input JSON or ''unspecified''",
  "scores": {
    "Growth Mindset": { "score": X, "reason": "..." },
    "Root Cause Problem Solving": { "score": X, "reason": "..." },
    "Teamwork and Transparent Communication": { "score": X, "reason": "..." },
    "Quality": { "score": X, "reason": "..." },
    "Proactive Documentation": { "score": X, "reason": "..." },
    "Safety Focus": { "score": X, "reason": "..." },
    "Efficiency": { "score": X, "reason": "..." },
    "Asset Stewardship": { "score": X, "reason": "..." }
  }
}

Input JSON (issue report):',
  true,
  '00000000-0000-0000-0000-000000000000'
);