import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://oskwnlhuuxjfuwnjuavn.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9za3dubGh1dXhqZnV3bmp1YXZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MjMzNTgsImV4cCI6MjA2ODE5OTM1OH0.nWbYYTMu7BOQt8pSRVGBr8Iy3nvLfe40H1W_qpiVXAQ';

const storage =
  typeof window !== 'undefined' && window.localStorage ? window.localStorage : undefined;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export { supabase as client };