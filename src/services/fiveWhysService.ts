import { supabase } from '@/integrations/supabase/client';

export interface FiveWhysSession {
  id: string;
  issue_id: string;
  organization_id: string;
  conversation_history: Array<{
    role: string;
    content: string;
    timestamp?: string;
  }>;
  root_cause_analysis?: string;
  status: 'in_progress' | 'completed' | 'abandoned';
  created_at: string;
  updated_at: string;
  created_by: string | null; // Can be null for old sessions
  creator_name?: string;
  message_count?: number;
}

export interface ListSessionsResponse {
  success: boolean;
  data?: {
    sessions: FiveWhysSession[];
    count: number;
  };
  error?: string;
}

export interface GetSessionResponse {
  success: boolean;
  data?: FiveWhysSession;
  error?: string;
}

export interface SaveSessionParams {
  session_id?: string;
  issue_id: string;
  organization_id: string;
  conversation_history: Array<{
    role: string;
    content: string;
    timestamp?: string;
  }>;
  status?: 'in_progress' | 'completed' | 'abandoned';
  created_by: string;
}

export interface CompleteSessionParams {
  session_id: string;
  organization_id: string;
  conversation_history: Array<{
    role: string;
    content: string;
    timestamp?: string;
  }>;
  root_cause_analysis?: string;
  created_by: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://oskwnlhuuxjfuwnjuavn.supabase.co";

export async function listSessions(issueId: string, organizationId: string): Promise<ListSessionsResponse> {
  try {
    const url = new URL(`${SUPABASE_URL}/functions/v1/mcp-server/five-whys/sessions`);
    url.searchParams.set('issue_id', issueId);
    url.searchParams.set('organization_id', organizationId);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9za3dubGh1dXhqZnV3bmp1YXZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MjMzNTgsImV4cCI6MjA2ODE5OTM1OH0.nWbYYTMu7BOQt8pSRVGBr8Iy3nvLfe40H1W_qpiVXAQ";

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || anonKey}`,
        'apikey': anonKey
      }
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error listing sessions:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list sessions'
    };
  }
}

export async function getSession(sessionId: string, organizationId: string): Promise<GetSessionResponse> {
  try {
    const url = new URL(`${SUPABASE_URL}/functions/v1/mcp-server/five-whys/session/${sessionId}`);
    url.searchParams.set('organization_id', organizationId);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9za3dubGh1dXhqZnV3bmp1YXZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MjMzNTgsImV4cCI6MjA2ODE5OTM1OH0.nWbYYTMu7BOQt8pSRVGBr8Iy3nvLfe40H1W_qpiVXAQ";

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || anonKey}`,
        'apikey': anonKey
      }
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error getting session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get session'
    };
  }
}

export async function saveSession(params: SaveSessionParams): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const url = `${SUPABASE_URL}/functions/v1/mcp-server/five-whys/session`;

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9za3dubGh1dXhqZnV3bmp1YXZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MjMzNTgsImV4cCI6MjA2ODE5OTM1OH0.nWbYYTMu7BOQt8pSRVGBr8Iy3nvLfe40H1W_qpiVXAQ";

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || anonKey}`,
        'apikey': anonKey
      },
      body: JSON.stringify(params)
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error saving session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save session'
    };
  }
}

export async function completeSession(params: CompleteSessionParams): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const url = `${SUPABASE_URL}/functions/v1/mcp-server/five-whys/session/${params.session_id}/complete`;

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9za3dubGh1dXhqZnV3bmp1YXZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MjMzNTgsImV4cCI6MjA2ODE5OTM1OH0.nWbYYTMu7BOQt8pSRVGBr8Iy3nvLfe40H1W_qpiVXAQ";

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || anonKey}`,
        'apikey': anonKey
      },
      body: JSON.stringify({
        organization_id: params.organization_id,
        conversation_history: params.conversation_history,
        root_cause_analysis: params.root_cause_analysis,
        created_by: params.created_by
      })
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error completing session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete session'
    };
  }
}

