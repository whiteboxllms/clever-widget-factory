import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GetMembersRequest {
  organizationId: string;
}

interface OrganizationMemberWithAuth {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  invited_by: string | null;
  created_at: string;
  is_active: boolean;
  full_name: string | null;
  auth_data: {
    email: string;
    last_sign_in_at: string | null;
    created_at: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing request to get organization members with auth data');

    // Parse the request body
    const { organizationId }: GetMembersRequest = await req.json();

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Organization ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Regular client for organization data
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Admin client for auth data
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the current user's token from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header is required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create authenticated client with the user's token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    console.log(`Fetching organization members for organization: ${organizationId}`);

    // Fetch organization members (full_name is now directly in organization_members)
    const { data: members, error: membersError } = await supabaseAuth
      .from('organization_members')
      .select('*')
      .eq('organization_id', organizationId);

    if (membersError) {
      console.error('Error fetching organization members:', membersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch organization members' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${members?.length || 0} organization members`);

    // Get auth data for each member using admin client
    const membersWithAuth: OrganizationMemberWithAuth[] = [];

    for (const member of members || []) {
      try {
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(member.user_id);

        if (authError) {
          console.error(`Error fetching auth data for user ${member.user_id}:`, authError);
          // Continue with null auth data if we can't fetch it
          membersWithAuth.push({
            ...member,
            auth_data: {
              email: 'Unknown',
              last_sign_in_at: null,
              created_at: member.created_at
            }
          });
        } else {
          membersWithAuth.push({
            ...member,
            auth_data: {
              email: authUser.user.email || 'Unknown',
              last_sign_in_at: authUser.user.last_sign_in_at,
              created_at: authUser.user.created_at
            }
          });
        }
      } catch (error) {
        console.error(`Unexpected error fetching auth data for user ${member.user_id}:`, error);
        // Continue with null auth data if we can't fetch it
        membersWithAuth.push({
          ...member,
          auth_data: {
            email: 'Unknown',
            last_sign_in_at: null,
            created_at: member.created_at
          }
        });
      }
    }

    console.log(`Successfully processed ${membersWithAuth.length} members with auth data`);

    return new Response(
      JSON.stringify({ members: membersWithAuth }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in get-organization-members-with-auth function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});