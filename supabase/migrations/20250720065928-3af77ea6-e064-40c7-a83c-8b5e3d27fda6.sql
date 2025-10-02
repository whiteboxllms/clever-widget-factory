
-- Add mission numbering system
CREATE SEQUENCE IF NOT EXISTS mission_number_seq START 1;

-- Add mission_number column to missions table
ALTER TABLE missions ADD COLUMN IF NOT EXISTS mission_number INTEGER;

-- Create function to generate mission numbers
CREATE OR REPLACE FUNCTION generate_mission_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mission_number IS NULL THEN
    NEW.mission_number = nextval('mission_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-assign mission numbers
DROP TRIGGER IF EXISTS set_mission_number ON missions;
CREATE TRIGGER set_mission_number
  BEFORE INSERT ON missions
  FOR EACH ROW
  EXECUTE FUNCTION generate_mission_number();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_missions_mission_number ON missions(mission_number);

-- Update existing missions to have mission numbers (starting from 1)
DO $$
DECLARE
    mission_record RECORD;
    counter INTEGER := 1;
BEGIN
    FOR mission_record IN 
        SELECT id FROM missions WHERE mission_number IS NULL ORDER BY created_at ASC
    LOOP
        UPDATE missions SET mission_number = counter WHERE id = mission_record.id;
        counter := counter + 1;
    END LOOP;
    
    -- Update sequence to continue from the last assigned number
    PERFORM setval('mission_number_seq', counter);
END $$;

-- Make mission_number NOT NULL after updating existing records
ALTER TABLE missions ALTER COLUMN mission_number SET NOT NULL;

-- Add unique constraint to ensure no duplicate mission numbers
ALTER TABLE missions ADD CONSTRAINT unique_mission_number UNIQUE (mission_number);
