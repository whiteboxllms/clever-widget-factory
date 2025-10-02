-- Create attribute system
CREATE TYPE attribute_type AS ENUM (
  'communication', 'quality', 'transparency', 'reliability',
  'mechanical', 'electrical', 'it', 'carpentry', 'plumbing', 
  'hydraulics', 'welding', 'fabrication'
);

-- Worker attributes table
CREATE TABLE worker_attributes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  attribute_type attribute_type NOT NULL,
  level INTEGER DEFAULT 0 CHECK (level >= 0),
  earned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, attribute_type)
);

-- Issue attribute requirements
CREATE TABLE issue_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES tool_issues(id) ON DELETE CASCADE,
  attribute_type attribute_type NOT NULL,
  required_level INTEGER NOT NULL CHECK (required_level >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Worker performance history
CREATE TABLE worker_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
  issue_id UUID REFERENCES tool_issues(id),
  outcome TEXT CHECK (outcome IN ('successful', 'failed', 'escalated', 'incomplete')),
  attributes_used attribute_type[],
  level_at_completion INTEGER,
  completion_notes TEXT,
  supervisor_notes TEXT,
  hours_worked NUMERIC,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add fields to tool_issues table
ALTER TABLE tool_issues ADD COLUMN assigned_to UUID REFERENCES profiles(user_id);
ALTER TABLE tool_issues ADD COLUMN ready_to_work BOOLEAN DEFAULT FALSE;
ALTER TABLE tool_issues ADD COLUMN ai_analysis TEXT;
ALTER TABLE tool_issues ADD COLUMN materials_needed JSONB DEFAULT '[]';
ALTER TABLE tool_issues ADD COLUMN work_progress TEXT;
ALTER TABLE tool_issues ADD COLUMN can_self_claim BOOLEAN DEFAULT FALSE;
ALTER TABLE tool_issues ADD COLUMN estimated_hours NUMERIC;
ALTER TABLE tool_issues ADD COLUMN actual_hours NUMERIC;

-- Enable RLS on new tables
ALTER TABLE worker_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_performance ENABLE ROW LEVEL SECURITY;

-- Create policies for worker_attributes
CREATE POLICY "Users can view all worker attributes" 
ON worker_attributes FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage their own attributes" 
ON worker_attributes FOR ALL 
USING (auth.uid() = user_id);

CREATE POLICY "Leadership can manage all attributes" 
ON worker_attributes FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND role = 'leadership'
));

-- Create policies for issue_requirements
CREATE POLICY "Users can view issue requirements" 
ON issue_requirements FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Tool keepers can manage issue requirements" 
ON issue_requirements FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND role IN ('leadership', 'admin')
));

-- Create policies for worker_performance
CREATE POLICY "Users can view their own performance" 
ON worker_performance FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Leadership can view all performance" 
ON worker_performance FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE user_id = auth.uid() 
  AND role = 'leadership'
));

CREATE POLICY "System can create performance records" 
ON worker_performance FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Create trigger for updating worker_attributes updated_at
CREATE TRIGGER update_worker_attributes_updated_at
  BEFORE UPDATE ON worker_attributes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Initialize default attributes for existing users
INSERT INTO worker_attributes (user_id, attribute_type, level)
SELECT user_id, attr.attribute_type, 0
FROM profiles
CROSS JOIN (
  VALUES 
    ('communication'::attribute_type),
    ('quality'::attribute_type),
    ('transparency'::attribute_type),
    ('reliability'::attribute_type),
    ('mechanical'::attribute_type),
    ('electrical'::attribute_type),
    ('it'::attribute_type)
) AS attr(attribute_type)
WHERE profiles.user_id IS NOT NULL
ON CONFLICT (user_id, attribute_type) DO NOTHING;