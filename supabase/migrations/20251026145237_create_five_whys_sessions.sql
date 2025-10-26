-- Create five_whys_sessions table to store AI-guided root cause analysis sessions
CREATE TABLE five_whys_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Raw conversation data
  conversation_history JSONB,
  
  -- Structured 5 Whys data
  problem_statement TEXT,
  plausible_causes TEXT[],
  why_1 TEXT,
  why_2 TEXT,
  why_3 TEXT,
  why_4 TEXT,
  why_5 TEXT,
  root_cause TEXT,
  
  -- Session tracking
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for common queries
CREATE INDEX idx_five_whys_sessions_issue_id ON five_whys_sessions(issue_id);
CREATE INDEX idx_five_whys_sessions_organization_id ON five_whys_sessions(organization_id);
CREATE INDEX idx_five_whys_sessions_status ON five_whys_sessions(status);

-- Enable RLS
ALTER TABLE five_whys_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view sessions for issues in their organization
CREATE POLICY "Users can view five whys sessions in their organization"
  ON five_whys_sessions FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS Policy: Users can insert sessions for issues in their organization
CREATE POLICY "Users can create five whys sessions in their organization"
  ON five_whys_sessions FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- RLS Policy: Users can update their own sessions in their organization
CREATE POLICY "Users can update five whys sessions in their organization"
  ON five_whys_sessions FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_five_whys_sessions_updated_at
  BEFORE UPDATE ON five_whys_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE five_whys_sessions IS 'Stores 5 Whys root cause analysis sessions linked to issues';
COMMENT ON COLUMN five_whys_sessions.conversation_history IS 'Raw JSON conversation between AI coach and user';
COMMENT ON COLUMN five_whys_sessions.problem_statement IS 'Structured problem statement from AI conversation';
COMMENT ON COLUMN five_whys_sessions.plausible_causes IS 'Array of three plausible root causes identified';
COMMENT ON COLUMN five_whys_sessions.root_cause IS 'Final root cause identified after 5 Whys analysis';

