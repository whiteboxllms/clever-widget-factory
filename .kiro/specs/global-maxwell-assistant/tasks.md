# Implementation Plan: Global Maxwell Assistant

## Overview

This implementation transforms Maxwell from a dialog-embedded assistant into a globally accessible FAB (Floating Action Button) with contextual AI assistance on entity detail pages. The implementation reuses the existing `useMaxwell` hook and adapts the existing `MaxwellPanel` component, adding localStorage-based conversation persistence with LRU eviction.

## Tasks

- [ ] 1. Create PrismIcon component
  - Create `src/components/icons/PrismIcon.tsx` with custom SVG icon
  - Icon represents entropy reduction (geometric prism with gradient)
  - Accept `className` and `size` props for flexibility
  - _Requirements: 1.8_

- [ ] 2. Create useMaxwellStorage hook for conversation persistence
  - [ ] 2.1 Implement localStorage management with LRU eviction
    - Create `src/hooks/useMaxwellStorage.ts`
    - Implement `saveConversation`, `loadConversation`, `clearConversation` functions
    - Storage key format: `maxwell_${entityType}_${entityId}`
    - Track `lastAccessed` timestamp for LRU eviction
    - Maintain maximum 5 conversations, evict oldest when limit exceeded
    - Handle localStorage errors (QuotaExceededError, SecurityError) with graceful fallback
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6_

- [ ] 3. Create useEntityContext hook for URL-based context detection
  - [ ] 3.1 Implement context detection from URL
    - Create `src/hooks/useEntityContext.ts`
    - Use React Router's `useLocation` and `useParams` hooks
    - Extract entity information from URL patterns:
      - Actions: `/actions/:actionId`
      - Tools: `/combined-assets?view=tools&id=:toolId`
      - Parts: `/combined-assets?view=stock&id=:partId`
    - Return `EntityContext` object or null if not on entity detail page
    - Fetch entity name, policy, and implementation from appropriate API endpoints
    - _Requirements: 1.1, 1.2, 1.3, 3.1_

- [ ] 4. Create GlobalMaxwellFAB component
  - [ ] 4.1 Implement floating action button
    - Create `src/components/GlobalMaxwellFAB.tsx`
    - Use `useEntityContext` hook to detect if on entity detail page
    - Render FAB only when context is available (entity detail pages)
    - Position fixed at bottom-right corner with Tailwind classes
    - Display PrismIcon component
    - Handle click to open panel and capture current context
    - Add keyboard support (Enter key to open)
    - Add aria-label for accessibility
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 7.4_

- [ ] 5. Create GlobalMaxwellPanel component
  - [ ] 5.1 Adapt MaxwellPanel for global context
    - Create `src/components/GlobalMaxwellPanel.tsx` based on existing `MaxwellPanel.tsx`
    - Accept `open`, `onOpenChange`, and `context` props
    - Implement responsive layout with Tailwind breakpoints:
      - Desktop (≥1024px): side panel from right, 30-40% width, backdrop overlay
      - Mobile (<768px): bottom sheet, full-screen, swipe-down to close
    - Display entity name in panel header
    - Add "Switch to current page" button (updates context to currently viewed entity)
    - Add "Clear conversation" button (resets conversation for current entity)
    - Integrate `useMaxwellStorage` to save/load conversations
    - Preserve all existing features: starter questions, inline images, trace display, clipboard operations
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 6.13, 6.14_

  - [ ] 5.2 Implement animations and accessibility
    - Add CSS transitions for slide-in/slide-out (300-400ms)
    - Implement focus management: move focus to input on open, return to FAB on close
    - Add keyboard support: Tab navigation, Escape to close
    - Add ARIA attributes: role="dialog", aria-modal="true"
    - Implement focus trap within panel when open
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7_

- [ ] 6. Remove Maxwell from dialogs
  - [ ] 6.1 Remove Maxwell from UnifiedActionDialog
    - Open `src/components/UnifiedActionDialog.tsx`
    - Remove MaxwellPanel import and component usage
    - Remove "Ask Maxwell" button if present
    - Remove Maxwell-related state and handlers
    - _Requirements: 5.1, 5.4, 5.5, 5.6_

  - [ ] 6.2 Remove Maxwell from ToolDetails dialog
    - Open `src/components/tools/ToolDetails.tsx`
    - Remove MaxwellPanel import and component usage
    - Remove "Ask Maxwell" button if present
    - Remove Maxwell-related state and handlers
    - _Requirements: 5.2, 5.4, 5.5, 5.6_

  - [ ] 6.3 Remove Maxwell from StockDetails dialog
    - Open `src/components/StockDetails.tsx`
    - Remove MaxwellPanel import and component usage
    - Remove "Ask Maxwell" button if present
    - Remove Maxwell-related state and handlers
    - _Requirements: 5.3, 5.4, 5.5, 5.6_

- [ ] 7. Integrate GlobalMaxwellFAB into app layout
  - [ ] 7.1 Add GlobalMaxwellFAB to App.tsx
    - Open `src/App.tsx`
    - Import GlobalMaxwellFAB component
    - Add GlobalMaxwellFAB to the layout (renders conditionally based on route)
    - Ensure FAB appears on entity detail pages only
    - _Requirements: 1.1, 1.2, 1.3, 8.1_

- [ ] 8. Checkpoint - Manual testing and verification
  - Test FAB visibility on action, tool, and part detail pages
  - Test FAB does NOT appear on login, settings, dashboard, or list pages
  - Test responsive layouts (desktop side panel, mobile bottom sheet)
  - Test context detection and switching
  - Test conversation persistence (save, load, clear)
  - Test LRU eviction (create 6 conversations, verify oldest is evicted)
  - Test all existing Maxwell features (starter questions, images, trace, clipboard)
  - Test keyboard accessibility (Tab, Enter, Escape)
  - Test on multiple browsers (Chrome, Safari, Firefox, Edge)
  - Test on multiple devices (desktop, tablet, mobile)
  - Verify Maxwell removed from all dialogs

## Notes

- No unit tests required per requirements (manual testing only)
- Reuses existing `useMaxwell` hook without modification
- Adapts existing `MaxwellPanel.tsx` component structure
- Uses localStorage for persistence (no backend changes)
- All tasks reference specific requirements for traceability
- Checkpoint task ensures comprehensive manual testing before completion
