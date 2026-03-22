# Requirements Document

## Introduction

The Global Maxwell Assistant feature transforms Maxwell from a dialog-embedded assistant into a globally accessible FAB (Floating Action Button) that provides contextual AI assistance on entity detail pages. This enables users to ask questions about the current entity (action, tool, or part) they are viewing without navigating away or opening dialogs.

## Glossary

- **Maxwell**: The AI assistant powered by AWS Bedrock Agent that helps users understand asset history and conditions
- **FAB**: Floating Action Button - a persistent button that floats above page content
- **Entity_Detail_Page**: Pages displaying individual action, tool, or part details
- **Context**: The current entity (action, tool, or part) being viewed by the user
- **Panel**: The slide-in interface containing Maxwell's chat functionality
- **Conversation_History**: The sequence of messages between user and Maxwell for a specific entity
- **localStorage**: Browser storage mechanism for persisting conversation data
- **Prism_Icon**: Custom SVG icon representing entropy reduction (chaos to order)

## Requirements

### Requirement 1: FAB Visibility and Placement

**User Story:** As a user viewing entity details, I want to see a floating button to access Maxwell, so that I can get AI assistance about the current entity.

#### Acceptance Criteria

1. WHEN a user views an action detail page, THE System SHALL display the FAB in the bottom-right corner
2. WHEN a user views a tool detail page, THE System SHALL display the FAB in the bottom-right corner
3. WHEN a user views a part detail page, THE System SHALL display the FAB in the bottom-right corner
4. WHEN a user views the login page, THE System SHALL NOT display the FAB
5. WHEN a user views the settings page, THE System SHALL NOT display the FAB
6. WHEN a user views any list page, THE System SHALL NOT display the FAB
7. WHEN a user views the dashboard, THE System SHALL NOT display the FAB
8. THE FAB SHALL use the custom prism SVG icon
9. THE FAB SHALL remain visible when the user scrolls the page

### Requirement 2: Responsive Panel Layouts

**User Story:** As a user on different devices, I want Maxwell's interface to adapt to my screen size, so that I have an optimal experience on desktop, tablet, and mobile.

#### Acceptance Criteria

1. WHEN the viewport width is 1024px or greater, THE Panel SHALL slide in from the right side
2. WHEN the viewport width is 1024px or greater, THE Panel SHALL occupy 30-40% of the screen width
3. WHEN the viewport width is 1024px or greater, THE Panel SHALL display a backdrop overlay behind it
4. WHEN the viewport width is less than 768px, THE Panel SHALL slide in from the bottom as a full-screen overlay
5. WHEN the viewport width is less than 768px, THE Panel SHALL support swipe-down gesture to close
6. WHEN the viewport width is less than 768px, THE Panel SHALL display a close button
7. WHEN the viewport width is between 768px and 1024px in landscape orientation, THE Panel SHALL use the side panel layout
8. WHEN the viewport width is between 768px and 1024px in portrait orientation, THE Panel SHALL use the full-screen layout
9. THE Panel SHALL have only two states: open and closed

### Requirement 3: Entity Context Management

**User Story:** As a user asking Maxwell questions, I want the assistant to know which entity I'm viewing, so that I get relevant answers without repeating context.

#### Acceptance Criteria

1. WHEN the Panel opens on an entity detail page, THE System SHALL set the context to the current entity
2. WHEN a user navigates to a different entity detail page, THE System SHALL persist the previous entity's context
3. WHEN a user clicks the "Clear" button, THE System SHALL reset the conversation for the current entity
4. WHEN a user clicks the "Switch to current page" button, THE System SHALL change the context to the currently viewed entity
5. WHEN a user clicks the "Close" button, THE System SHALL hide the Panel without clearing context
6. WHEN a user clears context, THE System SHALL reduce token costs by removing conversation history
7. THE System SHALL display the current context entity name in the Panel header

### Requirement 4: Conversation Persistence

**User Story:** As a user having multiple conversations with Maxwell, I want my recent conversations saved, so that I can return to them later without losing context.

#### Acceptance Criteria

1. WHEN a user sends a message to Maxwell, THE System SHALL store the conversation in localStorage
2. WHEN a user returns to an entity detail page, THE System SHALL restore the conversation history for that entity
3. THE System SHALL maintain the 5 most recent conversations
4. WHEN the conversation count exceeds 5, THE System SHALL evict the least recently used conversation
5. WHEN a user clears a conversation, THE System SHALL remove it from localStorage
6. THE System SHALL store conversations keyed by entity ID and entity type

### Requirement 5: Remove Maxwell from Dialogs

**User Story:** As a user, I want Maxwell accessible only through the FAB, so that I have a consistent and predictable way to access AI assistance.

#### Acceptance Criteria

1. THE System SHALL remove the MaxwellPanel component from UnifiedActionDialog
2. THE System SHALL remove the MaxwellPanel component from ToolDetails dialog
3. THE System SHALL remove the MaxwellPanel component from StockDetails dialog
4. THE System SHALL remove all "Ask Maxwell" buttons from dialogs
5. THE System SHALL remove all hints about Maxwell availability from dialogs
6. THE System SHALL remove all tooltips about Maxwell from dialogs

### Requirement 6: Feature Parity with Current Implementation

**User Story:** As a user familiar with the current Maxwell interface, I want all existing features preserved, so that I don't lose functionality during the transition.

#### Acceptance Criteria

1. THE Panel SHALL support text message input and display
2. THE Panel SHALL display conversation history with user and assistant messages
3. THE Panel SHALL display starter questions based on entity type
4. WHEN an entity type is "action", THE Panel SHALL display action-specific starter questions
5. WHEN an entity type is "tool" or "part", THE Panel SHALL display asset-specific starter questions
6. THE Panel SHALL render inline photos from markdown image syntax
7. WHEN a user clicks an inline photo, THE System SHALL open the full-resolution image in a new tab
8. THE Panel SHALL display Bedrock Agent trace data in a collapsible section
9. WHEN a user clicks "Show trace", THE Panel SHALL expand the trace display
10. THE Panel SHALL support copying individual messages to clipboard
11. THE Panel SHALL support copying the entire conversation to clipboard
12. THE Panel SHALL support copying trace data to clipboard
13. WHEN Maxwell is processing a request, THE Panel SHALL display a loading indicator
14. WHEN Maxwell returns an error, THE Panel SHALL display the error message with a retry button

### Requirement 7: Animations and Accessibility

**User Story:** As a user, I want smooth animations and keyboard support, so that the interface feels polished and is accessible to all users.

#### Acceptance Criteria

1. WHEN the Panel opens, THE System SHALL animate the slide-in transition over 300-400ms
2. WHEN the Panel closes, THE System SHALL animate the slide-out transition over 300-400ms
3. WHEN a user presses Tab, THE System SHALL move focus to the next interactive element in the Panel
4. WHEN a user presses Enter on the FAB, THE System SHALL open the Panel
5. WHEN a user presses Escape while the Panel is open, THE System SHALL close the Panel
6. WHEN the Panel opens, THE System SHALL move focus to the message input field
7. WHEN the Panel closes, THE System SHALL return focus to the FAB
8. THE Panel SHALL use smooth transitions for all state changes

### Requirement 8: Scope Limitations

**User Story:** As a product owner, I want to focus this feature on entity detail pages, so that we can deliver value quickly and defer complex features to future work.

#### Acceptance Criteria

1. THE System SHALL display the FAB only on action detail pages, tool detail pages, and part detail pages
2. THE System SHALL NOT implement FAB functionality for list pages in this release
3. THE System SHALL NOT implement general context (non-entity) conversations in this release
4. THE System SHALL NOT include unit tests in this release
5. THE System SHALL rely on manual testing for quality assurance
