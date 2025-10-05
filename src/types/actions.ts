// Unified Action Types - Single source of truth for all action interfaces

export interface BaseAction {
  id: string;
  title: string;
  description?: string;
  policy?: string;
  observations?: string;
  status: string;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  
  // Parent relationship fields - only one should be set
  mission_id?: string | null;
  asset_id?: string | null;
  linked_issue_id?: string | null;
  
  // Additional optional fields
  estimated_duration?: string | null;
  estimated_completion_date?: string | null;
  required_tools?: string[];
  required_stock?: { part_id: string; quantity: number; part_name: string; }[];
  attachments?: string[];
  issue_reference?: string | null;
  score?: number | null;
  scoring_data?: any;
  plan_commitment?: boolean | null;
  participants?: string[];
  
  // Related objects (populated by joins)
  assignee?: {
    id: string;
    user_id: string;
    full_name: string;
    role: string;
  } | null;
  participants_details?: {
    id: string;
    user_id: string;
    full_name: string;
    role: string;
  }[];
  mission?: {
    id: string;
    title: string;
    mission_number: number;
    status: string;
  } | null;
  asset?: {
    id: string;
    name: string;
    category?: string;
  } | null;
  issue_tool?: {
    id: string;
    name: string;
    description?: string;
  } | null;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: string;
}

export interface ActionCreationContext {
  type: 'mission' | 'issue' | 'asset';
  parentId?: string;
  parentTitle?: string;
  prefilledData?: Partial<BaseAction>;
}

// Helper functions for creating context-specific actions
export const createMissionAction = (missionId: string): Partial<BaseAction> => ({
  mission_id: missionId,
  status: 'not_started',
  title: '',
  description: '',
  policy: '',
  observations: '',
  assigned_to: null,
  participants: [],
  required_tools: [],
  required_stock: [],
  attachments: []
});

export const createIssueAction = (issueId: string, issueDescription?: string): Partial<BaseAction> => ({
  linked_issue_id: issueId,
  status: 'not_started',
  title: '',
  description: '',
  policy: '',
  observations: '',
  assigned_to: null,
  participants: [],
  required_tools: [],
  required_stock: [],
  attachments: [],
  issue_reference: issueDescription ? `Issue: ${issueDescription}` : null
});

export const createAssetAction = (assetId: string): Partial<BaseAction> => ({
  asset_id: assetId,
  status: 'not_started',
  title: '',
  description: '',
  policy: '',
  observations: '',
  assigned_to: null,
  participants: [],
  required_tools: [],
  required_stock: [],
  attachments: []
});

// Validation helpers
export const validateActionRelationship = (action: Partial<BaseAction>): boolean => {
  const relationships = [
    action.mission_id,
    action.asset_id,
    action.linked_issue_id
  ].filter(Boolean);
  
  return relationships.length <= 1; // Exactly zero or one parent relationship
};

export const getActionTypeFromAction = (action: BaseAction): ActionCreationContext['type'] => {
  if (action.mission_id) return 'mission';
  if (action.linked_issue_id) return 'issue';
  return 'asset';
};

export interface ImplementationUpdate {
  id: string;
  action_id: string;
  updated_by: string;
  update_text: string;
  update_type: 'progress' | 'blocker' | 'question' | 'completion';
  created_at: string;
  updated_by_profile?: {
    full_name: string;
    user_id: string;
  };
}