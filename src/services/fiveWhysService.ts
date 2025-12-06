// Note: Five Whys service migrated from Supabase to AWS
// This service is currently disabled during migration

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
  root_cause_analysis?: string;
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

export interface ChatFiveWhysParams {
  messages: Array<{
    role: string;
    content: string;
  }>;
  stage: string;
  why_count?: number;
  issue_description?: string;
}

export interface ChatFiveWhysResponse {
  success: boolean;
  data?: {
    message: string;
    stage: string;
    why_count: number;
    is_root_cause_summary?: boolean;
  };
  error?: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://oskwnlhuuxjfuwnjuavn.supabase.co";

export async function listSessions(issueId: string, organizationId: string): Promise<ListSessionsResponse> {
  // TODO: Implement AWS Lambda endpoint for Five Whys sessions
  return {
    success: false,
    error: 'Five Whys service is temporarily disabled during AWS migration'
  };
}

export async function getSession(sessionId: string, organizationId: string): Promise<GetSessionResponse> {
  // TODO: Implement AWS Lambda endpoint for Five Whys session retrieval
  return {
    success: false,
    error: 'Five Whys service is temporarily disabled during AWS migration'
  };
}

export async function saveSession(params: SaveSessionParams): Promise<{ success: boolean; data?: any; error?: string }> {
  // TODO: Implement AWS Lambda endpoint for Five Whys session saving
  return {
    success: false,
    error: 'Five Whys service is temporarily disabled during AWS migration'
  };
}

export async function completeSession(params: CompleteSessionParams): Promise<{ success: boolean; data?: any; error?: string }> {
  // TODO: Implement AWS Lambda endpoint for Five Whys session completion
  return {
    success: false,
    error: 'Five Whys service is temporarily disabled during AWS migration'
  };
}

export async function chatFiveWhys(params: ChatFiveWhysParams): Promise<ChatFiveWhysResponse> {
  // TODO: Implement AWS Lambda endpoint for Five Whys AI chat
  return {
    success: false,
    error: 'Five Whys service is temporarily disabled during AWS migration'
  };
}

