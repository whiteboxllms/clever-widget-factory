-- Add column to store the reason when checking in a tool for someone else
ALTER TABLE checkins 
ADD COLUMN checkin_reason TEXT;