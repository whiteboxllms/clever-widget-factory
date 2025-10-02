-- Add misuse tracking fields to tool_issues table
ALTER TABLE tool_issues 
ADD COLUMN is_misuse boolean NOT NULL DEFAULT false,
ADD COLUMN related_checkout_id uuid REFERENCES checkouts(id),
ADD COLUMN damage_assessment text,
ADD COLUMN responsibility_assigned boolean NOT NULL DEFAULT false;