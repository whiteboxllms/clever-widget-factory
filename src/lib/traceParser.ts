/**
 * Extract record IDs from Bedrock Agent trace events.
 * 
 * Strategy:
 * 1. First, look for <referenced_records> tag in the raw reply text or
 *    the agent's final response in the trace — this contains only the IDs
 *    the agent actually used in its analysis.
 * 2. Fall back to extracting all entity_ids from action group outputs if no
 *    referenced_records tag is found.
 */
export function extractRecordIdsFromTrace(traceEvents: any[], rawReply?: string): string[] {
  // Strategy 1: Look for <referenced_records> in the raw reply text
  if (rawReply) {
    const ids = parseReferencedRecordsTag(rawReply);
    if (ids.length > 0) return ids;
  }

  // Strategy 2: Look for <referenced_records> in the trace's final response
  const referencedIds = extractReferencedRecordIds(traceEvents);
  if (referencedIds.length > 0) return referencedIds;

  // Strategy 3: Fall back to all entity_ids from action group outputs
  return extractAllEntityIds(traceEvents);
}

function parseReferencedRecordsTag(text: string): string[] {
  const match = text.match(/<referenced_records>\s*(\[.*?\])\s*<\/referenced_records>/s);
  if (!match) return [];

  try {
    const ids = JSON.parse(match[1]);
    if (Array.isArray(ids)) {
      return ids.filter((id: any) => typeof id === 'string' && id.length > 0);
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

function extractReferencedRecordIds(traceEvents: any[]): string[] {
  for (const event of traceEvents) {
    const finalResponse = event?.trace?.orchestrationTrace?.observation?.finalResponse;
    if (!finalResponse?.text) continue;

    const ids = parseReferencedRecordsTag(finalResponse.text);
    if (ids.length > 0) return ids;
  }
  return [];
}

function extractAllEntityIds(traceEvents: any[]): string[] {
  const ids = new Set<string>();

  for (const event of traceEvents) {
    const output = event?.trace?.orchestrationTrace?.observation?.actionGroupInvocationOutput;
    if (!output) continue;

    const outputString = output.text || output.actionGroupOutputString;
    if (!outputString) continue;

    try {
      const responseBody = JSON.parse(outputString);
      const results = responseBody.results;
      if (Array.isArray(results)) {
        for (const result of results) {
          if (result.entity_id && typeof result.entity_id === 'string') {
            ids.add(result.entity_id);
          }
        }
      }
    } catch {
      continue;
    }
  }

  return Array.from(ids);
}
