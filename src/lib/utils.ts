import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function sanitizeRichText(text?: string | null): string | null {
  if (!text) return null;
  
  // Try to use DOMParser for better HTML parsing (client-side)
  let strippedText: string;
  if (typeof window !== 'undefined' && window.DOMParser) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      strippedText = doc.body.textContent || doc.body.innerText || '';
    } catch {
      // Fallback to regex if DOMParser fails
      strippedText = text.replace(/<[^>]*>/g, '');
    }
  } else {
    // Server-side or fallback: use regex
    strippedText = text.replace(/<[^>]*>/g, '');
  }
  
  // Clean up various whitespace and entities
  strippedText = strippedText
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-zA-Z0-9#]+;/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width spaces
    .trim();
  
  return strippedText.length > 0 ? text : null;
}

export function hasActualContent(text?: string | null): boolean {
  return sanitizeRichText(text) !== null;
}

export interface ActionBorderStyle {
  bgColor: string;
  borderColor: string;
  textColor: string;
}

/**
 * Get consistent border styling for actions based on their state
 * Priority: Completed > Implementation > Policy (with commitment) > Assigned > Default
 */
export function getActionBorderStyle(action: {
  status: string;
  policy?: string | null;
  observations?: string | null;
  assigned_to?: string | null;
  plan_commitment?: boolean | null;
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
  
  // Yellow border when there's implementation text (work in progress) - takes priority over policy
  if (hasObservations) {
    return {
      bgColor: 'bg-background',
      borderColor: 'border-yellow-500 border-2 shadow-yellow-200 shadow-lg dark:border-yellow-600 dark:shadow-yellow-900',
      textColor: 'text-foreground'
    };
  }
  
  // Blue border when there's a policy AND plan commitment (ready to work)
  if (hasPolicy && action.plan_commitment === true) {
    return {
      bgColor: '',
      borderColor: 'border-blue-500 border-2 shadow-blue-200 shadow-lg dark:border-blue-600 dark:shadow-blue-900',
      textColor: ''
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
  
  // Default styling (same as other cards like stock/tools)
  return {
    bgColor: '',
    borderColor: '',
    textColor: ''
  };
}
