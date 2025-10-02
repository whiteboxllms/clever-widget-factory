-- Remove the complex dual invitation system tables
DROP TABLE IF EXISTS pending_invitations CASCADE;
DROP TABLE IF EXISTS invitations CASCADE;

-- Ensure organization_members table has proper structure for the new system
-- (is_active column was already added in previous migration)