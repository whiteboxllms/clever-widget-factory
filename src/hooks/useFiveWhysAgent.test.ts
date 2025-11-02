import { describe, it, expect, beforeAll } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFiveWhysAgent } from './useFiveWhysAgent';
import { testScenarios } from '@/test-utils/testScenarios';
import {
  assertStageEquals,
  assertResponseMatchesPattern,
  assertWhyCountEquals,
  assertWhyNumberInResponse,
  assertHasNumberedOptions,
  assertNoMultipleWhyQuestions,
} from '@/test-utils/assertionHelpers';

// Set timeout for API calls
const API_TIMEOUT = 30000; // 30 seconds

describe('5 Whys Agent', () => {
  beforeAll(() => {
    // Check if API key is configured
    if (!import.meta.env.VITE_OPENROUTER_API_KEY) {
      throw new Error(
        'VITE_OPENROUTER_API_KEY not configured. Add it to .env.test file.'
      );
    }
  });

  testScenarios.forEach((scenario) => {
    describe(scenario.name, () => {
      let currentStage: string;
      let whyCount: number;

      it(scenario.description, async () => {
        const { result } = renderHook(() =>
          useFiveWhysAgent(scenario.issue, 'test-org-id')
        );

        // Initialize the session
        await act(async () => {
          await result.current.initializeSession();
        });

        // Wait for initial message
        await waitFor(() => {
          expect(result.current.messages.length).toBeGreaterThan(0);
        });

        currentStage = result.current.currentStage;
        whyCount = result.current.whyCount;

        console.log(`\n=== Testing: ${scenario.name} ===`);
        console.log(`Issue: ${scenario.issue.description}\n`);

        let exchangeIndex = 0;

        for (const exchange of scenario.exchanges) {
          console.log(`\n--- Exchange ${exchangeIndex + 1} ---`);
          console.log(`User: ${exchange.userMessage}`);

          // Send user message
          await act(async () => {
            await result.current.sendMessage(exchange.userMessage);
          });

          // Wait for AI response
          await waitFor(
            () => {
              expect(result.current.isLoading).toBe(false);
            },
            { timeout: API_TIMEOUT }
          );

          // Get the last message (AI response)
          const lastMessage = result.current.messages[result.current.messages.length - 1];
          const aiResponse = lastMessage?.content || '';

          console.log(`AI: ${aiResponse.substring(0, 150)}...`);
          console.log(`Stage: ${result.current.currentStage}`);
          console.log(`Why Count: ${result.current.whyCount}`);

          // Run assertions
          const stageResult = assertStageEquals(
            exchange.expectedNextStage,
            result.current.currentStage
          );

          console.log(
            stageResult.pass ? '✓' : '✗',
            `Stage: ${stageResult.message}`
          );

          if (exchange.expectedResponsePattern) {
            const patternResult = assertResponseMatchesPattern(
              aiResponse,
              exchange.expectedResponsePattern
            );
            console.log(
              patternResult.pass ? '✓' : '✗',
              `Pattern: ${patternResult.message}`
            );
          }

          if (exchange.expectedWhyCount !== undefined) {
            const whyCountResult = assertWhyCountEquals(
              exchange.expectedWhyCount,
              result.current.whyCount
            );
            console.log(
              whyCountResult.pass ? '✓' : '✗',
              `Why Count: ${whyCountResult.message}`
            );
          }

          // Check for "Why #X of 5" in responses when in five_whys stage
          if (result.current.currentStage === 'five_whys') {
            const whyNumberInResponse = assertWhyNumberInResponse(
              aiResponse,
              result.current.whyCount
            );
            console.log(
              whyNumberInResponse.pass ? '✓' : '✗',
              `Why Number: ${whyNumberInResponse.message}`
            );

            // Check for numbered options
            const hasOptions = assertHasNumberedOptions(aiResponse, 3);
            console.log(
              hasOptions.pass ? '✓' : '✗',
              `Options: ${hasOptions.message}`
            );

            // Ensure no multiple why questions
            const singleWhy = assertNoMultipleWhyQuestions(aiResponse);
            console.log(
              singleWhy.pass ? '✓' : '✗',
              `Single Why: ${singleWhy.message}`
            );
          }

          currentStage = result.current.currentStage;
          whyCount = result.current.whyCount;
          exchangeIndex++;

          // Add small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        console.log(`\n=== Scenario Complete ===`);
      }, API_TIMEOUT * scenario.exchanges.length);
    });
  });
});

