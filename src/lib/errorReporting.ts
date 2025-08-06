interface ErrorDetails {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  timestamp: string;
  context?: Record<string, any>;
  userAgent: string;
}

export function createErrorReport(error: any, context?: Record<string, any>): ErrorDetails {
  return {
    message: error?.message || 'Unknown error',
    code: error?.code || 'UNKNOWN',
    details: error?.details || null,
    hint: error?.hint || null,
    timestamp: new Date().toISOString(),
    context: context || {},
    userAgent: navigator.userAgent,
  };
}

export function formatErrorForUser(errorDetails: ErrorDetails): string {
  const lines = [
    `Error Code: ${errorDetails.code}`,
    `Message: ${errorDetails.message}`,
  ];

  if (errorDetails.details) {
    lines.push(`Details: ${errorDetails.details}`);
  }

  if (errorDetails.hint) {
    lines.push(`Hint: ${errorDetails.hint}`);
  }

  lines.push(`Timestamp: ${errorDetails.timestamp}`);

  if (errorDetails.context && Object.keys(errorDetails.context).length > 0) {
    lines.push(`Context: ${JSON.stringify(errorDetails.context, null, 2)}`);
  }

  lines.push(`Browser: ${errorDetails.userAgent}`);

  return lines.join('\n');
}

export function getUserFriendlyMessage(error: any): string {
  const code = error?.code;
  const message = error?.message?.toLowerCase() || '';

  // Database schema issues
  if (code === 'PGRST204' || message.includes('column') || message.includes('schema')) {
    return "Database schema issue detected. This needs developer attention.";
  }

  // Network issues
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return "Network connection issue. Please check your internet and try again.";
  }

  // Upload issues
  if (message.includes('upload') || message.includes('storage')) {
    return "File upload failed. Please try again or contact support.";
  }

  // Authentication issues
  if (code === 'PGRST301' || message.includes('auth') || message.includes('unauthorized')) {
    return "Authentication issue. Please refresh the page and try again.";
  }

  // Permission issues
  if (code === 'PGRST116' || message.includes('permission') || message.includes('policy')) {
    return "Permission error. You may not have access to perform this action.";
  }

  // Validation issues
  if (message.includes('constraint') || message.includes('validation') || message.includes('required')) {
    return "Data validation error. Please check your input and try again.";
  }

  // Generic fallback
  return "We encountered a technical issue. Please try again or contact support if the problem persists.";
}

export function storeErrorForReporting(errorDetails: ErrorDetails, key: string = 'lastError') {
  try {
    localStorage.setItem(key, JSON.stringify(errorDetails));
  } catch (e) {
    console.warn('Could not store error details in localStorage:', e);
  }
}

export function getStoredError(key: string = 'lastError'): ErrorDetails | null {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.warn('Could not retrieve stored error details:', e);
    return null;
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    console.warn('Could not copy to clipboard:', e);
    return false;
  }
}