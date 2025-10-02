-- Make mission_number column have a default value so it's optional in inserts
ALTER TABLE missions ALTER COLUMN mission_number SET DEFAULT nextval('mission_number_seq');