import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function hasActualContent(text?: string): boolean {
  if (!text) return false;
  
  // Strip HTML tags and decode entities
  const strippedText = text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&[a-zA-Z0-9#]+;/g, '') // Remove other HTML entities
    .trim();
  
  return strippedText.length > 0;
}

export interface ActionBorderStyle {
  bgColor: string;
  borderColor: string;
  textColor: string;
}

/**
 * Get consistent border styling for actions based on their state
 * Priority: Completed > Policy > Implementation > Assigned > Default
 */
export function getActionBorderStyle(action: {
  status: string;
  policy?: string | null;
  observations?: string | null;
  assigned_to?: string | null;
}): ActionBorderStyle {
  const hasPolicy = hasActualContent(action.policy);
  const hasObservations = hasActualContent(action.observations);
  const isAssigned = Boolean(action.assigned_to);
  
  // Green border for completed actions
  if (action.status === 'completed') {
    return {
      bgColor: '',
      borderColor: 'border-emerald-500 border-2 shadow-emerald-200 shadow-lg dark:border-emerald-600 dark:shadow-emerald-900',
      textColor: ''
    };
  }
  
  // Blue border when there's a policy (ready to work) - takes priority over implementation
  if (hasPolicy) {
    return {
      bgColor: '',
      borderColor: 'border-blue-500 border-2 shadow-blue-200 shadow-lg dark:border-blue-600 dark:shadow-blue-900',
      textColor: ''
    };
  }
  
  // Yellow border when there's implementation text but no policy (work in progress)
  if (hasObservations) {
    return {
      bgColor: 'bg-background',
      borderColor: 'border-yellow-500 border-2 shadow-yellow-200 shadow-lg dark:border-yellow-600 dark:shadow-yellow-900',
      textColor: 'text-foreground'
    };
  }
  
  // Amber for assigned but no content
  if (isAssigned) {
    return {
      bgColor: 'bg-amber-50 dark:bg-amber-950',
      borderColor: 'border-amber-200 dark:border-amber-800',
      textColor: 'text-amber-900 dark:text-amber-100'
    };
  }
  
  // Default styling
  return {
    bgColor: 'bg-background',
    borderColor: 'border-border',
    textColor: 'text-foreground'
  };
}
