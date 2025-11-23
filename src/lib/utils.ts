import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { supabase } from '@/lib/client';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Determines if a hex color is light or dark for text contrast
 * Returns true if the color is light (use dark text), false if dark (use light text)
 */
export function isLightColor(hex: string): boolean {
  if (!hex || hex === '#6B7280') return false; // Default gray is dark
  
  // Remove # if present
  const color = hex.replace('#', '');
  
  // Convert to RGB
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  
  // Calculate relative luminance using WCAG formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return true if light (luminance > 0.5), false if dark
  return luminance > 0.5;
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
 * Progression: Gray (no border) → Blue (plan + commitment) → Yellow (implementation) → Green (completed)
 * Yellow can only occur if there was first a plan (blue state)
 */
export function getActionBorderStyle(action: {
  status: string;
  title?: string;
  policy?: string | null;
  assigned_to?: string | null;
  policy_agreed_at?: string | null;
  policy_agreed_by?: string | null;
  plan_commitment?: boolean;
  implementation_update_count?: number;
}): ActionBorderStyle {
  const hasPolicy = hasActualContent(action.policy);
  const hasImplementationUpdates = (action.implementation_update_count ?? 0) > 0;
  const isAssigned = Boolean(action.assigned_to);
  const hasPolicyAgreement = Boolean(action.policy_agreed_at || action.plan_commitment);

  // Green border for completed actions
  if (action.status === 'completed') {
    return {
      bgColor: '',
      borderColor: 'border-emerald-500 border-2 shadow-emerald-200 shadow-lg dark:border-emerald-600 dark:shadow-emerald-900',
      textColor: ''
    };
  }
  
  // Yellow border when there are implementation updates AND there was first a policy agreement
  // This ensures proper progression: Gray → Blue → Yellow → Green
  if (hasImplementationUpdates && hasPolicy && hasPolicyAgreement) {
    return {
      bgColor: 'bg-background',
      borderColor: 'border-yellow-500 border-2 shadow-yellow-200 shadow-lg dark:border-yellow-600 dark:shadow-yellow-900',
      textColor: 'text-foreground'
    };
  }
  
  // Blue border when there's a policy AND plan commitment (ready to work)
  if (hasPolicy && hasPolicyAgreement) {
    return {
      bgColor: '',
      borderColor: 'border-blue-500 border-2 shadow-blue-200 shadow-lg dark:border-blue-600 dark:shadow-blue-900',
      textColor: ''
    };
  }
  
  // Default styling (gray - no border) - initial state
  return {
    bgColor: '',
    borderColor: '',
    textColor: ''
  };
}

/**
 * Process stock consumption for an action when it's completed
 * This function handles decrementing stock quantities and logging usage
 */
export async function processStockConsumption(
  requiredStock: { part_id: string; quantity: number; part_name: string; }[],
  actionId: string,
  userId: string,
  actionTitle: string,
  organizationId: string,
  missionId?: string
): Promise<void> {
  if (!requiredStock || requiredStock.length === 0) {
    return; // No stock to process
  }

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  for (const stockItem of requiredStock) {
    try {
      // Get current quantity
      const fetchResponse = await fetch(`${API_BASE_URL}/parts`);
      
      if (!fetchResponse.ok) {
        throw new Error(`Failed to fetch parts: ${fetchResponse.statusText}`);
      }
      
      const fetchResult = await fetchResponse.json();
      const parts = fetchResult.data || [];
      const partData = parts.find((p: any) => p.id === stockItem.part_id);
      
      if (!partData) {
        console.error(`Part ${stockItem.part_id} not found`);
        throw new Error(`Part with ID ${stockItem.part_id} not found`);
      }

      const oldQuantity = partData.current_quantity || 0;
      const newQuantity = Math.max(0, oldQuantity - stockItem.quantity);
      
      // Update part quantity
      const updateResponse = await fetch(`${API_BASE_URL}/parts/${stockItem.part_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_quantity: newQuantity })
      });

      if (!updateResponse.ok) {
        const error = await updateResponse.json();
        throw new Error(`Failed to update part: ${error.error || updateResponse.statusText}`);
      }

      // Log to parts_history table
      const historyResponse = await fetch(`${API_BASE_URL}/parts_history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          part_id: stockItem.part_id,
          change_type: 'quantity_remove',
          old_quantity: oldQuantity,
          new_quantity: newQuantity,
          quantity_change: -stockItem.quantity,
          changed_by: userId,
          change_reason: `Used for action: ${actionTitle} - ${stockItem.quantity} ${stockItem.part_name}`,
          action_id: actionId, // Link to the action for auditability
        })
      });

      if (!historyResponse.ok) {
        const error = await historyResponse.json();
        console.error('Error creating parts history:', error);
        // Don't throw - the main operation succeeded
      }
    } catch (error) {
      console.error(`Error processing stock item ${stockItem.part_id}:`, error);
      throw error;
    }
  }
}
