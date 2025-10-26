import { WorkflowStage } from '@/hooks/useFiveWhysAgent';

export interface TestResult {
  pass: boolean;
  message: string;
  details?: any;
}

export function assertStageEquals(expected: WorkflowStage, actual: WorkflowStage): TestResult {
  const pass = expected === actual;
  return {
    pass,
    message: pass ? `Stage is ${actual}` : `Expected stage ${expected}, got ${actual}`,
    details: { expected, actual },
  };
}

export function assertResponseMatchesPattern(
  response: string,
  pattern: RegExp
): TestResult {
  const pass = pattern.test(response);
  return {
    pass,
    message: pass
      ? 'Response matches expected pattern'
      : `Response does not match pattern ${pattern}. Got: "${response.substring(0, 100)}..."`,
    details: { pattern: pattern.toString(), response: response.substring(0, 200) },
  };
}

export function assertWhyCountEquals(expected: number, actual: number): TestResult {
  const pass = expected === actual;
  return {
    pass,
    message: pass
      ? `Why count is ${actual}`
      : `Expected why count ${expected}, got ${actual}`,
    details: { expected, actual },
  };
}

export function assertHasNumberedOptions(response: string, count: number): TestResult {
  // Check for numbered options 1. 2. 3. etc
  const optionPattern = /^\d+\.\s+/gm;
  const matches = response.match(optionPattern);
  const pass = matches ? matches.length >= count : false;
  return {
    pass,
    message: pass
      ? `Found ${matches?.length || 0} numbered options`
      : `Expected at least ${count} numbered options, found ${matches?.length || 0}`,
    details: { expected: count, found: matches?.length || 0 },
  };
}

export function assertWhyNumberInResponse(response: string, number: number): TestResult {
  const pattern = new RegExp(`Why #${number}:`, 'i');
  const pass = pattern.test(response);
  return {
    pass,
    message: pass
      ? `Found "Why #${number}:" in response`
      : `Expected "Why #${number}:" in response, got: "${response.substring(0, 100)}..."`,
    details: { expectedNumber: number, response: response.substring(0, 200) },
  };
}

export function assertNoMultipleWhyQuestions(response: string): TestResult {
  // Check if response contains multiple "Why #X:" patterns
  const whyMatches = response.match(/Why #\d+:/gi);
  const pass = !whyMatches || whyMatches.length === 1;
  return {
    pass,
    message: pass
      ? 'Response contains exactly one why question'
      : `Found ${whyMatches?.length || 0} why questions in single response (expected 1)`,
    details: { foundQuestions: whyMatches?.length || 0 },
  };
}

export function assertTransitionOccurred(
  from: WorkflowStage,
  to: WorkflowStage,
  beforeStage: WorkflowStage,
  afterStage: WorkflowStage
): TestResult {
  const pass = beforeStage === from && afterStage === to;
  return {
    pass,
    message: pass
      ? `Transitioned from ${from} to ${to}`
      : `Expected transition from ${from} to ${to}, but was ${beforeStage} -> ${afterStage}`,
    details: { expectedFrom: from, expectedTo: to, actualFrom: beforeStage, actualTo: afterStage },
  };
}

export function logConversation(exchange: {
  userMessage: string;
  aiResponse: string;
  stage: WorkflowStage;
  whyCount: number;
}): void {
  console.log(`
  User: ${exchange.userMessage}
  AI: ${exchange.aiResponse.substring(0, 150)}...
  Stage: ${exchange.stage}
  Why Count: ${exchange.whyCount}
  `);
}

