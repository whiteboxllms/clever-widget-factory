-- Enable realtime for mission_tasks table
ALTER TABLE public.mission_tasks REPLICA IDENTITY FULL;

-- Add the table to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_tasks;