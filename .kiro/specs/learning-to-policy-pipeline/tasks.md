# Implementation Plan: Learning-to-Policy Pipeline

## Overview

This plan implements the learning-to-policy pipeline — takeaway capture on the quiz complete screen, policy append, and a Copy Context button on UnifiedActionDialog. Tasks are ordered: pure utility functions first (with property tests), then QuizPage modification, then UnifiedActionDialog modification, to enable incremental testing at each layer. All new pure functions go in the existing `src/lib/learningUtils.ts`. No new database tables, Lambda endpoints, or API Gateway routes are needed.

## Tasks

- [x] 1. Add takeaway utility functions to `src/lib/learningUtils.ts`
  - [x] 1.1 Implement `composeLearningTakeawayStateText` and `parseLearningTakeawayStateText`
    - Add `ParsedLearningTakeaway` interface with `axisKey`, `actionId`, `userId`, `takeawayText` fields
    - Add `composeLearningTakeawayStateText(axisKey, actionId, userId, takeawayText)` that returns `[learning_takeaway] axis={axisKey} action={actionId} user={userId} | {takeawayText}`
    - Add `parseLearningTakeawayStateText(stateText)` that parses the format back to a `ParsedLearningTakeaway` or returns `null`
    - Follow the existing `composeLearningObjectiveStateText` / `parseLearningObjectiveStateText` pattern already in the file
    - _Requirements: 1.4, 1.5_

  - [ ]* 1.2 Write property test for takeaway state_text round trip
    - **Property 1: Takeaway state_text round trip**
    - Generate random axisKey, actionId, userId (non-empty, no whitespace) and non-empty takeawayText; compose then parse and verify all fields match originals
    - Add test to `src/lib/learningUtils.test.ts`
    - **Validates: Requirements 1.4, 1.5**

  - [x] 1.3 Implement `appendTakeawayToPolicy`
    - Add `appendTakeawayToPolicy(currentPolicy: string | null | undefined, takeawayText: string): string`
    - Add a local `escapeHtml` helper (no existing utility in the project) to escape `<`, `>`, `&`, `"`, `'` in takeaway text
    - Build takeaway HTML as `<p>📝 ${escapeHtml(takeawayText)}</p>`
    - Treat `null`, `undefined`, empty string, `<p></p>`, `<p><br></p>`, and `<p>&nbsp;</p>` as empty policy — return just the takeaway paragraph
    - Otherwise append the takeaway paragraph after the trimmed existing policy
    - _Requirements: 2.1, 2.2, 2.4_

  - [ ]* 1.4 Write property test for policy append
    - **Property 2: Policy append preserves existing content and adds takeaway**
    - Generate random non-empty policy HTML strings and non-empty takeaway text; verify result starts with original policy and contains a `<p>` with the 📝 prefix and takeaway text
    - Add test to `src/lib/learningUtils.test.ts`
    - **Validates: Requirements 2.1, 2.2**

  - [x] 1.5 Implement `stripHtmlToPlainText` and `buildCopyContextText`
    - Add `stripHtmlToPlainText(html: string): string` using `DOMParser` to strip HTML tags
    - Add `buildCopyContextText(action: { title?, description?, expected_state?, policy? }, takeaways: string[]): string`
    - Build labeled sections: "Title:", "Description:", "Expected State:", "Current Policy:" (stripped HTML), "Takeaways:" (bulleted list) — only include sections for non-empty fields
    - Omit "Takeaways:" section entirely when takeaways array is empty
    - Join sections with double newlines
    - _Requirements: 3.2, 3.3, 3.5_

  - [ ]* 1.6 Write property test for buildCopyContextText
    - **Property 3: Copy context text includes all provided fields with correct labels**
    - Generate random action objects with optional fields and random takeaway arrays; verify every non-empty field appears with its label, takeaways section appears only when non-empty, and no "Takeaways:" label when array is empty
    - Add test to `src/lib/learningUtils.test.ts`
    - **Validates: Requirements 3.2, 3.3, 3.5**

  - [ ]* 1.7 Write unit tests for edge cases
    - Test `appendTakeawayToPolicy` with `null`, empty string, `<p></p>`, `<p><br></p>`, `<p>&nbsp;</p>` — all return just the takeaway paragraph
    - Test `parseLearningTakeawayStateText` returns `null` for non-matching strings (e.g., `[learning_objective]` prefix, missing separator, empty string)
    - Test `buildCopyContextText` with all-empty action fields and empty takeaways returns empty string
    - Test `stripHtmlToPlainText` correctly strips TipTap HTML tags
    - Add tests to `src/lib/learningUtils.test.ts`
    - _Requirements: 1.4, 2.4, 3.5_

- [x] 2. Checkpoint — Verify utility functions
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Add takeaway capture to QuizPage quiz_complete screen
  - [x] 3.1 Implement takeaway capture UI and save handler in `src/pages/QuizPage.tsx`
    - Add state variables: `takeawayText` (string), `isSavingTakeaway` (boolean), `takeawaySaved` (boolean)
    - In the `quiz_complete` block, between the score summary `<div>` and the "Back to action" `<Button>`, add the Takeaway_Capture_Section:
      - Heading: "Takeaways"
      - Prompt text: "Did you come up with anything you want to incorporate into the action plan?"
      - `<Textarea>` bound to `takeawayText`
      - "Save" button disabled when `takeawayText` is empty/whitespace or `isSavingTakeaway` is true
      - Success feedback after save (e.g., brief "Saved!" indicator), then clear textarea for another entry
    - Implement `handleSaveTakeaway` async handler:
      1. Call `apiService.post('/states', { state_text: composeLearningTakeawayStateText(axisKey, actionId, userId, takeawayText), links: [{ entity_type: 'action', entity_id: actionId }] })`
      2. Read current action policy from TanStack Query cache via `queryClient.getQueryData`
      3. Call `appendTakeawayToPolicy(currentPolicy, takeawayText)` to build updated policy
      4. Call `apiService.put(\`/actions/${actionId}\`, { policy: updatedPolicy })` to persist
      5. Optimistically update the action in the TanStack Query cache with the new policy
      6. Clear textarea, set `takeawaySaved` to true briefly, allow another entry
    - Handle errors: show toast on failure, do not clear textarea so user can retry
    - Import `composeLearningTakeawayStateText`, `appendTakeawayToPolicy` from `@/lib/learningUtils`
    - "Back to action" button continues to work without saving when no takeaway is entered (existing behavior unchanged)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4. Checkpoint — Verify QuizPage takeaway capture
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Add Copy Context button to UnifiedActionDialog
  - [x] 5.1 Implement Copy Context button and handler in `src/components/UnifiedActionDialog.tsx`
    - In the Action Policy section header `<div className="flex items-center justify-between">`, wrap the existing AI Assist `<Button>` in a `<div className="flex items-center gap-1">` and add the Copy Context button to the LEFT of AI Assist
    - Copy Context button: `variant="outline"`, `size="sm"`, `className="h-7 px-2 text-xs"`, with `<Copy className="h-3 w-3 mr-1" />` icon from lucide-react
    - Import `Copy` from `lucide-react`
    - Import `parseLearningTakeawayStateText`, `buildCopyContextText` from `@/lib/learningUtils`
    - Use the existing `useStates` hook to fetch states for the action: `useStates({ entity_type: 'action', entity_id: action?.id })`
    - Implement `handleCopyContext` async handler:
      1. Read action fields from `formData` (title, description, expected_state, policy)
      2. Filter fetched states for `[learning_takeaway]` prefix using `parseLearningTakeawayStateText`, extract `takeawayText` from each
      3. Call `buildCopyContextText(actionFields, takeawayTexts)` to build the plain text block
      4. Call existing `copyToClipboard(text)` from `@/lib/urlUtils` and show toast confirmation on success
    - Handle edge cases: works when no takeaways exist (Req 3.5), works when action fields are empty
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 6. Final checkpoint — Verify all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All new pure functions are added to the existing `src/lib/learningUtils.ts` — no new files for utilities
- QuizPage modification is inline in the `quiz_complete` block — no new component file
- UnifiedActionDialog already imports `copyToClipboard` from `@/lib/urlUtils` — reuse it
- `useStates` hook from `@/hooks/useStates` is already used in other components (StatesInline, ExperienceCreationDialog)
- `fast-check` is already in root `package.json` devDependencies
- No `escapeHtml` utility exists in the project — add a local helper in `learningUtils.ts`
- Property tests validate the three correctness properties from the design document
- Each task references specific requirements for traceability
