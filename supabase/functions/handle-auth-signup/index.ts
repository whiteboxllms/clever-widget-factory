import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

interface WebhookPayload {
  type: string;
  table: string;
  record: any;
  schema: string;
  old_record: null | any;
}

const handler = async (req: Request): Promise<Response> => {
  try {
    const payload: WebhookPayload = await req.json();
    
    // Only handle user creation events
    if (payload.type !== 'INSERT' || payload.table !== 'users') {
      return new Response('OK', { status: 200 });
    }

    const user = payload.record;
    const userMetadata = user.raw_user_meta_data || {};
    
    // Create regular Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // If user was invited with organization metadata, add them to the organization
    if (userMetadata.organization_id && userMetadata.role) {
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: userMetadata.organization_id,
          user_id: user.id,
          role: userMetadata.role,
          invited_by: userMetadata.invited_by || null,
        });

      if (memberError) {
        console.error('Error adding user to organization:', memberError);
      } else {
        console.log(`User ${user.email} added to organization ${userMetadata.organization_id} with role ${userMetadata.role}`);
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error: any) {
    console.error("Error in handle-auth-signup function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);