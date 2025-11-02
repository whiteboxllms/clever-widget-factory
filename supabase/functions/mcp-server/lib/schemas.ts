import { z } from 'zod';

// Common schemas
export const OrganizationIdSchema = z.string().uuid();
export const UserIdSchema = z.string().uuid();
export const IssueIdSchema = z.string().uuid();
export const ActionIdSchema = z.string().uuid();
export const AssetIdSchema = z.string().uuid();

// Issue management schemas
export const ListIssuesSchema = z.object({
  organization_id: OrganizationIdSchema,
  status: z.string().optional(),
  context_type: z.enum(['tool', 'order', 'inventory', 'facility']).optional(),
  assigned_to: UserIdSchema.optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  limit: z.number().min(1).max(100).default(20)
});

export const GetIssueDetailsSchema = z.object({
  issue_id: IssueIdSchema,
  organization_id: OrganizationIdSchema
});

export const CreateIssueSchema = z.object({
  organization_id: OrganizationIdSchema,
  context_id: z.string(),
  context_type: z.enum(['tool', 'order', 'inventory', 'facility']),
  description: z.string().min(1),
  reported_by: UserIdSchema,
  issue_type: z.string().optional(),
  is_misuse: z.boolean().default(false),
  report_photo_urls: z.array(z.string().url()).optional(),
  materials_needed: z.record(z.any()).optional()
});

export const UpdateIssueRootCauseSchema = z.object({
  issue_id: IssueIdSchema,
  organization_id: OrganizationIdSchema,
  root_cause: z.string().optional(),
  ai_analysis: z.string().optional(),
  next_steps: z.string().optional(),
  updated_by: UserIdSchema
});

export const UpdateIssueWorkflowSchema = z.object({
  issue_id: IssueIdSchema,
  organization_id: OrganizationIdSchema,
  workflow_status: z.enum(['reported', 'diagnosed', 'in_progress', 'completed']),
  assigned_to: UserIdSchema.optional(),
  updated_by: UserIdSchema
});

// Action management schemas
export const ListActionsSchema = z.object({
  organization_id: OrganizationIdSchema,
  status: z.string().optional(),
  assigned_to: UserIdSchema.optional(),
  asset_id: AssetIdSchema.optional(),
  mission_id: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).default(20)
});

export const GetActionDetailsSchema = z.object({
  action_id: ActionIdSchema,
  organization_id: OrganizationIdSchema
});

export const CreateActionSchema = z.object({
  organization_id: OrganizationIdSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  assigned_to: UserIdSchema.optional(),
  linked_issue_id: IssueIdSchema.optional(),
  asset_id: AssetIdSchema.optional(),
  status: z.string().default('pending'),
  required_stock: z.record(z.any()).optional(),
  required_tools: z.array(z.string()).optional(),
  estimated_duration: z.string().optional(),
  created_by: UserIdSchema
});

export const UpdateActionStatusSchema = z.object({
  action_id: ActionIdSchema,
  organization_id: OrganizationIdSchema,
  status: z.string(),
  completed_at: z.string().datetime().optional(),
  actual_duration: z.string().optional(),
  observations: z.string().optional(),
  updated_by: UserIdSchema
});

export const AddActionUpdateSchema = z.object({
  action_id: ActionIdSchema,
  organization_id: OrganizationIdSchema,
  update_text: z.string().min(1),
  update_type: z.string().default('progress'),
  updated_by: UserIdSchema
});

// Inventory schemas
export const QueryPartsInventorySchema = z.object({
  organization_id: OrganizationIdSchema,
  search_term: z.string().optional(),
  category: z.string().optional(),
  min_quantity: z.number().optional(),
  storage_vicinity: z.string().optional(),
  limit: z.number().min(1).max(100).default(20)
});

export const GetPartDetailsSchema = z.object({
  part_id: z.string().uuid(),
  organization_id: OrganizationIdSchema
});

export const CheckPartsAvailabilitySchema = z.object({
  organization_id: OrganizationIdSchema,
  required_parts: z.array(z.object({
    part_id: z.string().uuid(),
    quantity: z.number().min(1)
  }))
});

// Asset/Tool schemas
export const QueryToolsAssetsSchema = z.object({
  organization_id: OrganizationIdSchema,
  search_term: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['available', 'checked_out', 'unavailable', 'needs_attention', 'under_repair', 'removed']).optional(),
  storage_location: z.string().optional(),
  limit: z.number().min(1).max(100).default(20)
});

export const GetSopForAssetSchema = z.object({
  asset_id: AssetIdSchema,
  organization_id: OrganizationIdSchema
});

// Organization schemas
export const ListOrganizationMembersSchema = z.object({
  organization_id: OrganizationIdSchema,
  role: z.string().optional(),
  is_active: z.boolean().default(true)
});

export const GetMemberAttributesSchema = z.object({
  user_id: UserIdSchema,
  organization_id: OrganizationIdSchema
});

// Root cause analysis schemas
export const LogFiveWhysStepSchema = z.object({
  issue_id: IssueIdSchema,
  organization_id: OrganizationIdSchema,
  step_number: z.number().min(1).max(5),
  question: z.string().min(1),
  answer: z.string().min(1),
  logged_by: UserIdSchema
});

export const GetRelatedIssuesSchema = z.object({
  issue_id: IssueIdSchema,
  organization_id: OrganizationIdSchema,
  similarity_threshold: z.number().min(0).max(1).default(0.7),
  limit: z.number().min(1).max(20).default(5)
});

export const SuggestResponsiblePartySchema = z.object({
  issue_id: IssueIdSchema,
  organization_id: OrganizationIdSchema,
  context_type: z.enum(['tool', 'order', 'inventory', 'facility']),
  required_skills: z.array(z.string()).optional()
});

// Five Whys Session schemas
export const ListFiveWhysSessionsSchema = z.object({
  issue_id: IssueIdSchema,
  organization_id: OrganizationIdSchema
});

export const GetFiveWhysSessionSchema = z.object({
  session_id: z.string().uuid(),
  organization_id: OrganizationIdSchema
});

export const SaveFiveWhysSessionSchema = z.object({
  session_id: z.string().uuid().optional(),
  issue_id: IssueIdSchema,
  organization_id: OrganizationIdSchema,
  conversation_history: z.array(z.object({
    role: z.string(),
    content: z.string(),
    timestamp: z.string().optional()
  })),
  status: z.enum(['in_progress', 'completed', 'abandoned']).default('in_progress'),
  created_by: UserIdSchema
});

export const CompleteFiveWhysSessionSchema = z.object({
  session_id: z.string().uuid(),
  organization_id: OrganizationIdSchema,
  conversation_history: z.array(z.object({
    role: z.string(),
    content: z.string(),
    timestamp: z.string().optional()
  })),
  root_cause_analysis: z.string().optional(),
  created_by: UserIdSchema
});
