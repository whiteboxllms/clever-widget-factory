import { supabase } from '@/integrations/supabase/client';

// Full action type with all related data
export interface Action {
  id: string;
  title: string;
  description?: string;
  policy?: string;
  observations?: string;
  status: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  estimated_duration?: string;
  required_tools?: string[];
  required_stock?: any; // JSON field from database
  attachments?: string[];
  participants?: string[];
  plan_commitment?: boolean;
  implementation_update_count?: number;
  
  // Related objects (populated by joins)
  assignee?: {
    user_id: string;
    full_name: string;
    role: string;
  };
  participants_details?: {
    user_id: string;
    full_name: string;
    role: string;
  }[];
  mission?: {
    id: string;
    title: string;
    mission_number: number;
  };
  implementation_updates?: ImplementationUpdate[];
}

export interface ImplementationUpdate {
  id: string;
  action_id: string;
  update_text: string;
  created_at: string;
  created_by?: string;
  updated_by?: string;
  attachments?: MissionAttachment[] | null; // May be null if join fails
}

export interface MissionAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  attachment_type: string;
  mission_id?: string;
  task_id?: string;
  uploaded_by: string;
}

export interface Issue {
  id: string;
  description: string;
  issue_type: string;
  status: string;
  reported_at: string;
  reported_by: string;
  context_type: string;
  context_id: string;
  damage_assessment?: string;
  efficiency_loss_percentage?: number;
  root_cause?: string;
  resolution_notes?: string;
  
  // Related objects (may be null if join fails)
  reporter?: {
    full_name: string;
  } | null;
  context?: {
    name: string;
    category?: string;
  } | null;
}

export interface Tool {
  id: string;
  name: string;
  description?: string;
  category?: string;
  status: string;
  serial_number?: string;
  storage_location?: string;
  created_at: string;
}

export interface Part {
  id: string;
  name: string;
  description?: string;
  category?: string;
  current_quantity: number;
  unit: string;
  created_at: string;
}

export interface PartsHistory {
  id: string;
  part_id: string;
  change_type: string;
  old_quantity: number;
  new_quantity: number;
  quantity_change: number;
  changed_by: string;
  change_reason: string;
  created_at: string;
  
  // Related objects (may be null if join fails)
  part?: {
    name: string;
    unit: string;
  } | null;
}

export interface ActionScore {
  id: string;
  action_id: string;
  score: number;
  scoring_data: any;
  scored_at: string;
  scored_by: string;
  // Additional fields that exist in the actual table
  ai_response?: any;
  likely_root_causes?: string[];
  prompt_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ReportContext {
  // Metadata
  dateStart: string;
  dateEnd: string;
  
  // Full data objects (no summaries)
  actionsCompleted: Action[];
  issuesCreated: Issue[];
  issuesResolved: Issue[];
  assetsAdded: Tool[];
  stockAdded: Part[];
  stockChanges: PartsHistory[];
  implementationUpdates: ImplementationUpdate[];
  
  // Action scoring data
  actionScores: ActionScore[];
  
  // Error tracking
  _errors?: Array<{query: string, error: string}>;
  _partialData?: boolean;
}

export interface CachedReportContext {
  id: string;
  report_id: string;
  context_data: ReportContext;
  cached_at: string;
}

/**
 * Aggregates all relevant farm activities for a given date range into a structured format
 * that can be transformed into AI prompts. Focuses on implementation updates and completed actions.
 */
export async function aggregateReportContext(
  dateStart: string,
  dateEnd: string,
  forceRebuild = false
): Promise<ReportContext> {
  
  // Check if we already have a report for this date range
  if (!forceRebuild) {
    const cachedContext = await loadCachedContext(dateStart, dateEnd);
    if (cachedContext) {
      return cachedContext.context_data;
    }
  }
  
  // Generate fresh data
  const freshContext = await generateFreshContext(dateStart, dateEnd);
  
  // Cache it for future use
  await cacheContext(dateStart, dateEnd, freshContext);
  
  return freshContext;
}

/**
 * Generates fresh context data by querying all relevant tables
 */
async function generateFreshContext(
  dateStart: string,
  dateEnd: string
): Promise<ReportContext> {
  
  const errors: Array<{query: string, error: string}> = [];
  let partialData = false;
  
  // 1. Completed Actions (with all related data)
  let actionsCompleted: Action[] = [];
  try {
    const { data, error } = await supabase
      .from('actions')
      .select(`
        *,
        assignee:assigned_to(user_id, full_name, role),
        participants_details:participants(user_id, full_name),
        mission:mission_id(id, title, mission_number),
        implementation_updates:action_implementation_updates(
          *,
          attachments:mission_attachments(*)
        )
      `)
      .eq('status', 'completed')
      .gte('completed_at', dateStart)
      .lte('completed_at', dateEnd + 'T23:59:59')
      .order('completed_at', { ascending: false });
      
    if (error) throw error;
    actionsCompleted = data || [];
  } catch (error) {
    errors.push({ query: 'actions_completed', error: error.message });
    partialData = true;
  }
  
  // 2. Issues Created
  let issuesCreated: Issue[] = [];
  try {
    const { data, error } = await supabase
      .from('issues')
      .select(`
        *,
        reporter:reported_by(full_name),
        context:context_id(name, category)
      `)
      .gte('reported_at', dateStart)
      .lte('reported_at', dateEnd + 'T23:59:59')
      .order('reported_at', { ascending: false });
      
    if (error) throw error;
    issuesCreated = data || [];
  } catch (error) {
    errors.push({ query: 'issues_created', error: error.message });
    partialData = true;
  }
  
  // 3. Issues Resolved (status changed to resolved)
  let issuesResolved: Issue[] = [];
  try {
    const { data, error } = await supabase
      .from('issue_history')
      .select(`
        *,
        issue:issue_id(
          *,
          reporter:reported_by(full_name),
          context:context_id(name, category)
        )
      `)
      .eq('new_status', 'resolved')
      .gte('changed_at', dateStart)
      .lte('changed_at', dateEnd + 'T23:59:59')
      .order('changed_at', { ascending: false });
      
    if (error) throw error;
    issuesResolved = data?.map(history => history.issue).filter(Boolean) || [];
  } catch (error) {
    errors.push({ query: 'issues_resolved', error: error.message });
    partialData = true;
  }
  
  // 4. New Tools/Assets Added
  let assetsAdded: Tool[] = [];
  try {
    const { data, error } = await supabase
      .from('tools')
      .select('*')
      .gte('created_at', dateStart)
      .lte('created_at', dateEnd + 'T23:59:59')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    assetsAdded = data || [];
  } catch (error) {
    errors.push({ query: 'assets_added', error: error.message });
    partialData = true;
  }
  
  // 5. New Stock/Parts Added
  let stockAdded: Part[] = [];
  try {
    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .gte('created_at', dateStart)
      .lte('created_at', dateEnd + 'T23:59:59')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    stockAdded = data || [];
  } catch (error) {
    errors.push({ query: 'stock_added', error: error.message });
    partialData = true;
  }
  
  // 6. Stock Changes (parts_history)
  let stockChanges: PartsHistory[] = [];
  try {
    const { data, error } = await supabase
      .from('parts_history')
      .select(`
        *,
        part:part_id(name, unit)
      `)
      .gte('created_at', dateStart)
      .lte('created_at', dateEnd + 'T23:59:59')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    stockChanges = data || [];
  } catch (error) {
    errors.push({ query: 'stock_changes', error: error.message });
    partialData = true;
  }
  
  // 7. Implementation Updates (from completed actions)
  let implementationUpdates: ImplementationUpdate[] = [];
  try {
    const actionIds = actionsCompleted.map(action => action.id);
    if (actionIds.length > 0) {
      const { data, error } = await supabase
        .from('action_implementation_updates')
        .select(`
          *,
          attachments:mission_attachments(*)
        `)
        .in('action_id', actionIds)
        .gte('created_at', dateStart)
        .lte('created_at', dateEnd + 'T23:59:59')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      implementationUpdates = data || [];
    }
  } catch (error) {
    errors.push({ query: 'implementation_updates', error: error.message });
    partialData = true;
  }

  // 8. Action Scores (for completed actions)
  let actionScores: ActionScore[] = [];
  try {
    const actionIds = actionsCompleted.map(action => action.id);
    if (actionIds.length > 0) {
      const { data, error } = await supabase
        .from('action_scores')
        .select('*')
        .in('action_id', actionIds)
        .order('scored_at', { ascending: false });
        
      if (error) throw error;
      actionScores = data || [];
    }
  } catch (error) {
    errors.push({ query: 'action_scores', error: error.message });
    partialData = true;
  }
  
  return {
    dateStart,
    dateEnd,
    actionsCompleted,
    issuesCreated,
    issuesResolved,
    assetsAdded,
    stockAdded,
    stockChanges,
    implementationUpdates,
    actionScores,
    _errors: errors,
    _partialData: partialData
  };
}

/**
 * Loads cached context if available
 */
async function loadCachedContext(
  dateStart: string,
  dateEnd: string
): Promise<CachedReportContext | null> {
  // TODO: Implement caching once Supabase types are updated
  return null;
}

/**
 * Caches context data for future use
 */
async function cacheContext(
  dateStart: string,
  dateEnd: string,
  context: ReportContext
): Promise<void> {
  // TODO: Implement caching once Supabase types are updated
  console.log('Caching context:', { dateStart, dateEnd, context });
}

/**
 * Builds the final context JSON for AI prompts
 */
export async function buildReportContext(
  dateStart: string,
  dateEnd: string,
  forceRebuild = false
): Promise<ReportContext> {
  return await aggregateReportContext(dateStart, dateEnd, forceRebuild);
}

/**
 * Generates a full prompt with context for AI
 */
export async function generateFullPrompt(
  promptText: string,
  dateStart: string,
  dateEnd: string,
  forceRebuild = false
): Promise<string> {
  const context = await buildReportContext(dateStart, dateEnd, forceRebuild);
  
  return `${promptText}\n\n${JSON.stringify(context, null, 2)}`;
}
