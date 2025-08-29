// Generic Issue Types - Single source of truth for all issue interfaces

export type ContextType = 'tool' | 'order' | 'inventory' | 'facility';

export interface BaseIssue {
  id: string;
  context_type: ContextType;
  context_id: string;
  description: string;
  issue_type: string;
  status: 'active' | 'resolved' | 'removed';
  reported_by: string;
  reported_at: string;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  
  // Workflow fields
  workflow_status: 'reported' | 'diagnosed' | 'in_progress' | 'completed';
  action_required?: 'repair' | 'replace_part' | 'not_fixable' | 'remove';
  diagnosed_by?: string;
  diagnosed_at?: string;
  assigned_to?: string;
  ready_to_work?: boolean;
  
  // Progress tracking
  estimated_hours?: number;
  actual_hours?: number;
  work_progress?: string;
  next_steps?: string;
  
  // Resolution
  root_cause?: string;
  resolution_notes?: string;
  resolution_photo_urls?: string[];
  
  // Metadata
  issue_metadata?: any;
  report_photo_urls?: string[];
  ai_analysis?: string;
  materials_needed?: any[];
  can_self_claim?: boolean;
  
  // Legacy fields for tool issues
  is_misuse?: boolean;
  related_checkout_id?: string;
  responsibility_assigned?: boolean;
  efficiency_loss_percentage?: number;
  damage_assessment?: string;
}

// Tool-specific issue types
export interface ToolIssue extends BaseIssue {
  context_type: 'tool';
  issue_type: 'safety' | 'efficiency' | 'cosmetic' | 'preventative_maintenance' | 'functionality' | 'lifespan';
}

// Order-specific issue types
export interface OrderIssue extends BaseIssue {
  context_type: 'order';
  issue_type: 'wrong_item' | 'wrong_brand_spec' | 'short_shipment' | 'damaged_goods' | 'over_shipped' | 'other';
  issue_metadata: {
    expected_quantity?: number;
    actual_quantity_received?: number;
    supplier_name?: string;
    order_number?: string;
  };
}

// Context-specific metadata interfaces
export interface OrderIssueMetadata {
  expected_quantity: number;
  actual_quantity_received: number;
  supplier_name?: string;
  order_number?: string;
}

// Issue creation helpers
export const createToolIssue = (toolId: string, description: string): Partial<ToolIssue> => ({
  context_type: 'tool',
  context_id: toolId,
  description,
  issue_type: 'efficiency',
  status: 'active',
  workflow_status: 'reported',
  issue_metadata: {}
});

export const createOrderIssue = (
  orderId: string, 
  description: string,
  metadata: OrderIssueMetadata
): Partial<OrderIssue> => ({
  context_type: 'order',
  context_id: orderId,
  description,
  issue_type: 'other',
  status: 'active',
  workflow_status: 'reported',
  issue_metadata: metadata
});

// Context type display helpers
export const getContextBadgeColor = (contextType: ContextType): string => {
  switch (contextType) {
    case 'tool':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'order':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'inventory':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'facility':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const getContextIcon = (contextType: ContextType): string => {
  switch (contextType) {
    case 'tool':
      return '🔧';
    case 'order':
      return '📦';
    case 'inventory':
      return '📋';
    case 'facility':
      return '🏠';
    default:
      return '❓';
  }
};

export const getContextLabel = (contextType: ContextType): string => {
  switch (contextType) {
    case 'tool':
      return 'Tool Issue';
    case 'order':
      return 'Order Issue';
    case 'inventory':
      return 'Inventory Issue';
    case 'facility':
      return 'Facility Issue';
    default:
      return 'Issue';
  }
};

// Order issue type display helpers
export const getOrderIssueTypeLabel = (issueType: string): string => {
  switch (issueType) {
    case 'wrong_item':
      return 'Wrong Item';
    case 'wrong_brand_spec':
      return 'Wrong Brand/Spec';
    case 'short_shipment':
      return 'Short Shipment';
    case 'damaged_goods':
      return 'Damaged Goods';
    case 'over_shipped':
      return 'Over-shipped';
    case 'other':
      return 'Other';
    default:
      return issueType;
  }
};