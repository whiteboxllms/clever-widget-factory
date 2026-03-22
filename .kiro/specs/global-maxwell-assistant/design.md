# Design Document: Global Maxwell Assistant

## Overview

The Global Maxwell Assistant feature transforms Maxwell from a dialog-embedded assistant into a globally accessible FAB (Floating Action Button) that provides contextual AI assistance on entity detail pages. This design enables users to ask questions about actions, tools, and parts they are viewing without navigating away or opening dialogs.

### Key Design Goals

1. **Persistent Accessibility**: Maxwell is always available via a FAB on entity detail pages
2. **Context Awareness**: Automatically detects and maintains context for the current entity
3. **Conversation Persistence**: Stores up to 5 recent conversations using LRU eviction
4. **Responsive Design**: Adapts layout for desktop (side panel) and mobile (bottom sheet)
5. **Feature Parity**: Preserves all existing Maxwell capabilities (trace display, image rendering, clipboard operations)

### Design Constraints

- No unit tests required (manual testing only)
- FAB appears only on entity detail pages (actions, tools, parts)
- Reuses existing `useMaxwell` hook without modification
- Uses localStorage for conversation persistence (no backend changes)
- Removes Maxwell from all dialogs (UnifiedActionDialog, ToolDetails, StockDetails)

## Architecture

### Component Hierarchy

```
App.tsx
└── [Entity Detail Pages]
    ├── Actions.tsx
    ├── CombinedAssets.tsx (tools/parts)
    └── GlobalMaxwellFAB (new)
        ├── Prism Icon (new)
        └── GlobalMaxwellPanel (new)
            ├── Panel Header
            ├── Message List
            ├── Starter Questions
            ├── Input Field
            └── Context Controls
```

### Context Detection Strategy

The system uses React Router's `useLocation` hook to detect the current page and extract entity information:

- **Actions**: `/actions/:actionId` → Extract actionId from URL params
- **Tools**: `/combined-assets?view=tools&id=:toolId` → Extract toolId from query params
- **Parts**: `/combined-assets?view=stock&id=:partId` → Extract partId from query params

When the FAB is clicked, it captures the current entity context and passes it to the panel.

### State Management

```typescript
// Global FAB state (in GlobalMaxwellFAB component)
const [isPanelOpen, setIsPanelOpen] = useState(false);
const [currentContext, setCurrentContext] = useState<EntityContext | null>(null);

// Panel state (in GlobalMaxwellPanel component)
const { messages, isLoading, error, sendMessage, resetSession } = useMaxwell(currentContext);

// localStorage state (managed by custom hook)
const { saveConversation, loadConversation, clearConversation } = useMaxwellStorage();
```

### Responsive Layout Strategy

The panel uses Tailwind CSS breakpoints to adapt its layout:

- **Desktop (≥1024px)**: Side panel sliding from right, 30-40% width, backdrop overlay
- **Tablet Landscape (768px-1024px)**: Side panel layout
- **Mobile (<768px)**: Bottom sheet, full-screen, swipe-down to close

Implementation uses CSS media queries and conditional rendering:

```typescript
// Tailwind classes for responsive layout
className={cn(
  "fixed z-50 bg-background shadow-xl",
  "max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:h-[90vh] max-md:rounded-t-2xl",
  "md:top-0 md:right-0 md:h-full md:w-[40%] lg:w-[35%]"
)}
```

## Components and Interfaces

### GlobalMaxwellFAB Component

**Purpose**: Floating action button that triggers the Maxwell panel

**Props**: None (detects context internally)

**State**:
- `isPanelOpen: boolean` - Controls panel visibility
- `currentContext: EntityContext | null` - Current entity being viewed

**Behavior**:
- Renders only on entity detail pages (detected via `useLocation`)
- Positioned fixed at bottom-right corner
- Displays prism icon
- On click: captures current entity context and opens panel

**Interface**:
```typescript
interface EntityContext {
  entityId: string;
  entityType: 'action' | 'tool' | 'part';
  entityName: string;
  policy: string;
  implementation: string;
}
```

### GlobalMaxwellPanel Component

**Purpose**: Slide-in panel containing Maxwell chat interface

**Props**:
```typescript
interface GlobalMaxwellPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: EntityContext | null;
}
```

**Features**:
- Responsive layout (side panel on desktop, bottom sheet on mobile)
- Context display in header
- "Switch to current page" button (when context differs from current page)
- "Clear conversation" button
- Message history with user/assistant bubbles
- Starter questions (entity-type specific)
- Inline image rendering from markdown
- Trace data display (collapsible)
- Clipboard operations (copy message, copy all, copy trace)
- Loading and error states

**Reuses**: Existing `useMaxwell` hook for chat functionality

### PrismIcon Component

**Purpose**: Custom SVG icon representing entropy reduction (chaos to order)

**Design**: Geometric prism shape with gradient, symbolizing Maxwell's role in organizing information

**Interface**:
```typescript
interface PrismIconProps {
  className?: string;
  size?: number;
}
```

### useMaxwellStorage Hook

**Purpose**: Manages conversation persistence in localStorage

**Interface**:
```typescript
interface ConversationData {
  entityId: string;
  entityType: string;
  messages: MaxwellMessage[];
  lastAccessed: number;
}

interface UseMaxwellStorageReturn {
  saveConversation: (context: EntityContext, messages: MaxwellMessage[]) => void;
  loadConversation: (context: EntityContext) => MaxwellMessage[] | null;
  clearConversation: (context: EntityContext) => void;
  getStorageKey: (context: EntityContext) => string;
}
```

**Storage Key Format**: `maxwell_${entityType}_${entityId}`

**LRU Implementation**:
- Stores up to 5 conversations
- Tracks `lastAccessed` timestamp for each conversation
- Evicts oldest conversation when limit exceeded
- Updates `lastAccessed` on every read/write

## Data Models

### EntityContext

```typescript
interface EntityContext {
  entityId: string;          // UUID of the entity
  entityType: 'action' | 'tool' | 'part';  // Type of entity
  entityName: string;        // Display name
  policy: string;            // Entity description/policy
  implementation: string;    // Implementation details (for actions)
}
```

### ConversationData (localStorage)

```typescript
interface ConversationData {
  entityId: string;          // Entity UUID
  entityType: string;        // 'action' | 'tool' | 'part'
  messages: MaxwellMessage[]; // Chat history
  lastAccessed: number;      // Unix timestamp
}
```

### MaxwellMessage (from useMaxwell)

```typescript
interface MaxwellMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  trace?: any[];  // Bedrock Agent trace events
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Panel State Binary

*For any* panel state, the panel SHALL be either fully open or fully closed (no intermediate states).

**Validates: Requirements 2.9**

### Property 2: Context Isolation

*For any* two different entities, their conversation contexts SHALL be stored and retrieved independently without interference.

**Validates: Requirements 3.2**

### Property 3: Context Persistence on Close

*For any* entity context, closing the panel SHALL preserve the conversation history without modification.

**Validates: Requirements 3.5**

### Property 4: Context Reset on Clear

*For any* entity context, clicking "Clear" SHALL remove all messages from that entity's conversation history.

**Validates: Requirements 3.3, 3.6**

### Property 5: Context Switch Accuracy

*For any* entity detail page, clicking "Switch to current page" SHALL update the context to match the currently viewed entity.

**Validates: Requirements 3.4**

### Property 6: Header Context Display

*For any* entity context, the panel header SHALL display the entity name from the current context.

**Validates: Requirements 3.7**

### Property 7: Conversation Persistence

*For any* message sent to Maxwell, the conversation SHALL be stored in localStorage with the correct entity key.

**Validates: Requirements 4.1**

### Property 8: Conversation Restoration

*For any* entity with stored conversation history, returning to that entity's detail page SHALL restore the complete conversation.

**Validates: Requirements 4.2**

### Property 9: LRU Cache Size Limit

*For any* sequence of conversation creations, the system SHALL maintain at most 5 conversations in localStorage.

**Validates: Requirements 4.3**

### Property 10: LRU Eviction Policy

*For any* 6th conversation created, the system SHALL evict the conversation with the oldest `lastAccessed` timestamp.

**Validates: Requirements 4.4**

### Property 11: Storage Key Format

*For any* entity context, the localStorage key SHALL follow the format `maxwell_${entityType}_${entityId}`.

**Validates: Requirements 4.6**

### Property 12: Message Input and Display

*For any* text input submitted, the message SHALL appear in the conversation history as a user message.

**Validates: Requirements 6.1, 6.2**

### Property 13: Starter Questions by Entity Type

*For any* entity type "action", the panel SHALL display action-specific starter questions; for entity types "tool" or "part", the panel SHALL display asset-specific starter questions.

**Validates: Requirements 6.3, 6.4, 6.5**

### Property 14: Markdown Image Rendering

*For any* assistant message containing markdown image syntax `![alt](url)`, the panel SHALL render an `<img>` tag with the correct src attribute.

**Validates: Requirements 6.6**

### Property 15: Image Click Behavior

*For any* rendered inline image, clicking it SHALL open the full-resolution image URL in a new browser tab.

**Validates: Requirements 6.7**

### Property 16: Trace Data Display

*For any* assistant message with trace data, the panel SHALL display a collapsible "Show trace" button.

**Validates: Requirements 6.8**

### Property 17: Trace Toggle Behavior

*For any* trace section, clicking "Show trace" SHALL expand the trace display; clicking again SHALL collapse it.

**Validates: Requirements 6.9**

### Property 18: Message Copy to Clipboard

*For any* message, clicking the copy button SHALL copy that message's content to the system clipboard.

**Validates: Requirements 6.10**

### Property 19: Conversation Copy to Clipboard

*For any* conversation, clicking "Copy all" SHALL copy all messages in the format "Role: Content" to the clipboard.

**Validates: Requirements 6.11**

### Property 20: Trace Copy to Clipboard

*For any* trace data, clicking the copy button SHALL copy the JSON-stringified trace to the clipboard.

**Validates: Requirements 6.12**

### Property 21: Loading State Display

*For any* pending Maxwell request, the panel SHALL display a loading indicator until the response is received.

**Validates: Requirements 6.13**

### Property 22: Error State Display

*For any* Maxwell error response, the panel SHALL display the error message and a retry button.

**Validates: Requirements 6.14**

### Property 23: Keyboard Navigation

*For any* interactive element in the panel, pressing Tab SHALL move focus to the next interactive element in DOM order.

**Validates: Requirements 7.3**

### Property 24: FAB Keyboard Activation

*For any* focused FAB, pressing Enter SHALL open the panel.

**Validates: Requirements 7.4**

### Property 25: Escape Key Closes Panel

*For any* open panel, pressing Escape SHALL close the panel.

**Validates: Requirements 7.5**

### Property 26: Focus Management on Open

*For any* panel opening, focus SHALL move to the message input field.

**Validates: Requirements 7.6**

### Property 27: Focus Management on Close

*For any* panel closing, focus SHALL return to the FAB.

**Validates: Requirements 7.7**

## Error Handling

### Context Detection Errors

**Scenario**: Unable to extract entity information from URL

**Handling**:
- FAB does not render
- Log warning to console: "Unable to detect entity context"
- No user-facing error (graceful degradation)

### localStorage Errors

**Scenario**: localStorage is full or unavailable

**Handling**:
- Catch `QuotaExceededError` and `SecurityError`
- Fall back to in-memory storage for current session
- Display toast notification: "Unable to save conversation history"
- Continue functioning without persistence

### useMaxwell Hook Errors

**Scenario**: Maxwell API returns error

**Handling**:
- Display error message in panel
- Show retry button
- Preserve conversation history
- Log error details to console

### Navigation Errors

**Scenario**: User navigates away while Maxwell is processing

**Handling**:
- Cancel pending request (if possible)
- Save partial conversation to localStorage
- No error message (expected behavior)

## Testing Strategy

### Manual Testing Approach

Since unit tests are explicitly excluded from this release, the testing strategy relies on comprehensive manual testing across devices and scenarios.

### Test Scenarios

**FAB Visibility**:
- Verify FAB appears on action detail pages
- Verify FAB appears on tool detail pages
- Verify FAB appears on part detail pages
- Verify FAB does NOT appear on login, settings, dashboard, or list pages
- Verify FAB remains visible when scrolling

**Responsive Layouts**:
- Test desktop layout (≥1024px): side panel, backdrop, 30-40% width
- Test tablet landscape (768px-1024px): side panel layout
- Test mobile (<768px): bottom sheet, full-screen, swipe-down gesture
- Test orientation changes on tablets

**Context Management**:
- Open panel on action page, verify context is set correctly
- Navigate to different action, verify previous context is preserved
- Click "Switch to current page", verify context updates
- Click "Clear", verify conversation is reset
- Close panel, verify context is preserved

**Conversation Persistence**:
- Send messages, refresh page, verify conversation is restored
- Create 6 conversations, verify oldest is evicted
- Clear conversation, verify it's removed from localStorage
- Test with localStorage disabled (private browsing)

**Feature Parity**:
- Test starter questions for actions vs tools/parts
- Test inline image rendering from markdown
- Test image click opens new tab
- Test trace data display and toggle
- Test copy message, copy all, copy trace
- Test loading indicator during requests
- Test error display and retry button

**Keyboard Accessibility**:
- Tab through panel elements
- Press Enter on FAB to open
- Press Escape to close panel
- Verify focus moves to input on open
- Verify focus returns to FAB on close

**Dialog Cleanup**:
- Verify UnifiedActionDialog has no Maxwell button or panel
- Verify ToolDetails has no Maxwell button or panel
- Verify StockDetails has no Maxwell button or panel

### Browser Testing

Test on:
- Chrome (desktop and mobile)
- Safari (desktop and iOS)
- Firefox (desktop)
- Edge (desktop)

### Device Testing

Test on:
- Desktop (1920x1080, 1366x768)
- Tablet (iPad, Android tablet)
- Mobile (iPhone, Android phone)

### Edge Cases

- Very long messages (test text wrapping)
- Very long conversations (test scroll behavior)
- Rapid navigation between entities
- Rapid open/close of panel
- Network errors during Maxwell requests
- localStorage quota exceeded
- Entities with missing names or descriptions

## Implementation Notes

### Reusing Existing Components

The design maximizes code reuse:

- **useMaxwell hook**: Used as-is, no modifications needed
- **MaxwellPanel layout**: Adapted from existing MaxwellPanel.tsx
- **Message rendering**: Reuses existing MessageBubble component logic
- **Trace display**: Reuses existing trace rendering logic

### New Components to Create

1. **GlobalMaxwellFAB**: New component for floating action button
2. **GlobalMaxwellPanel**: Adapted from MaxwellPanel with context switching
3. **PrismIcon**: New SVG icon component
4. **useMaxwellStorage**: New hook for localStorage management
5. **useEntityContext**: New hook for URL-based context detection

### Components to Modify

1. **UnifiedActionDialog**: Remove MaxwellPanel import and usage
2. **ToolDetails**: Remove MaxwellPanel import and usage
3. **StockDetails**: Remove MaxwellPanel import and usage
4. **App.tsx**: Add GlobalMaxwellFAB to layout (conditionally rendered)

### Tailwind CSS Classes

Key responsive classes:
- `fixed bottom-4 right-4 z-50` - FAB positioning
- `max-md:bottom-0 max-md:h-[90vh]` - Mobile bottom sheet
- `md:right-0 md:h-full md:w-[40%]` - Desktop side panel
- `lg:w-[35%]` - Large desktop width

### localStorage Schema

```typescript
// Key format
const key = `maxwell_${entityType}_${entityId}`;

// Value format
const value: ConversationData = {
  entityId: "uuid-here",
  entityType: "action",
  messages: [...],
  lastAccessed: Date.now()
};

// LRU tracking
const lruKey = "maxwell_lru_order";
const lruValue: string[] = ["key1", "key2", "key3", "key4", "key5"];
```

### Animation Implementation

Use CSS transitions for smooth animations:

```css
.panel-enter {
  transform: translateX(100%); /* or translateY(100%) for mobile */
}

.panel-enter-active {
  transform: translateX(0);
  transition: transform 350ms ease-out;
}

.panel-exit {
  transform: translateX(0);
}

.panel-exit-active {
  transform: translateX(100%);
  transition: transform 350ms ease-in;
}
```

### Accessibility Considerations

- FAB has `aria-label="Open Maxwell Assistant"`
- Panel has `role="dialog"` and `aria-modal="true"`
- Close button has `aria-label="Close Maxwell"`
- Focus trap within panel when open
- Escape key closes panel
- Focus management on open/close

## Future Enhancements

These features are explicitly out of scope for this release but may be considered in future iterations:

1. **List Page Support**: FAB on list pages with general context
2. **Multi-Entity Context**: Ask questions about multiple entities simultaneously
3. **Conversation Search**: Search within conversation history
4. **Export Conversations**: Download conversations as text or PDF
5. **Voice Input**: Speak questions to Maxwell
6. **Conversation Sharing**: Share conversations with team members
7. **Backend Persistence**: Store conversations in database instead of localStorage
8. **Conversation Analytics**: Track most common questions and topics
