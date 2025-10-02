-- Remove any inappropriate triggers from profiles table that reference role field
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    -- Check for triggers on profiles table
    FOR trigger_record IN 
        SELECT triggername 
        FROM pg_triggers 
        WHERE tablename = 'profiles' 
        AND schemaname = 'public'
        AND triggername LIKE '%role%'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_record.triggername || ' ON public.profiles';
    END LOOP;
END $$;

-- Ensure profiles table has proper update trigger for timestamps only
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();