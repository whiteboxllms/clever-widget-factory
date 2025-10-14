/**
 * Utility functions for generating URLs in the application
 */

/**
 * Generate a shareable URL for an action
 * @param actionId - The ID of the action
 * @param baseUrl - Optional base URL, defaults to window.location.origin
 * @returns The full URL to the action
 */
export function generateActionUrl(actionId: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/actions/${actionId}`;
}

/**
 * Generate a shareable URL for a mission
 * @param missionId - The ID of the mission
 * @param baseUrl - Optional base URL, defaults to window.location.origin
 * @returns The full URL to the mission
 */
export function generateMissionUrl(missionId: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/missions/${missionId}/edit`;
}

/**
 * Generate a shareable URL for an issue
 * @param issueId - The ID of the issue
 * @param baseUrl - Optional base URL, defaults to window.location.origin
 * @returns The full URL to the issue
 */
export function generateIssueUrl(issueId: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/issues/${issueId}`;
}

/**
 * Copy text to clipboard with error handling
 * @param text - The text to copy
 * @returns Promise that resolves to true if successful, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
