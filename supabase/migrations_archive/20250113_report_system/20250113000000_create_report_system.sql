-- Migration: Create Report System
-- Description: Rename scoring_prompts to prompts, add new fields, create report system tables
-- Date: 2025-01-13

-- 1. Rename scoring_prompts table to prompts
ALTER TABLE scoring_prompts RENAME TO prompts;

-- 2. Add new columns to prompts table
ALTER TABLE prompts 
ADD COLUMN intended_usage TEXT DEFAULT 'scoring',
ADD COLUMN expected_response_json JSONB;

-- Add comment to explain the new fields
COMMENT ON COLUMN prompts.intended_usage IS 'Usage type: scoring, report_generation, image_captioning, etc.';
COMMENT ON COLUMN prompts.expected_response_json IS 'Optional JSON schema for validating AI responses';

-- 3. Create reports table (minimal metadata)
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    last_run TIMESTAMP WITH TIME ZONE,
    run_frequency TEXT NOT NULL DEFAULT 'manual' CHECK (run_frequency IN ('daily', 'weekly', 'monthly', 'manual')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE reports IS 'Minimal metadata for tracking report execution schedule and history';
COMMENT ON COLUMN reports.name IS 'Report name (e.g., "Daily Report - Oct 12")';
COMMENT ON COLUMN reports.last_run IS 'When this report was last generated/updated';
COMMENT ON COLUMN reports.run_frequency IS 'How often this report should be generated';

-- 4. Create report_sections table (stores AI-generated report data)
CREATE TABLE report_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_focus TEXT NOT NULL,
    title TEXT NOT NULL,
    report JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    prompt_id UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE report_sections IS 'Stores AI-generated report data with flexible JSON structure';
COMMENT ON COLUMN report_sections.section_focus IS 'Focus area: equipment_usage, learning, compliance, accomplishment, daily_summary, etc.';
COMMENT ON COLUMN report_sections.title IS 'Section title';
COMMENT ON COLUMN report_sections.report IS 'Raw report data - structure determined by AI/prompt';

-- 5. Create report_section_assignments table (many-to-many join)
CREATE TABLE report_section_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    section_id UUID NOT NULL REFERENCES report_sections(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    added_by UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    UNIQUE(report_id, section_id)
);

-- Add comments
COMMENT ON TABLE report_section_assignments IS 'Many-to-many relationship between reports and sections';
COMMENT ON COLUMN report_section_assignments.sort_order IS 'Position of section within the report';

-- 6. Create indexes for performance
CREATE INDEX idx_reports_last_run ON reports(last_run);
CREATE INDEX idx_reports_run_frequency ON reports(run_frequency);

CREATE INDEX idx_report_sections_section_focus ON report_sections(section_focus);
CREATE INDEX idx_report_sections_created_by ON report_sections(created_by);
CREATE INDEX idx_report_sections_prompt_id ON report_sections(prompt_id);
CREATE INDEX idx_report_sections_created_at ON report_sections(created_at);

CREATE INDEX idx_report_section_assignments_report_id ON report_section_assignments(report_id);
CREATE INDEX idx_report_section_assignments_section_id ON report_section_assignments(section_id);
CREATE INDEX idx_report_section_assignments_sort_order ON report_section_assignments(report_id, sort_order);

-- 7. Set up Row Level Security (RLS)
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_section_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reports table
CREATE POLICY "Users can manage reports" ON reports
    FOR ALL USING (true);

CREATE POLICY "Users can manage report sections" ON report_sections
    FOR ALL USING (true);

CREATE POLICY "Users can manage report section assignments" ON report_section_assignments
    FOR ALL USING (true);

-- 8. Create updated_at trigger function (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 9. Add updated_at triggers
CREATE TRIGGER update_reports_updated_at 
    BEFORE UPDATE ON reports 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_sections_updated_at 
    BEFORE UPDATE ON report_sections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. Add some helpful constraints
ALTER TABLE report_sections 
ADD CONSTRAINT check_section_focus_not_empty CHECK (length(trim(section_focus)) > 0),
ADD CONSTRAINT check_title_not_empty CHECK (length(trim(title)) > 0);

ALTER TABLE reports 
ADD CONSTRAINT check_name_not_empty CHECK (length(trim(name)) > 0);

-- Migration complete
SELECT 'Report system migration completed successfully' AS status;
