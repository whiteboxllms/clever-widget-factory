// Unified Action Types - Single source of truth for all action interfaces

export interface BaseAction {
  id: string;
  title: string;
  description?: string;
  policy?: string;
  status: string;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  
  // Exploration flag - authoritative indicator
  is_exploration?: boolean;
  
  // Exploration-related fields (logical field mappings)
  state_text?: string; // Maps to description field
  policy_text?: string; // Maps to policy field
  summary_policy_text?: string; // New field for per-action synthesis
  policy_id?: number; // Foreign key to policy table
  
  // Parent relationship fields - only one should be set
  mission_id?: string | null;
  asset_id?: string | null;
  linked_issue_id?: string | null;
  
  // Additional optional fields
  required_tools?: string[];
  required_tool_serial_numbers?: string[];
  required_stock?: { part_id: string; quantity: number; part_name: string; }[];
  attachments?: string[];
  issue_reference?: string | null;
  scoring_data?: any;
  plan_commitment?: boolean | null;
  policy_agreed_at?: string | null;
  policy_agreed_by?: string | null;
  participants?: string[];
  implementation_update_count?: number;
  
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
  state_text: '', // Logical field mapping
  policy: '',
  policy_text: '', // Logical field mapping
  summary_policy_text: '',
  assigned_to: null,
  participants: [],
  required_tools: [],
  required_stock: [],
  attachments: []
});

export const createIssueAction = (
  issueId: string, 
  issueDescription?: string, 
  toolId?: string
): Partial<BaseAction> => ({
  linked_issue_id: issueId,
  status: 'not_started',
  title: '',
  description: issueDescription || '',
  state_text: issueDescription || '', // Logical field mapping
  policy: '',
  policy_text: '', // Logical field mapping
  summary_policy_text: '',
  assigned_to: null,
  participants: [],
  required_tools: toolId ? [toolId] : [],
  required_stock: [],
  attachments: [],
  issue_reference: issueDescription ? `Issue: ${issueDescription.split('\n')[0]}` : null
});

export const createAssetAction = (assetId: string): Partial<BaseAction> => ({
  asset_id: assetId,
  status: 'not_started',
  title: '',
  description: '',
  state_text: '', // Logical field mapping
  policy: '',
  policy_text: '', // Logical field mapping
  summary_policy_text: '',
  assigned_to: null,
  participants: [],
  required_tools: [],
  required_stock: [],
  attachments: []
});

export const createExplorationAction = (): Partial<BaseAction> => ({
  status: 'not_started',
  title: '',
  description: '',
  state_text: '', // What situation/problem/context are you exploring?
  policy: '',
  policy_text: '', // What policy/best practice are you following?
  summary_policy_text: '', // AI-assisted synthesis of how this should be done
  assigned_to: null,
  participants: [],
  required_tools: [],
  required_stock: [],
  attachments: [],
  is_exploration: true // Mark as exploration
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
  update_type?: string; // 'progress' for observations, other types for different update categories
  created_at: string;
  updated_by_profile?: {
    full_name: string;
    user_id: string;
    favorite_color?: string | null;
  };
}

export interface Exploration {
  id: number;
  action_id: string;
  exploration_code: string;
  exploration_notes_text?: string;
  metrics_text?: string;
  public_flag: boolean;
  created_at: string;
  updated_at: string;
}