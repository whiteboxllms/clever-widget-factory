-- Add active flag to organization members
ALTER TABLE organization_members 
ADD COLUMN is_active boolean NOT NULL DEFAULT true;