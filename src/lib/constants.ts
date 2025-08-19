// Issue type options - centralized for consistency across the app  
export const ISSUE_TYPE_OPTIONS = [
  { value: 'safety' as const, label: 'Safety' },
  { value: 'efficiency' as const, label: 'Efficiency' },
  { value: 'cosmetic' as const, label: 'Cosmetic' },
  { value: 'maintenance' as const, label: 'Maintenance' }
] as const;

// Default done definition for missions and tasks
export const DEFAULT_DONE_DEFINITION = "The task is complete when the images show the full solution, work follows Stargazer SOP, reflects best practices and professionalism, and any problems encountered are documented.";