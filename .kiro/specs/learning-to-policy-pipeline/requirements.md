# Requirements Document

## Introduction

The Learning-to-Policy Pipeline feature adds a "takeaway" capture mechanism to the quiz complete screen, allowing learners to record ideas they want to incorporate into their action plan after a learning session. When a learner finishes a quiz, they see a prompt asking if they came up with anything to add to their action plan. Takeaways are stored as states (following the existing `[prefix]` convention with `[learning_takeaway]`), appended to the action's policy field so they immediately become part of the plan.

The feature also adds a "Copy Context" button to the Action Policy section header in UnifiedActionDialog, enabling learners to copy their action context and takeaways to the clipboard for use with external AI tools when writing a more comprehensive policy.

When no takeaway is entered, the quiz complete screen behaves exactly as it does today — the learner clicks "Back to action" and returns to the action page.

## Glossary

- **Takeaway**: A free-text note captured by a learner on the quiz complete screen, describing something they want to incorporate into their action plan. Stored as a state with a `[learning_takeaway]` prefix in `state_text`.
- **Takeaway_Capture_Section**: The UI section on the quiz complete screen between the score summary and the "Back to action" button, containing the prompt, textarea, and "Save" button for recording takeaways.
- **Quiz_Complete_Screen**: The screen displayed in QuizPage.tsx after a quiz session ends, showing a trophy icon, score summary, and navigation back to the action.
- **Action_Policy**: The rich text field on an action (edited via TipTap in UnifiedActionDialog) that describes the plan or policy for how the action should be carried out.
- **Copy_Context_Button**: A button placed to the left of the existing "AI Assist" button on the Action Policy section header in UnifiedActionDialog, which copies a formatted text block of action context and takeaways to the clipboard.
- **States_Table**: The `states` table in the database, used to store observations, updates, and tagged records. Each state has a `state_text` field and is linked to entities via the `state_links` table.
- **State_Links_Table**: The `state_links` table that associates a state with an entity via `state_id`, `entity_type`, and `entity_id`.
- **Learning_Takeaway_Tag**: The `[learning_takeaway]` prefix in `state_text` that identifies a state as a takeaway captured from a quiz session.
- **Embeddings_Pipeline**: The existing SQS-based pipeline that generates embedding vectors for states and stores them in the `unified_embeddings` table for semantic search.
- **UnifiedActionDialog**: The React component (`src/components/UnifiedActionDialog.tsx`) that renders the action detail/edit dialog, including the Action Policy section with TipTap editor and AI Assist button.

## Requirements

### Requirement 1: Takeaway Capture on Quiz Complete

**User Story:** As a learner, I want to capture what I want to incorporate into my action plan after a quiz session, so that ideas sparked by learning do not get lost.

#### Acceptance Criteria

1. WHEN the quiz reaches the complete state, THE Quiz_Complete_Screen SHALL display a Takeaway_Capture_Section between the score summary and the "Back to action" button, with the heading "Takeaways" and the prompt text "Did you come up with anything you want to incorporate into the action plan?"
2. THE Takeaway_Capture_Section SHALL contain a textarea input and a "Save" button for the learner to enter and save a takeaway.
3. THE Takeaway_Capture_Section SHALL be optional — WHEN the learner clicks "Back to action" without entering a takeaway, THE Quiz_Complete_Screen SHALL navigate to the action page without saving any state.
4. WHEN the learner enters text and clicks "Save", THE Quiz_Complete_Screen SHALL create a state in the States_Table with the `[learning_takeaway]` prefix in `state_text`.
5. WHEN a takeaway state is created, THE Quiz_Complete_Screen SHALL include metadata in the `state_text`: the axis key, the action ID, and the user ID.
6. WHEN a takeaway state is created, THE Quiz_Complete_Screen SHALL link the state to the action via the State_Links_Table with `entity_type='action'` and `entity_id` set to the action ID.
7. AFTER a takeaway is saved, THE Takeaway_Capture_Section SHALL clear the textarea and allow the learner to enter and save additional takeaways within the same quiz session.

### Requirement 2: Append Takeaway to Action Policy

**User Story:** As a learner, I want my takeaway to be added to my action's policy, so that what I learned immediately becomes part of my plan.

#### Acceptance Criteria

1. WHEN the learner saves a takeaway, THE Quiz_Complete_Screen SHALL append the takeaway text to the action's existing Action_Policy field without replacing existing content.
2. THE appended takeaway text SHALL be delineated as a distinct paragraph or section within the Action_Policy so it is visually recognizable as an appended takeaway.
3. WHEN the learner navigates back to the action after saving a takeaway, THE UnifiedActionDialog SHALL reflect the updated Action_Policy content including the appended takeaway.
4. IF the Action_Policy field is empty when a takeaway is saved, THEN THE Quiz_Complete_Screen SHALL set the takeaway as the initial Action_Policy content.
5. THE append operation SHALL use the existing action update API — no new endpoints are needed.

### Requirement 3: Copy Context for External Policy Generation

**User Story:** As a learner, I want to copy my action's context and takeaways to my clipboard, so that I can use an external AI tool to help me write a better policy.

#### Acceptance Criteria

1. THE UnifiedActionDialog SHALL display a Copy_Context_Button to the LEFT of the existing "AI Assist" button on the Action Policy section header.
2. WHEN the learner clicks the Copy_Context_Button, THE UnifiedActionDialog SHALL copy a formatted text block to the clipboard containing: the action title, description, expected state, current policy text, and all learning takeaways for the action.
3. THE copied text block SHALL use labeled sections (e.g., "Title:", "Description:", "Expected State:", "Current Policy:", "Takeaways:") so that an external language model can parse and work with the content.
4. WHEN the clipboard copy succeeds, THE UnifiedActionDialog SHALL display a toast confirmation message.
5. THE Copy_Context_Button SHALL function correctly even when there are no takeaways for the action — in that case, the copied text block SHALL contain the action context fields without a takeaways section.
6. THE Copy_Context_Button SHALL match the existing "AI Assist" button style: small size, outline variant, consistent height and text size.
