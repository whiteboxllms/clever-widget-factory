CREATE TABLE IF NOT EXISTS asset_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_type TEXT NOT NULL CHECK (change_type IN ('created', 'updated', 'removed', 'status_change')),
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  notes TEXT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_asset_history_asset_id ON asset_history(asset_id);
CREATE INDEX idx_asset_history_changed_at ON asset_history(changed_at DESC);
CREATE INDEX idx_asset_history_organization ON asset_history(organization_id);

-- RLS Policies
ALTER TABLE asset_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view asset history in their organization"
  ON asset_history FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can insert asset history in their organization"
  ON asset_history FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
