-- Update AttributeType enum to include the 10 strategic attributes
-- Drop the existing enum type and recreate it with the new values
DROP TYPE IF EXISTS attribute_type CASCADE;

CREATE TYPE attribute_type AS ENUM (
  'growth_mindset',
  'root_cause_problem_solving', 
  'teamwork',
  'quality',
  'proactive_documentation',
  'safety_focus',
  'efficiency',
  'asset_stewardship',
  'financial_impact',
  'energy_morale_impact'
);

-- Update worker_attributes table to use the new enum
ALTER TABLE worker_attributes 
ALTER COLUMN attribute_type TYPE attribute_type 
USING CASE 
  WHEN attribute_type::text = 'quality' THEN 'quality'::attribute_type
  ELSE 'growth_mindset'::attribute_type
END;

-- Update issue_requirements table to use the new enum  
ALTER TABLE issue_requirements
ALTER COLUMN attribute_type TYPE attribute_type
USING CASE
  WHEN attribute_type::text = 'quality' THEN 'quality'::attribute_type  
  ELSE 'growth_mindset'::attribute_type
END;

-- Insert sample data for the new attributes if none exist
INSERT INTO worker_attributes (user_id, attribute_type, level)
SELECT DISTINCT 
  wa.user_id,
  attr.attribute_type,
  0
FROM worker_attributes wa
CROSS JOIN (
  SELECT unnest(enum_range(NULL::attribute_type)) as attribute_type
) attr
WHERE NOT EXISTS (
  SELECT 1 FROM worker_attributes wa2 
  WHERE wa2.user_id = wa.user_id 
  AND wa2.attribute_type = attr.attribute_type
);