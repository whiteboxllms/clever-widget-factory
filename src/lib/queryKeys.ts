export const actionsQueryKey = () => ['actions'];

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

