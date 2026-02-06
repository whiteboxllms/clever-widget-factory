export const actionsQueryKey = () => ['actions'];
export const actionQueryKey = (actionId: string) => ['action', actionId];
export const actionImplementationUpdatesQueryKey = (actionId: string) => ['action_implementation_updates', actionId];

// Exploration query keys
export const explorationsQueryKey = () => ['explorations'];
export const explorationQueryKey = (explorationId: number) => ['exploration', explorationId];
export const explorationByActionIdQueryKey = (actionId: string) => ['exploration_by_action', actionId];

export const toolsQueryKey = () => ['tools'];

export const checkoutsQueryKey = (isReturned?: boolean) => [
  'checkouts',
  isReturned === false ? 'active' : isReturned === true ? 'returned' : 'all'
];

export const actionScoresQueryKey = (start?: string, end?: string) => [
  'action_scores',
  start ?? 'all',
  end ?? 'all',
];

export const proactiveReactiveQueryKey = (start?: string, end?: string) => [
  'proactiveReactive',
  start ?? 'all',
  end ?? 'all',
];

// Issues query keys
export interface IssuesQueryFilters {
  contextType?: string;
  contextId?: string;
  status?: string;
}

export const issuesQueryKey = (filters: IssuesQueryFilters = {}) => [
  'issues',
  filters.contextType ?? 'all',
  filters.contextId ?? 'all',
  filters.status ?? 'all',
];

// Issue-specific query keys
export const issueScoreQueryKey = (issueId: string) => ['issue_score', issueId];

export const issueActionsQueryKey = (issueId: string) => ['issue_actions', issueId];

// Missions query keys
export const missionsQueryKey = () => ['missions'];

export const missionQueryKey = (missionId: string) => ['mission', missionId];

// Parts orders query key
export const partsOrdersQueryKey = (status?: string) => [
  'parts_orders',
  status ?? 'all'
];

// Observations query keys
export const observationsQueryKey = () => ['observations'];
export const observationQueryKey = (observationId: string) => ['observation', observationId];

// States query keys (with entity filtering)
export const statesQueryKey = (filters?: { entity_type?: string; entity_id?: string }) => 
  filters ? ['states', filters.entity_type ?? 'all', filters.entity_id ?? 'all'] : ['states'];
export const stateQueryKey = (stateId: string) => ['state', stateId];


