-- Make mission_id nullable in mission_actions table so actions can be created without assigning to a mission
ALTER TABLE mission_actions 
ALTER COLUMN mission_id DROP NOT NULL;