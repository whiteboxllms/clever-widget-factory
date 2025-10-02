-- Add foreign key constraint to worker_strategic_attributes table
ALTER TABLE worker_strategic_attributes 
ADD CONSTRAINT worker_strategic_attributes_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE;