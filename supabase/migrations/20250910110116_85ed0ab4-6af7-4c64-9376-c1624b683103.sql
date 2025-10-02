-- Update Stargazer Farm's strategic attributes to match action score naming
UPDATE organizations 
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb), 
  '{strategic_attributes}', 
  '["Growth Mindset", "Root Cause Problem Solving", "Teamwork and Transparent Communication", "Quality", "Proactive Documentation", "Safety Focus", "Efficiency", "Asset Stewardship", "Financial Impact", "Energy & Morale Impact"]'::jsonb
)
WHERE name = 'Stargazer Farm';