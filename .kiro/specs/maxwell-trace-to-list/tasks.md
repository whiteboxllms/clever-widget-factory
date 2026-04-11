# Implementation Plan: Maxwell Trace to List

## Overview

Connect Maxwell's expense analysis responses to the Finances page transaction list. The implementation adds `entity_id` to the Lambda response, creates a trace parser utility, introduces a React context for sharing Maxwell record IDs, and updates the Finances page with highlighting, filtering, a filter indicator, and auto-scroll. The approach follows existing codebase patterns (UploadQueueContext, GlobalMaxwellFAB).

## Tasks

- [x] 1. Include `entity_id` in maxwell-expenses Lambda response
  - [x] 1.1 Update the results mapper in `lambda/maxwell-expenses/index.js`
    - Add `entity_id: row.entity_id` to the results mapper object (the SQL already selects `ue.entity_id`)
    - Place it as the first field in the mapper for clarity
    - This is a backward-compatible addition — the `instructions` field does not reference `entity_id`
    - _Requirements: 1.2_

  - [ ]* 1.2 Write unit test for entity_id inclusion
    - Verify the results mapper includes `entity_id` for each row
    - Verify `entity_id` is a string (UUID format)
    - _Requirements: 1.2_

- [x] 2. Create trace parser utility (`src/lib/traceParser.ts`)
  - [x] 2.1 Implement `extractRecordIdsFromTrace` function
    - Create `src/lib/traceParser.ts` with a pure function that accepts `traceEvents: any[]`
    - Navigate Bedrock trace structure: `event.trace.orchestrationTrace.observation.actionGroupInvocationOutput`
    - Filter for `actionGroupName === 'SearchFinancialRecords'`
    - Parse `actionGroupOutputString` as JSON, extract `entity_id` from each result in the `results` array
    - Return deduplicated array of entity_id strings using a `Set`
    - Skip events with missing fields (optional chaining), malformed JSON (try/catch), or non-string entity_ids
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ]* 2.2 Write property test: Trace parser extraction correctness
    - **Property 1: Trace parser extraction correctness**
    - Generate random arrays of trace events: valid SearchFinancialRecords responses with random entity_ids, other action group names, malformed JSON, missing fields
    - Independently compute expected set by filtering for valid SearchFinancialRecords events
    - Assert parser output equals expected set
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

  - [ ]* 2.3 Write property test: Trace parser round-trip
    - **Property 2: Trace parser round-trip**
    - Generate random set of UUID strings, construct valid trace events embedding those UUIDs
    - Assert `extractRecordIdsFromTrace` returns a set equal to the input set
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 1.2, 1.3**

  - [ ]* 2.4 Write unit tests for trace parser edge cases
    - Test: single response with 3 entity_ids → returns all 3
    - Test: two responses (agent called action group twice) → combined and deduplicated
    - Test: mixed events (SearchFinancialRecords + other action groups) → only SearchFinancialRecords IDs
    - Test: empty array → empty array
    - Test: malformed JSON in `actionGroupOutputString` → skips without throwing
    - Test: missing `entity_id` or non-string entity_id → skips that result
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3. Checkpoint - Verify Lambda change and trace parser
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create Maxwell Record Highlight Context (`src/contexts/MaxwellRecordHighlightContext.tsx`)
  - [x] 4.1 Implement `MaxwellRecordHighlightProvider` and `useMaxwellRecordHighlight` hook
    - Follow the `UploadQueueContext` pattern: `createContext`, provider component, custom hook with error if used outside provider
    - Context interface: `maxwellRecordIds: string[]`, `setMaxwellRecordIds: (ids: string[]) => void`, `clearMaxwellRecordIds: () => void`, `isFilterActive: boolean`, `setIsFilterActive: (active: boolean) => void`
    - `clearMaxwellRecordIds` resets both `maxwellRecordIds` to `[]` and `isFilterActive` to `false`
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 6.1_

  - [x] 4.2 Add `MaxwellRecordHighlightProvider` to `src/App.tsx`
    - Wrap `AppContent` children (Routes + GlobalMaxwellFAB) inside `MaxwellRecordHighlightProvider`
    - Place inside `AppContent` function so it's within `BrowserRouter` scope
    - Both GlobalMaxwellPanel and Finances page will share the same context instance
    - _Requirements: 2.2, 6.1, 6.2_

  - [ ]* 4.3 Write property test: State replacement semantics
    - **Property 3: State replacement semantics**
    - Generate two random arrays of UUID strings A and B
    - Call `setMaxwellRecordIds(A)` then `setMaxwellRecordIds(B)`
    - Assert context state equals B with no elements from A retained unless also in B
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 2.3, 6.3**

- [x] 5. Integrate trace parsing into GlobalMaxwellPanel (`src/components/GlobalMaxwellPanel.tsx`)
  - [x] 5.1 Extract record IDs from assistant messages and update context
    - Import `extractRecordIdsFromTrace` from `@/lib/traceParser` and `useMaxwellRecordHighlight` from context
    - Add a `useEffect` watching `messages` array: when the last message is `role === 'assistant'` with non-empty `trace`, call `extractRecordIdsFromTrace(lastMessage.trace)` and if IDs are non-empty, call `setMaxwellRecordIds(ids)`
    - _Requirements: 2.1, 2.2, 2.3, 6.3_

- [x] 6. Checkpoint - Verify context and panel integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Update Finances page with highlighting, filter indicator, filtering, and auto-scroll
  - [x] 7.1 Add Maxwell highlight and filter indicator to Finances page (`src/pages/Finances.tsx`)
    - Import `useMaxwellRecordHighlight` from context, `useLocation` from react-router-dom
    - Create a `Set` from `maxwellRecordIds` for O(1) lookup
    - Compute `matchCount` as intersection of `maxwellRecordIds` and loaded record IDs
    - Add Maxwell filter indicator banner above the transaction table (when `maxwellRecordIds.length > 0 && matchCount > 0`): text "Showing X records from Maxwell", a "Filter" toggle button, and a dismiss (X) button that calls `clearMaxwellRecordIds`
    - _Requirements: 4.1, 4.2, 4.3, 4.6_

  - [x] 7.2 Add row highlighting to transaction table rows
    - For each `<TableRow>`, check `maxwellRecordIdSet.has(record.id)` and apply `bg-primary/5 hover:bg-primary/10` class when highlighted
    - All records remain visible (highlights are additive, not filtering)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 7.3 Implement filter toggle in `filteredAndSorted` memo
    - When `isFilterActive && maxwellRecordIds.length > 0`, add an additional filter step: `records.filter(r => maxwellRecordIdSet.has(r.id))`
    - Apply after existing description/method/creator filters, before sort
    - When toggle is deactivated, all records show with highlights
    - _Requirements: 4.3, 4.4, 4.5_

  - [x] 7.4 Implement auto-scroll to first highlighted record
    - Add a ref (`firstHighlightRef`) to the first highlighted `<TableRow>`
    - Use a `useEffect` with a `prevRecordIdsRef` to detect when IDs are first set (transition from empty to non-empty)
    - Call `scrollIntoView({ behavior: 'smooth', block: 'center' })` once
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 7.5 Clear Maxwell record IDs on navigation away from Finances
    - Add a `useEffect` cleanup that calls `clearMaxwellRecordIds()` when the component unmounts
    - _Requirements: 2.4_

  - [ ]* 7.6 Write property test: Highlight correctness (set membership)
    - **Property 4: Highlight correctness**
    - Generate random list of financial record objects and random set of Maxwell record IDs
    - Assert `isHighlighted` is true iff `record.id` is in the Maxwell set
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 3.1, 3.4**

  - [ ]* 7.7 Write property test: Default non-filtering behavior
    - **Property 5: Default non-filtering behavior**
    - Generate random list of records and random non-empty set of Maxwell IDs with `isFilterActive = false`
    - Assert displayed record count equals total record count
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 3.2, 4.5**

  - [ ]* 7.8 Write property test: Match count equals intersection size
    - **Property 6: Match count equals intersection size**
    - Generate random set of Maxwell IDs and random list of records
    - Assert match count equals the intersection size
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 4.1**

  - [ ]* 7.9 Write property test: Filter correctness
    - **Property 7: Filter correctness**
    - Generate random list of records and random non-empty set of Maxwell IDs with `isFilterActive = true`
    - Assert every returned record's id is in the Maxwell set, every matching record is returned, and relative order is preserved
    - Use `fast-check`, minimum 100 iterations
    - **Validates: Requirements 4.3, 4.4**

  - [ ]* 7.10 Write unit tests for Finances page Maxwell integration
    - Test: filter indicator shows correct match count
    - Test: dismiss button clears Maxwell record IDs and hides indicator
    - Test: filter toggle shows only matching records when active
    - Test: filter toggle shows all records with highlights when inactive
    - Test: auto-scroll fires once on first ID set, not on re-renders
    - Test: context clears on unmount (navigation away)
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 4.3, 4.5, 5.1, 5.3_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The Lambda change (task 1) is a one-line addition — the SQL already selects `entity_id`
- The context lives at the App level, so Maxwell highlights persist across panel open/close (Requirement 6)
- Property tests use `fast-check` with minimum 100 iterations
- Checkpoints ensure incremental validation
