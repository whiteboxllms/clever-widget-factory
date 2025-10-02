-- Create new action_scores table linked directly to actions
CREATE TABLE public.action_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_id UUID NOT NULL REFERENCES public.actions(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL DEFAULT 'action',
  source_id UUID NOT NULL, -- This will be the same as action_id for actions
  prompt_id UUID NOT NULL,
  prompt_text TEXT NOT NULL,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_response JSONB DEFAULT '{}'::jsonb,
  likely_root_causes TEXT[] DEFAULT '{}'::text[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Optional context fields for when asset info is relevant
  asset_context_id UUID, -- Can reference tools, parts, etc. but not required
  asset_context_name TEXT, -- Store asset name for display purposes
  
  UNIQUE(action_id, prompt_id) -- Prevent duplicate scores for same action+prompt
);

-- Enable RLS on action_scores table
ALTER TABLE public.action_scores ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for action_scores (same as asset_scores)
CREATE POLICY "Authenticated users can view action scores" 
ON public.action_scores 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create action scores" 
ON public.action_scores 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update action scores" 
ON public.action_scores 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX idx_action_scores_action_id ON public.action_scores(action_id);
CREATE INDEX idx_action_scores_source_id ON public.action_scores(source_id);
CREATE INDEX idx_action_scores_created_at ON public.action_scores(created_at DESC);

-- Migrate existing data from asset_scores to action_scores
-- Only migrate scores that have a corresponding action in the actions table
INSERT INTO public.action_scores (
  action_id,
  source_type,
  source_id,
  prompt_id,
  prompt_text,
  scores,
  ai_response,
  likely_root_causes,
  created_at,
  updated_at,
  asset_context_id,
  asset_context_name
)
SELECT 
  a.id as action_id,
  'action' as source_type,
  a.id as source_id, -- For actions, source_id = action_id
  as_scores.prompt_id,
  as_scores.prompt_text,
  as_scores.scores,
  as_scores.ai_response,
  as_scores.likely_root_causes,
  as_scores.created_at,
  as_scores.updated_at,
  as_scores.asset_id as asset_context_id,
  as_scores.asset_name as asset_context_name
FROM asset_scores as_scores
JOIN actions a ON (
  (as_scores.source_type = 'action' AND as_scores.source_id = a.id) OR
  (as_scores.source_type = 'issue' AND as_scores.source_id = a.linked_issue_id) OR
  (as_scores.asset_id = a.asset_id AND a.asset_id IS NOT NULL)
)
WHERE as_scores.id IS NOT NULL;

-- Create trigger for updated_at timestamp
CREATE TRIGGER update_action_scores_updated_at
  BEFORE UPDATE ON public.action_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();