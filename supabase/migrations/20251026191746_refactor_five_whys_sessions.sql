-- Refactor five_whys_sessions table to support dynamic why chains
-- Drop old table completely and recreate with simplified schema

DROP TABLE IF EXISTS five_whys_sessions CASCADE;

-- Create simplified schema
CREATE TABLE five_whys_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Raw conversation data
  conversation_history JSONB,
  
  -- AI-generated summary of the why chain
  root_cause_analysis TEXT,
  
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
CREATE INDEX idx_five_whys_sessions_issue_status ON five_whys_sessions(issue_id, status);

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

-- RLS Policy: Users can update sessions in their organization
CREATE POLICY "Users can update five whys sessions in their organization"
  ON five_whys_sessions FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_five_whys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_five_whys_sessions_updated_at
  BEFORE UPDATE ON five_whys_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_five_whys_updated_at();

-- Add comments for documentation
COMMENT ON TABLE five_whys_sessions IS 'Stores 5 Whys root cause analysis sessions linked to issues';
COMMENT ON COLUMN five_whys_sessions.conversation_history IS 'Raw JSON conversation between AI coach and user';
COMMENT ON COLUMN five_whys_sessions.root_cause_analysis IS 'AI-generated summary of the why chain and root cause';
COMMENT ON COLUMN five_whys_sessions.status IS 'Session status: in_progress, completed, or abandoned';

