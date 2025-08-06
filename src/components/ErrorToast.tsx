import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  createErrorReport, 
  formatErrorForUser, 
  getUserFriendlyMessage, 
  storeErrorForReporting,
  copyToClipboard 
} from '@/lib/errorReporting';

interface ErrorToastProps {
  error: any;
  context?: Record<string, any>;
  title?: string;
  storageKey?: string;
}

export function showErrorToast({
  error,
  context,
  title = "Error Occurred",
  storageKey = 'lastError'
}: ErrorToastProps) {
  const { toast } = useToast();

  // Create detailed error report
  const errorDetails = createErrorReport(error, context);
  const technicalDetails = formatErrorForUser(errorDetails);
  const userMessage = getUserFriendlyMessage(error);

  // Store for potential reporting
  storeErrorForReporting(errorDetails, storageKey);

  toast({
    title,
    description: (
      <div className="space-y-3">
        <p className="text-sm">{userMessage}</p>
        
        <details className="text-xs">
          <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
            View technical details (for reporting)
          </summary>
          <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded border text-xs overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
            {technicalDetails}
          </pre>
        </details>
        
        <div className="flex gap-2">
          <button
            onClick={async () => {
              const success = await copyToClipboard(technicalDetails);
              toast({
                title: success ? "Copied!" : "Copy Failed",
                description: success 
                  ? "Technical details copied to clipboard" 
                  : "Could not copy to clipboard. Please select and copy manually.",
                duration: 2000,
              });
            }}
            className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition-colors"
          >
            Copy Details
          </button>
          
          <button
            onClick={() => {
              const subject = encodeURIComponent(`Error Report: ${errorDetails.code}`);
              const body = encodeURIComponent(`
Please describe what you were doing when this error occurred:

[Describe your actions here]

Technical Details:
${technicalDetails}
              `.trim());
              
              window.open(`mailto:support@example.com?subject=${subject}&body=${body}`);
            }}
            className="text-xs bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 transition-colors"
          >
            Email Support
          </button>
        </div>
      </div>
    ),
    variant: "destructive",
    duration: 12000, // Show longer for complex errors
  });
}

// Hook for easier usage
export function useErrorToast() {
  return { showErrorToast };
}