-- Phase 1: Database Schema Enhancement
-- Add parent_structure_id field to tools table
ALTER TABLE tools ADD COLUMN parent_structure_id uuid REFERENCES tools(id);

-- Rename storage_vicinity to legacy_storage_vicinity 
ALTER TABLE tools RENAME COLUMN storage_vicinity TO legacy_storage_vicinity;

-- Phase 2: Data Migration & Standardization
-- Consolidate categories: Update "Structure" and "Infrastructure System" to "Infrastructure"
UPDATE tools 
SET category = 'Infrastructure' 
WHERE category IN ('Structure', 'Infrastructure System');

-- Add index for better performance when querying parent structures
CREATE INDEX idx_tools_parent_structure ON tools(parent_structure_id);
CREATE INDEX idx_tools_category_for_parents ON tools(category) WHERE category IN ('Infrastructure', 'Container');