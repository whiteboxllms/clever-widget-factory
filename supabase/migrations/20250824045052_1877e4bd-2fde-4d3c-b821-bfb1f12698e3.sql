-- Fix auth security settings
-- 1. Fix OTP expiry to recommended 5 minutes (300 seconds)
UPDATE auth.config SET
  password_min_length = 8,
  session_timeout = 3600,
  verification_email_timeout = 300,
  verification_sms_timeout = 300,
  max_enrolled_factors = 10;

-- 2. Enable leaked password protection (this is typically done in dashboard settings)
-- Note: This might need to be done in the Supabase dashboard under Auth > Settings
COMMENT ON SCHEMA auth IS 'Updated auth security settings - leaked password protection should be enabled in dashboard';