import { supabase } from '@/integrations/supabase/client';

// Simplified interfaces for essential fields only
export interface Action {
  id: string;
  title: string;
  description?: string;
  policy?: string;
  observations?: string;
  completed_at?: string;
  assigned_to?: string;
  participants?: string[];
  attachments?: string[];
}

export interface ImplementationUpdate {
  id: string;
  action_id: string;
  update_text: string;
  created_at: string;
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
}

export interface Tool {
  id: string;
  name: string;
  description?: string;
  category?: string;
  created_at: string;
}

export interface Part {
  id: string;
  name: string;
  description?: string;
  current_quantity: number;
  unit?: string;
  created_at: string;
}

export interface PartsHistory {
  id: string;
  part_id: string;
  change_type: string;
  old_quantity: number;
  new_quantity: number;
  change_reason?: string;
  created_at: string;
}

export interface ActionScore {
  id: string;
  action_id: string;
  ai_response?: any;
  created_at: string;
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
 * that can be transformed into AI prompts. Includes implementation updates created in the date range,
 * regardless of when the associated action was completed.
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
  
  // 1. Completed Actions (essential fields only)
  let actionsCompleted: Action[] = [];
  try {
    const { data, error } = await supabase
      .from('actions')
      .select('id, title, description, policy, observations, completed_at, assigned_to, participants, attachments')
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
  
  // 2. Issues Created (essential fields only)
  let issuesCreated: Issue[] = [];
  try {
    const { data, error } = await supabase
      .from('issues')
      .select('id, description, issue_type, status, reported_at, reported_by')
      .gte('reported_at', dateStart)
      .lte('reported_at', dateEnd + 'T23:59:59')
      .order('reported_at', { ascending: false });
      
    if (error) throw error;
    issuesCreated = data || [];
  } catch (error) {
    errors.push({ query: 'issues_created', error: error.message });
    partialData = true;
  }
  
  // 3. Issues Resolved (essential fields only)
  let issuesResolved: Issue[] = [];
  try {
    const { data, error } = await supabase
      .from('issues')
      .select('id, description, issue_type, status, reported_at, reported_by')
      .eq('status', 'resolved')
      .gte('updated_at', dateStart)
      .lte('updated_at', dateEnd + 'T23:59:59')
      .order('updated_at', { ascending: false });
      
    if (error) throw error;
    issuesResolved = data || [];
  } catch (error: any) {
    errors.push({ query: 'issues_resolved', error: error.message });
    partialData = true;
  }
  
  // 4. New Tools/Assets Added (essential fields only)
  let assetsAdded: Tool[] = [];
  try {
    const { data, error } = await supabase
      .from('tools')
      .select('id, name, description, category, created_at')
      .gte('created_at', dateStart)
      .lte('created_at', dateEnd + 'T23:59:59')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    assetsAdded = data || [];
  } catch (error) {
    errors.push({ query: 'assets_added', error: error.message });
    partialData = true;
  }
  
  // 5. New Stock/Parts Added (essential fields only)
  let stockAdded: Part[] = [];
  try {
    const { data, error } = await supabase
      .from('parts')
      .select('id, name, description, current_quantity, unit, created_at')
      .gte('created_at', dateStart)
      .lte('created_at', dateEnd + 'T23:59:59')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    stockAdded = data || [];
  } catch (error) {
    errors.push({ query: 'stock_added', error: error.message });
    partialData = true;
  }
  
  // 6. Stock Changes (essential fields only)
  let stockChanges: PartsHistory[] = [];
  try {
    const { data, error } = await supabase
      .from('parts_history')
      .select('id, part_id, change_type, old_quantity, new_quantity, change_reason, created_at')
      .gte('created_at', dateStart)
      .lte('created_at', dateEnd + 'T23:59:59')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    stockChanges = data || [];
  } catch (error) {
    errors.push({ query: 'stock_changes', error: error.message });
    partialData = true;
  }
  
  // 7. Implementation Updates (essential fields only)
  let implementationUpdates: ImplementationUpdate[] = [];
  try {
    const { data, error } = await supabase
      .from('action_implementation_updates')
      .select('id, action_id, update_text, created_at')
      .gte('created_at', dateStart)
      .lte('created_at', dateEnd + 'T23:59:59')
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    implementationUpdates = data || [];
  } catch (error: any) {
    errors.push({ query: 'implementation_updates', error: error.message });
    partialData = true;
  }

  // 8. Action Scores (essential fields only)
  let actionScores: ActionScore[] = [];
  try {
    const actionIds = actionsCompleted.map(action => action.id);
    if (actionIds.length > 0) {
      const { data, error } = await supabase
        .from('action_scores')
        .select('id, action_id, ai_response, created_at')
        .in('action_id', actionIds)
        .order('created_at', { ascending: false });
        
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
