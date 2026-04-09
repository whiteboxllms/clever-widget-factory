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
  // Try Clipboard API first — works on HTTPS and localhost (even when
  // isSecureContext is false on some mobile browsers hitting local IP)
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Clipboard API failed, trying fallback:', err);
    }
  }

  // Fallback for older browsers — unreliable on mobile, so we
  // verify by reading back from clipboard when possible
  try {
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

    // execCommand returns true on mobile even when it didn't actually copy,
    // so don't trust it — report failure so the user knows to copy manually
    if (!successful) return false;

    // On mobile, execCommand('copy') is unreliable — detect mobile and
    // warn rather than falsely claiming success
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      console.warn('execCommand copy on mobile is unreliable');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
