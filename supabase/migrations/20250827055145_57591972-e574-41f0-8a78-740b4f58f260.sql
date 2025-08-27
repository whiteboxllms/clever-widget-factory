-- Remove policy_category column and enum type
ALTER TABLE actions DROP COLUMN IF EXISTS policy_category;

-- Drop the policy_category_type enum
DROP TYPE IF EXISTS policy_category_type;