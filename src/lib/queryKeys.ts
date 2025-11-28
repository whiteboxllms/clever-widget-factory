export const actionsQueryKey = () => ['actions'];

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

