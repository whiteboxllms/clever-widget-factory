-- CONSOLIDATED: Simplify checkouts (no planned), ensure action_id, tidy indexes, remove legacy columns,
-- relax backend validation, and keep org_id trigger safe for non-auth contexts.

-- 1) Ensure checkouts.action_id exists with FK and index
ALTER TABLE public.checkouts
ADD COLUMN IF NOT EXISTS action_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'checkouts_action_id_fkey'
  ) THEN
    ALTER TABLE public.checkouts
    ADD CONSTRAINT checkouts_action_id_fkey
    FOREIGN KEY (action_id)
    REFERENCES public.actions(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_checkouts_action_id ON public.checkouts(action_id);

COMMENT ON COLUMN public.checkouts.action_id IS 'Optional link to action for this checkout';

-- 2) Backfill any NULL checkout_date (migrating away from “planned”)
UPDATE public.checkouts
SET checkout_date = COALESCE(checkout_date, created_at)
WHERE checkout_date IS NULL;

-- 3) Enforce checkout_date NOT NULL going forward (instant checkout model)
ALTER TABLE public.checkouts
ALTER COLUMN checkout_date SET NOT NULL;

COMMENT ON COLUMN public.checkouts.checkout_date IS 'When tool was actually checked out (always set).';

-- 4) Drop planned-only partial indexes if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_checkouts_planned_action_id') THEN
    DROP INDEX idx_checkouts_planned_action_id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_checkouts_active_action_id') THEN
    DROP INDEX idx_checkouts_active_action_id;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_checkouts_planned') THEN
    DROP INDEX idx_checkouts_planned;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_checkouts_active') THEN
    DROP INDEX idx_checkouts_active;
  END IF;
END $$;

-- 5) Practical indexes for fast lookups
-- Unreturned by action
CREATE INDEX IF NOT EXISTS idx_checkouts_action_unreturned
ON public.checkouts (action_id)
WHERE is_returned = false;

-- Unreturned by tool
CREATE INDEX IF NOT EXISTS idx_checkouts_tool_unreturned
ON public.checkouts (tool_id)
WHERE is_returned = false;

-- Unreturned by tool with date
CREATE INDEX IF NOT EXISTS idx_checkouts_tool_unreturned_date
ON public.checkouts (tool_id, checkout_date DESC)
WHERE is_returned = false;

-- 6) Relax old backend validation: drop old validate triggers/functions if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_checkout_operation_trigger') THEN
    DROP TRIGGER IF EXISTS validate_checkout_operation_trigger ON checkouts;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_validate_checkout') THEN
    DROP TRIGGER IF EXISTS trigger_validate_checkout ON checkouts;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_checkout_operation') THEN
    DROP FUNCTION validate_checkout_operation() CASCADE;
  END IF;
END $$;

-- 7) Ensure organization_id trigger: populate from auth context; fallback for non-auth contexts (psql etc)
CREATE OR REPLACE FUNCTION set_organization_id_for_checkouts()
RETURNS TRIGGER AS $$
DECLARE
  org_id uuid;
BEGIN
  org_id := get_user_organization_id();
  IF org_id IS NULL THEN
    org_id := '00000000-0000-0000-0000-000000000001';
  END IF;
  NEW.organization_id := org_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_organization_id_checkouts_trigger'
  ) THEN
    CREATE TRIGGER set_organization_id_checkouts_trigger
    BEFORE INSERT ON public.checkouts
    FOR EACH ROW
    EXECUTE FUNCTION set_organization_id_for_checkouts();
  END IF;
END $$;

-- 8) Guardrail: prevent duplicate active checkout by same user for same tool
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_checkouts_unique_active') THEN
    CREATE UNIQUE INDEX idx_checkouts_unique_active
    ON public.checkouts (tool_id, user_id)
    WHERE is_returned = false;
  END IF;
END $$;

COMMENT ON INDEX idx_checkouts_unique_active IS 'Prevents duplicate active checkouts by same user & tool';

-- 9) Remove legacy join-era column and its index if still present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'actions'
      AND column_name = 'required_tool_serial_numbers'
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_actions_required_tool_serial_numbers') THEN
      DROP INDEX idx_actions_required_tool_serial_numbers;
    END IF;

    ALTER TABLE public.actions
    DROP COLUMN required_tool_serial_numbers;

    COMMENT ON TABLE public.actions IS 'Actions; tool assignment is tracked via checkouts (join-based).';
  END IF;
END $$;

-- Optional cleanup: remove legacy planned notes
-- UPDATE public.checkouts
-- SET notes = NULL
-- WHERE notes ILIKE 'Planned for action:%';


