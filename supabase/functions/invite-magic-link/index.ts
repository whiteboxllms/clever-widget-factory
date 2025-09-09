import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteRequest {
  email: string;
  organizationId: string;
  organizationName: string;
  role: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, organizationId, organizationName, role }: InviteRequest = await req.json();

    console.log(`Inviting user ${email} to organization ${organizationName} with role ${role}`);

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Send magic link invitation with organization metadata
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${req.headers.get('origin') || 'https://clever-widget-factory.lovable.app'}/accept-invite`,
      data: {
        organization_id: organizationId,
        organization_name: organizationName,
        role: role,
        invited_by: 'admin', // We could get this from the auth header if needed
        needs_password_setup: true
      }
    });

    if (error) {
      console.error('Error inviting user:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    console.log('User invited successfully:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Magic link invitation sent to ${email}`,
        user: data.user 
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error in invite-magic-link function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);