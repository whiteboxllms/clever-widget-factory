-- Check current triggers on profiles table and fix the role check issue
-- Use information_schema instead of pg_triggers
SELECT trigger_name, event_manipulation, action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'profiles' 
AND event_object_schema = 'public';