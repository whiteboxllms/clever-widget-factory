# Requirements Document: Maxwell Trace to List

## Introduction

Maxwell (the Bedrock Agent assistant) already answers expense questions via the `maxwell-expenses` action group Lambda, which returns `entity_id` for every matched financial record. The Maxwell chat panel already captures Bedrock Agent trace events (visible via the "Show trace" button), and these traces contain the raw action group response as structured JSON — not LLM-generated text — making the entity_ids 100% reliable.

This feature connects Maxwell's expense analysis responses to the Finances page transaction list for auditability. When Maxwell answers an expense question on the `/finances` page, the matching records should be highlighted and/or filtered in the transaction list so users can verify exactly which records Maxwell's ROI calculations, totals, and analysis are based on.

Use cases include: verifying expense totals, auditing ROI calculations, and checking for unusually priced items that Maxwell flags.

## Glossary

- **Maxwell**: The Bedrock Agent-based AI assistant accessible via the prism FAB button
- **Maxwell_Chat_Panel**: The `GlobalMaxwellPanel` component that displays Maxwell conversations, including trace events
- **Trace_Events**: The array of Bedrock Agent trace objects captured during each agent invocation, stored on each assistant message as `message.trace`
- **Action_Group_Response**: The structured JSON response from an action group Lambda (e.g., `maxwell-expenses`) embedded within a trace event; contains the raw `results` array with `entity_id` fields
- **SearchFinancialRecords**: The action group API path (`/searchFinancialRecords`) used by the `maxwell-expenses` Lambda; its response body includes an array of results each containing an `entity_id`
- **Finances_Page**: The `/finances` route displaying the transaction list with filters and running balance
- **Financial_Record**: A transaction record in the `financial_records` table, identified by its `id` (UUID)
- **Transaction_List**: The `<Table>` component within the Finances page that renders financial records as rows
- **Highlighted_Records**: Financial records in the Transaction_List that are visually distinguished because they were referenced in a Maxwell action group response
- **Maxwell_Filter_Indicator**: A UI element showing "Showing X records from Maxwell" that indicates the transaction list is filtered/highlighted based on Maxwell's response
- **Maxwell_Record_IDs**: The set of `entity_id` values extracted from SearchFinancialRecords action group responses in the trace events

## Requirements

### Requirement 1: Extract Entity IDs from Maxwell Trace Events

**User Story:** As a developer, I want a reliable way to extract financial record entity_ids from Maxwell's trace events, so that the Finances page can identify which records Maxwell referenced.

#### Acceptance Criteria

1. WHEN a Maxwell assistant message contains trace events, THE Trace_Parser SHALL scan the Trace_Events array for action group responses where the `apiPath` matches `/searchFinancialRecords`
2. WHEN a SearchFinancialRecords action group response is found in the trace, THE Trace_Parser SHALL parse the response body JSON and extract the `entity_id` field from each object in the `results` array
3. THE Trace_Parser SHALL return a deduplicated array of entity_id strings (UUIDs) from all matching SearchFinancialRecords responses within a single message's trace
4. IF a trace event does not contain a SearchFinancialRecords response or the response body cannot be parsed, THEN THE Trace_Parser SHALL skip that event and continue processing remaining events without error
5. IF no SearchFinancialRecords responses are found in any trace events, THEN THE Trace_Parser SHALL return an empty array

### Requirement 2: Share Maxwell Record IDs with the Finances Page

**User Story:** As a user on the Finances page, I want the transaction list to know which records Maxwell just referenced, so that I can see them highlighted after asking an expense question.

#### Acceptance Criteria

1. WHEN a Maxwell assistant message is received while the user is on the Finances_Page, THE Maxwell_Chat_Panel SHALL extract Maxwell_Record_IDs from the message's trace events using the Trace_Parser
2. WHEN Maxwell_Record_IDs are extracted and non-empty, THE Maxwell_Chat_Panel SHALL make the Maxwell_Record_IDs available to the Finances_Page via shared state
3. WHEN a new Maxwell assistant message with trace events is received, THE shared state SHALL replace any previously stored Maxwell_Record_IDs with the new set
4. WHEN the user navigates away from the Finances_Page, THE shared state SHALL clear the Maxwell_Record_IDs
5. WHEN the user dismisses the Maxwell_Filter_Indicator, THE shared state SHALL clear the Maxwell_Record_IDs

### Requirement 3: Highlight Matching Records in the Transaction List

**User Story:** As a user, I want to see which transaction records Maxwell used in its analysis, so that I can verify the data behind Maxwell's calculations.

#### Acceptance Criteria

1. WHILE Maxwell_Record_IDs are present in shared state, THE Transaction_List SHALL apply a distinct visual highlight (background color) to each row whose `record.id` is included in the Maxwell_Record_IDs set
2. WHILE Maxwell_Record_IDs are present in shared state, THE Transaction_List SHALL continue to display all records (highlighted records are visually distinguished but not filtered out by default)
3. THE highlighted row style SHALL be visually distinct from the default row style and from the hover state, using a subtle accent background color
4. WHEN Maxwell_Record_IDs are cleared from shared state, THE Transaction_List SHALL remove all Maxwell-related highlights and return to the default display

### Requirement 4: Maxwell Filter Indicator

**User Story:** As a user, I want to see a clear indicator showing how many records Maxwell referenced, so that I understand the scope of Maxwell's analysis and can dismiss the highlighting when done.

#### Acceptance Criteria

1. WHILE Maxwell_Record_IDs are present and non-empty in shared state, THE Finances_Page SHALL display a Maxwell_Filter_Indicator showing the text "Showing X records from Maxwell" where X is the count of Maxwell_Record_IDs that match records currently loaded in the Transaction_List
2. THE Maxwell_Filter_Indicator SHALL include a dismiss button (X icon) that clears the Maxwell_Record_IDs from shared state when clicked
3. THE Maxwell_Filter_Indicator SHALL include a "Filter" toggle button that, when activated, filters the Transaction_List to show only the highlighted records
4. WHEN the "Filter" toggle is active, THE Transaction_List SHALL display only records whose `record.id` is included in the Maxwell_Record_IDs set
5. WHEN the "Filter" toggle is deactivated, THE Transaction_List SHALL return to showing all records with highlights applied
6. WHEN Maxwell_Record_IDs are empty or cleared, THE Maxwell_Filter_Indicator SHALL not be visible

### Requirement 5: Scroll to First Highlighted Record

**User Story:** As a user, I want the transaction list to automatically scroll to the first matching record after Maxwell responds, so that I can immediately see the relevant data.

#### Acceptance Criteria

1. WHEN new Maxwell_Record_IDs are set in shared state and the Transaction_List contains at least one matching record, THE Finances_Page SHALL scroll the first highlighted row into view
2. THE scroll behavior SHALL use smooth scrolling
3. THE scroll SHALL only occur once when Maxwell_Record_IDs are first set, not on subsequent re-renders

### Requirement 6: Persistence Across Panel Toggle

**User Story:** As a user, I want the Maxwell highlights to persist if I close and reopen the Maxwell panel, so that I don't lose the audit context while reviewing records.

#### Acceptance Criteria

1. WHEN the Maxwell_Chat_Panel is closed while Maxwell_Record_IDs are present, THE shared state SHALL retain the Maxwell_Record_IDs
2. WHEN the Maxwell_Chat_Panel is reopened on the Finances_Page, THE Transaction_List SHALL continue to display highlights for the retained Maxwell_Record_IDs
3. WHEN the user sends a new message to Maxwell and receives a response with different trace data, THE shared state SHALL update the Maxwell_Record_IDs to reflect the latest response
