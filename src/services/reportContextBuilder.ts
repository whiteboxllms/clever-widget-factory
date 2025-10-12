import { ReportContext } from './reportDataService';

/**
 * Builds the final context JSON for AI prompts
 * This is intentionally simple - we pass through raw data and let the AI do the analysis
 */
export async function buildReportContext(
  dateStart: string,
  dateEnd: string,
  forceRebuild = false
): Promise<ReportContext> {
  // Import here to avoid circular dependencies
  const { aggregateReportContext } = await import('./reportDataService');
  
  return await aggregateReportContext(dateStart, dateEnd, forceRebuild);
}

/**
 * Generates a full prompt with context for AI
 */
export async function generateFullPrompt(
  promptText: string,
  dateStart: string,
  dateEnd: string,
  forceRebuild = false
): Promise<string> {
  const context = await buildReportContext(dateStart, dateEnd, forceRebuild);
  
  return `${promptText}\n\n${JSON.stringify(context, null, 2)}`;
}

/**
 * Adds simple metadata to context for AI understanding
 */
export function enrichContextWithMetadata(context: ReportContext): any {
  return {
    // Metadata for AI context
    metadata: {
      dateRange: {
        start: context.dateStart,
        end: context.dateEnd,
        dayCount: Math.ceil(
          (new Date(context.dateEnd).getTime() - new Date(context.dateStart).getTime()) / (1000 * 60 * 60 * 24)
        ) + 1
      },
      totals: {
        actionsCompleted: context.actionsCompleted.length,
        issuesCreated: context.issuesCreated.length,
        issuesResolved: context.issuesResolved.length,
        assetsAdded: context.assetsAdded.length,
        stockAdded: context.stockAdded.length,
        stockChanges: context.stockChanges.length,
        implementationUpdates: context.implementationUpdates.length
      },
      hasErrors: context._partialData || false,
      errorCount: context._errors?.length || 0
    },
    
    // Raw data arrays (no processing - AI does the analysis)
    actionsCompleted: context.actionsCompleted,
    issuesCreated: context.issuesCreated,
    issuesResolved: context.issuesResolved,
    assetsAdded: context.assetsAdded,
    stockAdded: context.stockAdded,
    stockChanges: context.stockChanges,
    implementationUpdates: context.implementationUpdates,
    
    // Error information for debugging
    ...(context._errors && { _errors: context._errors }),
    ...(context._partialData && { _partialData: context._partialData })
  };
}

/**
 * Generates context summary for UI display (not for AI)
 */
export function generateContextSummary(context: ReportContext): {
  dateRange: string;
  totalActivities: number;
  hasErrors: boolean;
  errorCount: number;
} {
  const totalActivities = 
    context.actionsCompleted.length +
    context.issuesCreated.length +
    context.issuesResolved.length +
    context.assetsAdded.length +
    context.stockAdded.length +
    context.stockChanges.length;
    
  return {
    dateRange: `${context.dateStart} to ${context.dateEnd}`,
    totalActivities,
    hasErrors: context._partialData || false,
    errorCount: context._errors?.length || 0
  };
}
