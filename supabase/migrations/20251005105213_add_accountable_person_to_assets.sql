-- Add accountable_person_id to tools table
ALTER TABLE tools 
ADD COLUMN accountable_person_id UUID REFERENCES auth.users(id);

-- Add accountable_person_id to parts table  
ALTER TABLE parts 
ADD COLUMN accountable_person_id UUID REFERENCES auth.users(id);

-- Add indexes for performance
CREATE INDEX idx_tools_accountable_person_id ON tools(accountable_person_id);
CREATE INDEX idx_parts_accountable_person_id ON parts(accountable_person_id);

-- Add comments for documentation
COMMENT ON COLUMN tools.accountable_person_id IS 'Person responsible for this tool asset - used for accountability tracking';
COMMENT ON COLUMN parts.accountable_person_id IS 'Person responsible for this part/stock asset - used for accountability tracking';
