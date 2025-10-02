-- Create the new strategic attribute type
CREATE TYPE strategic_attribute_type AS ENUM (
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

-- Create new worker_strategic_attributes table for the analytics dashboard
CREATE TABLE worker_strategic_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  attribute_type strategic_attribute_type NOT NULL,
  level integer DEFAULT 0,
  earned_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on the new table
ALTER TABLE worker_strategic_attributes ENABLE ROW LEVEL SECURITY;

-- Create policies for the new table
CREATE POLICY "Leadership can manage all strategic attributes"
ON worker_strategic_attributes
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND profiles.role = 'leadership'
));

CREATE POLICY "Users can manage their own strategic attributes"
ON worker_strategic_attributes
FOR ALL
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view all strategic attributes"
ON worker_strategic_attributes
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Insert default strategic attributes for all existing users
INSERT INTO worker_strategic_attributes (user_id, attribute_type, level)
SELECT DISTINCT 
  p.user_id,
  attr.attribute_type,
  CASE 
    WHEN attr.attribute_type = 'quality' THEN 3
    WHEN attr.attribute_type = 'teamwork' THEN 2
    ELSE 1
  END as level
FROM profiles p
CROSS JOIN (
  SELECT unnest(enum_range(NULL::strategic_attribute_type)) as attribute_type
) attr;