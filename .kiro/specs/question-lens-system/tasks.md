# Implementation Plan: Question Lens System

## Overview

This plan implements the Question Lens System — weighted random lens selection for quiz diversity, asset-enriched quiz context via vector search, admin-configured gap boost rules, ideal answer display removal, and high-ceiling open-form prompt tuning. Tasks are ordered backend-first (shared module → Learning Lambda changes → Core Lambda API extension), then frontend (OpenFormInput cleanup → LensManagementCard), then deployment, to enable incremental testing at each layer.

## Tasks

- [x] 1. Create shared `lensDefaults.js` module in the Lambda layer
  - [x] 1.1 Create `lambda/shared/lensDefaults.js` with system lens constants and resolution utilities
    - Define `SYSTEM_LENSES` array with 6 lens objects: `failure_analysis`, `underlying_science`, `cross_asset_comparison`, `practical_tradeoffs`, `root_cause_reasoning`, `scenario_response` — each with `key`, `label`, `description`, and `defaultWeight: 0.5`
    - Define `LENS_CONFIG_DEFAULTS` object: `{ system_lens_weights: {}, custom_lenses: [], values_lens_weights: {}, gap_boost_rules: [] }`
    - Define constants: `VALUES_LENS_DEFAULT_WEIGHT = 0.3`, `MAX_CUSTOM_LENSES = 20`, `MAX_GAP_BOOST_RULES = 10`
    - Implement `resolveLensConfig(lensConfig)`: merges raw `lens_config` from `ai_config` JSONB with defaults, validates weights are in [0.0, 1.0], replaces invalid/missing fields with defaults, enforces max custom lenses (20) and max gap boost rules (10)
    - Implement `buildLensPool(resolvedLensConfig, strategicAttributes)`: builds combined pool of enabled system lenses (with weight overrides), values lenses (from `strategicAttributes` with weight overrides), and custom lenses — returns array of `{ key, label, description, weight, source }` for all enabled lenses
    - Export all via `module.exports`
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.3, 2.4, 2.5_

  - [ ]* 1.2 Write property test for `resolveLensConfig` — config resolution always produces valid output
    - **Property 3: Lens config validation**
    - Use fast-check to generate arbitrary inputs (null, undefined, empty objects, partial objects with random field values, out-of-range weights, duplicate labels)
    - Assert: all system lens weights in [0.0, 1.0], all custom lens labels 1–100 chars, all custom lens descriptions 1–500 chars, all custom lens weights in [0.0, 1.0], no duplicate custom lens labels, custom lenses array ≤ 20 entries
    - **Validates: Requirements 3.1, 3.6, 9.5, 9.7, 9.8**

  - [ ]* 1.3 Write property test for `buildLensPool` — values lens derivation from strategic attributes
    - **Property 2: Values lens derivation from strategic attributes**
    - Use fast-check to generate random string arrays for `strategicAttributes`
    - Assert: exactly one lens per attribute, each lens `label` matches original attribute, each lens `key` is deterministic slug prefixed with `values_`, each lens `source` is `'values'`
    - **Validates: Requirements 2.1, 2.4**

- [x] 2. Implement lens selector, gap boost, and values lens builder in Learning Lambda
  - [x] 2.1 Implement `selectLenses()` function in `lambda/learning/index.js`
    - Import `lensDefaults` from `/opt/nodejs/lensDefaults`
    - Implement weighted random sampling without replacement: filter pool to enabled lenses with weight > 0, determine count as `Math.min(pool.length, 2 + (Math.random() < 0.5 ? 1 : 0))`, pick from cumulative distribution, remove selected, repeat
    - If fewer than 2 enabled lenses, select all available (0 or 1)
    - Accept `lensPool`, `capabilityGap`, and `gapBoostRules` parameters
    - Call `applyGapBoost()` before sampling when gap data is available
    - _Requirements: 4.1, 4.2, 4.3, 4.6_

  - [x] 2.2 Implement `applyGapBoost()` function in `lambda/learning/index.js`
    - Sort rules by `threshold` descending
    - Find first rule where `capabilityGap >= rule.threshold` (highest matching threshold)
    - Multiply weights of lenses in `rule.lens_keys` by `rule.multiplier`
    - Return modified pool (normalization happens in `selectLenses`)
    - When no rules match or rules array is empty, return pool unchanged
    - _Requirements: 5.4, 5.5, 5.6_

  - [x] 2.3 Implement `buildValuesLenses()` function in `lambda/learning/index.js`
    - Accept `strategicAttributes` array and `valuesLensWeights` overrides
    - For each attribute: `key` = `values_` + slugified attribute, `label` = original string, `description` = `"How does this practice align with or reinforce the organization value: {attribute}?"`, `weight` = override or `VALUES_LENS_DEFAULT_WEIGHT` (0.3), `source` = `'values'`
    - Return empty array when `strategicAttributes` is null or empty
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 2.4 Write property test for `selectLenses` — weighted random selection invariants
    - **Property 1: Weighted random selection invariants**
    - Use fast-check to generate random lens pools with N ≥ 2 enabled lenses
    - Assert: returns 2–3 lenses, all unique, all from input pool, none with weight 0.0 or disabled
    - **Validates: Requirements 1.4, 4.1, 4.2**

  - [ ]* 2.5 Write property test for `applyGapBoost` — gap boost rule application
    - **Property 4: Gap boost rule application**
    - Use fast-check to generate random pools, gap values, and rule sets
    - Assert: correct rule selected (highest threshold ≤ gap), only specified lens weights multiplied, unchanged when no rules match
    - **Validates: Requirements 5.4, 5.5, 5.6**

  - [ ]* 2.6 Write property test for `selectLenses` — selection randomness
    - **Property 7: Selection randomness**
    - Use fast-check to generate random pools with 4+ enabled lenses
    - Run `selectLenses` 20 times, assert at least 2 distinct lens combinations
    - **Validates: Requirements 4.6**

- [x] 3. Implement asset context retriever in Learning Lambda
  - [x] 3.1 Implement `fetchAssetContext()` function in `lambda/learning/index.js`
    - Accept `db`, `actionId`, `axisKey`, `organizationId` parameters
    - Execute vector similarity query against `unified_embeddings`: search entity types `action`, `part`, `tool`, `policy`, filtered by `organization_id`, excluding current action's own embeddings, ordered by similarity DESC, LIMIT 10
    - From top 10 results, randomly select 3 (or fewer if < 3 available)
    - Return array of `{ entity_type, entity_id, description }` using `embedding_source` as description
    - On query failure or missing skill axis embedding, return empty array and log warning
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 6.7_

  - [ ]* 3.2 Write property test for asset context random selection
    - **Property 5: Asset context random selection**
    - Use fast-check to generate random asset lists of varying lengths (0–20)
    - Assert: returns `min(3, N)` unique items, all members of original list
    - **Validates: Requirements 6.4, 6.6**

- [x] 4. Implement prompt builders and integrate lenses into quiz generation
  - [x] 4.1 Implement `buildLensPromptBlock()` and `buildAssetContextBlock()` in `lambda/learning/index.js`
    - `buildLensPromptBlock(selectedLenses)`: builds `QUESTION FRAMING LENSES` text block with numbered lens descriptions and framing guidance note
    - `buildAssetContextBlock(assets)`: builds `RELATED ASSETS` text block with numbered asset descriptions including entity type
    - Both return empty string when given empty arrays
    - _Requirements: 4.4, 4.5, 6.5_

  - [x] 4.2 Integrate lens selection and asset context into `handleQuizGenerate`
    - Fetch organization's `settings` (for `strategic_attributes`) and `ai_config` (for `lens_config`)
    - Call `buildLensPool()` with resolved lens config and strategic attributes
    - Fetch capability gap for the target axis via `handleOrganizationCapability` (catch errors, fall back to null)
    - Call `selectLenses()` with pool, gap, and gap boost rules
    - Call `fetchAssetContext()` for cross-domain asset descriptions
    - Pass lens block and asset block to both `generateQuizViaBedrock` and `generateOpenFormQuizViaBedrock` as additional prompt context
    - _Requirements: 4.1, 4.4, 5.3, 5.7, 6.1_

  - [x] 4.3 Update `generateQuizViaBedrock` to accept and append lens + asset prompt blocks
    - Add `lensBlock` and `assetBlock` parameters
    - Append blocks after the existing prompt sections, before the JSON return instruction
    - Do not modify the core prompt template — blocks are additive
    - _Requirements: 4.4, 4.5, 6.5_

  - [x] 4.4 Update `generateOpenFormQuizViaBedrock` to accept and append lens + asset prompt blocks
    - Add `lensBlock` and `assetBlock` parameters
    - Append blocks after the existing prompt sections, before the JSON return instruction
    - _Requirements: 4.4, 4.5, 6.5_

  - [ ]* 4.5 Write property test for prompt construction
    - **Property 6: Prompt construction includes lens instructions and asset descriptions**
    - Use fast-check to generate random lens/asset sets
    - Assert: constructed prompt blocks contain every selected lens's description text and every asset's `embedding_source` text as substrings
    - **Validates: Requirements 4.4, 6.5**

- [x] 5. Checkpoint — Verify shared module and Learning Lambda lens integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add high-ceiling open-form prompt tuning
  - [x] 6.1 Update `generateOpenFormQuizViaBedrock` with high-ceiling question instructions
    - Add `HIGH-CEILING QUESTION DESIGN` block to the prompt: craft open-ended questions for responses ranging from basic recall to expert-level synthesis, avoid single-answer/narrow-response questions, avoid yes/no framings and list-based questions, favor layered reasoning and multiple valid perspectives
    - Add `IDEAL ANSWER REFERENCE` block: generate level 4–5 reference answer demonstrating expert-level reasoning, so evaluator can score across full 0–5 continuum
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 6.2 Write unit tests for high-ceiling prompt instructions
    - Verify prompt output contains high-ceiling instruction keywords ("open-ended", "layered reasoning", "multiple valid perspectives")
    - Verify prompt instructs level 4–5 ideal answer reference
    - Verify prompt prohibits yes/no framings and list-based questions
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 7. Extend Core Lambda `PUT /ai-config` to handle `lens_config`
  - [x] 7.1 Update `PUT /api/organizations/:id/ai-config` handler in `lambda/core/index.js`
    - Import `lensDefaults` from `/opt/nodejs/lensDefaults` for validation constants (`MAX_CUSTOM_LENSES`, `MAX_GAP_BOOST_RULES`)
    - Accept optional `lens_config` field in the request body
    - Validate `lens_config` if present: system lens weights in [0.0, 1.0], custom lens labels 1–100 chars, custom lens descriptions 1–500 chars, custom lens weights in [0.0, 1.0], no duplicate custom lens labels, max 20 custom lenses, gap boost rule thresholds ≥ 0.5, multipliers in [1.1, 3.0], max 10 gap boost rules
    - Merge `lens_config` into the `ai_config` JSONB using the existing `COALESCE || jsonb` pattern
    - Return resolved config after write
    - _Requirements: 3.1, 3.5, 3.6, 5.8, 9.6, 9.7, 9.8_

  - [ ]* 7.2 Write unit tests for lens_config validation in PUT /ai-config
    - Test rejects custom lens count > 20 with 400
    - Test rejects gap boost rule count > 10 with 400
    - Test rejects duplicate custom lens labels with 400
    - Test rejects out-of-range weights with 400
    - Test accepts valid lens_config and persists correctly
    - _Requirements: 3.1, 3.5, 3.6, 5.8_

- [x] 8. Checkpoint — Verify all backend changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Remove ideal answer display from `OpenFormInput` component
  - [x] 9.1 Update `src/components/OpenFormInput.tsx` to remove ideal answer card
    - Remove the blue-bordered `<Card>` with `<Lightbulb>` icon that displays `idealAnswer` after submission
    - Keep the `idealAnswer` prop in the component interface (still needed for AI evaluation)
    - Keep the evaluation result card (score badge + reasoning) unchanged
    - Remove the `Lightbulb` import from lucide-react if no longer used
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 9.2 Write unit tests for OpenFormInput post-submission display
    - Test that ideal answer card is NOT rendered after submission
    - Test that evaluation result badge ("Great depth" / "Keep developing") and reasoning text ARE still rendered
    - Test that `idealAnswer` prop is still accepted by the component
    - _Requirements: 7.1, 7.3, 7.4_

- [x] 10. Build `LensManagementCard` component
  - [x] 10.1 Create `src/components/LensManagementCard.tsx`
    - Follow the `AiConfigCard` pattern: React Hook Form + Zod validation, TanStack Query for fetching/mutations with optimistic updates
    - Accept `organizationId` and `strategicAttributes` props
    - Read `ai_config.lens_config` via existing `GET /api/organizations/:id/ai-config` endpoint
    - Fall back to `LENS_CONFIG_DEFAULTS` when `lens_config` is null
    - **System Lenses section**: 6 rows with label, weight slider/input (0.0–1.0, step 0.1), enabled/disabled toggle
    - **Values Lenses section**: auto-populated from `strategicAttributes`, each with weight slider/input and enabled toggle, info note "Auto-derived from your organization values"
    - **Custom Lenses section**: list with edit/delete, "Add Custom Lens" form (label input 1–100 chars, description textarea 1–500 chars, weight input 0.0–1.0), max 20 custom lenses, duplicate label validation
    - **Gap Boost Rules section**: list with threshold (≥ 0.5), target lens keys (multi-select from all lens keys), multiplier (1.1–3.0), max 10 rules
    - Persist via `PUT /api/organizations/:id/ai-config` with `lens_config` nested inside `ai_config`
    - Group lenses into three visually distinct sections: "System Lenses", "Values Lenses", "Custom Lenses"
    - Validate all weights 0.0–1.0 before saving
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 3.2, 3.3, 3.4, 3.6, 5.1, 5.2_

  - [ ]* 10.2 Write unit tests for `LensManagementCard`
    - Test renders system, values, and custom lens sections
    - Test values lenses auto-populate from `strategicAttributes` prop
    - Test Zod schema rejects out-of-range weights
    - Test Zod schema rejects custom lens labels > 100 chars and descriptions > 500 chars
    - Test duplicate custom lens label shows validation error
    - _Requirements: 9.2, 9.3, 9.4, 9.7, 9.8, 9.10_

- [x] 11. Integrate `LensManagementCard` into Organization page
  - [x] 11.1 Add `<LensManagementCard>` to `src/pages/Organization.tsx`
    - Import `LensManagementCard` from `@/components/LensManagementCard`
    - Render after the `<AiConfigCard>` inside the existing `isAdmin` gate
    - Pass `organizationId` and `strategicAttributes` (from `targetOrganization.settings?.strategic_attributes || []`) as props
    - _Requirements: 9.1, 9.9_

- [x] 12. Checkpoint — Verify frontend changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Deploy all changes
  - [x] 13.1 Deploy updated cwf-common-nodejs Lambda layer with new `lensDefaults.js`
    - Add `lambda/shared/lensDefaults.js` to the layer package alongside existing `aiConfigDefaults.js`
    - Publish new layer version
    - _Requirements: 1.3_

  - [x] 13.2 Deploy modified Lambdas using `deploy-lambda-with-layer.sh`
    - Deploy `lambda/learning` → `cwf-learning-lambda`
    - Deploy `lambda/core` → `cwf-core-lambda`
    - _Requirements: all_

  - [x] 13.3 Deploy API Gateway changes (if any new routes needed)
    - The existing `PUT /api/organizations/:id/ai-config` route is reused — no new API Gateway routes required
    - Deploy API Gateway to pick up any Lambda ARN updates
    - _Requirements: 9.6_

- [x] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Backend tasks (1–8) come before frontend (9–12) and deploy (13) to enable incremental testing
- No new database columns or tables — lens config is stored inside the existing `ai_config` JSONB column
- No new API endpoints — the existing `PUT /api/organizations/:id/ai-config` is extended to accept `lens_config`
- `lensDefaults.js` is added to the Lambda layer so both the Learning Lambda and frontend can reference the same system lens definitions and defaults
- Values lenses are ephemeral — derived at quiz time from `strategic_attributes`, never stored as lens config
- Property tests validate universal correctness properties from the design document
- The `idealAnswer` field is retained in the quiz payload for AI evaluation scoring — only the UI display is removed
