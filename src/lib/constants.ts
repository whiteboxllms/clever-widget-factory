import { Database } from '@/integrations/supabase/types';

// Issue type options - centralized for consistency across the app  
export const ISSUE_TYPE_OPTIONS = [
  { value: 'safety' as const, label: 'Safety' },
  { value: 'efficiency' as const, label: 'Efficiency' },
  { value: 'cosmetic' as const, label: 'Cosmetic' },
  { value: 'maintenance_due' as const, label: 'Maintenance Due' }
] as const;

// Tool condition options - simplified binary system
export const TOOL_CONDITION_OPTIONS = [
  { value: 'no_problems_observed' as const, label: 'No problems detected' },
  { value: 'functional_but_not_efficient' as const, label: 'Functional but not efficient' },
  { value: 'not_functional' as const, label: 'Not functional' }
] as const;

// Tool status utility functions
export const getStatusColor = (status: string) => {
  switch (status) {
    case 'available': return 'bg-green-100 text-green-800';
    case 'checked_out': return 'bg-yellow-100 text-yellow-800';
    case 'unavailable': return 'bg-red-100 text-red-800';
    case 'unable_to_find': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const getStatusLabel = (status: string) => {
  switch (status) {
    case 'available': return 'Available';
    case 'checked_out': return 'Checked Out';
    case 'unavailable': return 'Unavailable';
    case 'unable_to_find': return 'Unable to Find';
    default: return status;
  }
};

// Tool category options
export const TOOL_CATEGORY_OPTIONS = [
  { value: 'Hand Tools', label: 'Hand Tools' },
  { value: 'Electric Tool', label: 'Electric Tool' },
  { value: 'Combustion Engine', label: 'Combustion Engine' },
  { value: 'Vehicle', label: 'Vehicle' },
  { value: 'Recreation', label: 'Recreation' },
  { value: 'Container', label: 'Container' },
  { value: 'Structure', label: 'Structure' }
] as const;

// Default done definition for tasks only
export const DEFAULT_DONE_DEFINITION = "The task is complete when the images show the full solution, work follows Stargazer SOP, reflects best practices and professionalism, and any problems encountered are documented.";