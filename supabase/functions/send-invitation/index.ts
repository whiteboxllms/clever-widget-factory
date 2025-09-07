import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  organizationName: string;
  inviteToken: string;
  role: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, organizationName, inviteToken, role }: InvitationRequest = await req.json();

    // For now, just log the invitation (in production, you'd integrate with an email service)
    console.log("Invitation details:", {
      email,
      organizationName,
      inviteToken,
      role,
      inviteUrl: `${Deno.env.get('SUPABASE_URL')?.replace('oskwnlhuuxjfuwnjuavn.supabase.co', '')}auth?token=${inviteToken}`
    });

    // In a real implementation, you would:
    // 1. Use a service like Resend to send the invitation email
    // 2. Include the invitation link in the email
    // 3. Handle email templates
    
    // For development, we'll simulate successful email sending
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Invitation email sent successfully",
        inviteUrl: `${req.headers.get('origin') || 'http://localhost:5173'}/auth?token=${inviteToken}`
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
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