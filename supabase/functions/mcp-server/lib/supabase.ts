import { createClient } from '@supabase/supabase-js';

export function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function validateOrganizationAccess(
  supabase: ReturnType<typeof createSupabaseClient>,
  organizationId: string
): Promise<boolean> {
  // Validate that the organization exists and is active
  return supabase
    .from('organizations')
    .select('id')
    .eq('id', organizationId)
    .eq('is_active', true)
    .single()
    .then(({ data, error }) => {
      if (error || !data) {
        console.error('Organization validation failed:', error);
        return false;
      }
      return true;
    });
}