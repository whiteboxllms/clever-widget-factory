import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteUserRequest {
  email: string;
  organizationId: string;
  organizationName: string;
  role: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, organizationId, organizationName, role }: InviteUserRequest = await req.json();

    // Create admin Supabase client
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

    // First, check if a user with this email already exists
    const { data: existingUsers, error: searchError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (searchError) {
      console.error('Error searching for existing user:', searchError);
      return new Response(
        JSON.stringify({ error: "Failed to check user existence" }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const existingUser = existingUsers.users.find(user => user.email === email);

    if (existingUser) {
      // User already exists - create a pending invitation
      console.log('User exists, creating pending invitation for:', email);
      
      // Check if they're already a member of this organization
      const { data: existingMember, error: memberCheckError } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', existingUser.id)
        .single();

      if (memberCheckError && memberCheckError.code !== 'PGRST116') {
        console.error('Error checking existing membership:', memberCheckError);
        return new Response(
          JSON.stringify({ error: "Failed to check membership" }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      if (existingMember) {
        return new Response(
          JSON.stringify({ error: "User is already a member of this organization" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      // Create pending invitation
      const { error: pendingError } = await supabaseAdmin
        .from('pending_invitations')
        .insert({
          organization_id: organizationId,
          invitee_user_id: existingUser.id,
          invited_by: existingUser.id, // This should be the current user's ID
          role: role,
        });

      if (pendingError) {
        console.error('Error creating pending invitation:', pendingError);
        return new Response(
          JSON.stringify({ error: "Failed to create invitation" }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      console.log('Pending invitation created successfully for existing user:', email);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Invitation sent to existing user",
          type: "existing_user"
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    } else {
      // User doesn't exist - use Supabase invite system
      console.log('User does not exist, sending email invitation:', email);
      
      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          organization_id: organizationId,
          organization_name: organizationName,
          role: role,
        },
        redirectTo: `${req.headers.get('origin') || 'http://localhost:5173'}/accept-invite?org_id=${organizationId}`
      });

      if (error) {
        console.error('Error sending invitation:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      console.log('Email invitation sent successfully:', { email, organizationName, role });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Invitation sent successfully",
          type: "new_user",
          user: data.user
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }
  } catch (error: any) {
    console.error("Error in invite-user function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);