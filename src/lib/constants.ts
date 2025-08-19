import { Database } from '@/integrations/supabase/types';

// Issue type options - centralized for consistency across the app  
export const ISSUE_TYPE_OPTIONS = [
  { value: 'safety' as const, label: 'Safety' },
  { value: 'efficiency' as const, label: 'Efficiency' },
  { value: 'cosmetic' as const, label: 'Cosmetic' },
  { value: 'maintenance' as const, label: 'Maintenance' }
] as const;

// Tool condition options - simplified binary system
export const TOOL_CONDITION_OPTIONS = [
  { value: 'no_problems_observed' as const, label: 'No problems detected' },
  { value: 'functional_but_not_efficient' as const, label: 'Functional but not efficient' },
  { value: 'not_functional' as const, label: 'Not functional' }
] as const;

// Tool condition utility functions
export const getConditionColor = (condition: Database['public']['Enums']['tool_condition']) => {
  switch (condition) {
    case 'no_problems_observed': return 'bg-green-100 text-green-800';
    case 'functional_but_not_efficient': return 'bg-yellow-100 text-yellow-800';
    case 'not_functional': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const getConditionLabel = (condition: Database['public']['Enums']['tool_condition']) => {
  const option = TOOL_CONDITION_OPTIONS.find(opt => opt.value === condition);
  return option?.label || condition;
};

// Default done definition for missions and tasks
export const DEFAULT_DONE_DEFINITION = "The task is complete when the images show the full solution, work follows Stargazer SOP, reflects best practices and professionalism, and any problems encountered are documented.";