# Implementation Plan: User Profile Page

## Overview

Create a dedicated User Profile Page at `/user/:userId` that consolidates user-specific content (starting with ProfileSkillsSection) into an extensible personal hub. Add a Dashboard navigation card for discoverability and remove ProfileSkillsSection from the Organization page. All changes are frontend-only, using existing components and patterns.

## Tasks

- [x] 1. Create the UserProfile page component
  - [x] 1.1 Create `src/pages/UserProfile.tsx` with page layout and header
    - Create the new file with a default export `UserProfile` function component
    - Use `useParams()` to extract `userId` from the URL
    - Use `useNavigate()` for back-navigation to Dashboard
    - Use `useProfile()` to get `fullName`, `organizationId`, and `isLoading`
    - Use `useAuth()` to get `user.userId` for document title logic
    - Render a header with a back button (ArrowLeft icon + "Back to Dashboard") and page title
    - Page title: display the profile user's first name (e.g., "Stefan"); fall back to "Profile" if unavailable
    - Set `document.title` to `"{firstName}'s Profile | Asset Tracker"` when viewing own profile; fall back to `"My Profile | Asset Tracker"`
    - Use `min-h-screen bg-background` container and single-column `max-w-xl space-y-6` card stack layout matching the Settings page pattern
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 1.2 Integrate ProfileSkillsSection and handle loading/error states
    - Import and render `ProfileSkillsSection` with `userId` (from URL param) and `organizationId` (from `useProfile()`)
    - Show a loading spinner (Loader2 icon + "Loading profile..." text) while `useProfile().isLoading` is true
    - Show an informational Alert when `organizationId` is unavailable after loading completes: "Organization data is required to display profile skills. Please ensure you belong to an organization."
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.1, 6.2, 6.3_

  - [ ]* 1.3 Write unit tests for UserProfile page component
    - Test that the page renders a header with a back button
    - Test that the page title shows the user's first name when available
    - Test fallback to "Profile" when name is unavailable
    - Test document title is set to "{firstName}'s Profile | Asset Tracker"
    - Test document title falls back to "My Profile | Asset Tracker"
    - Test that ProfileSkillsSection receives correct `userId` and `organizationId` props
    - Test loading state is shown while organization context resolves
    - Test informational message when organization context is unavailable
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.3, 3.4_

- [x] 2. Checkpoint - Verify UserProfile page renders correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Add the `/user/:userId` route to App.tsx
  - [x] 3.1 Register the new route in `src/App.tsx`
    - Add `import UserProfile from "./pages/UserProfile"` to the imports
    - Add a new `<Route path="/user/:userId" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />` entry before the catch-all `*` route
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ]* 3.2 Write unit tests for route configuration
    - Test that `/user/:userId` renders UserProfile within ProtectedRoute
    - Test that unauthenticated access redirects to `/auth`
    - _Requirements: 1.1, 1.3_

- [x] 4. Add the Profile navigation card to Dashboard
  - [x] 4.1 Add Profile card to `src/pages/Dashboard.tsx`
    - Import `User` icon from lucide-react (already available in the import list)
    - Use `useProfile()` hook to get `fullName` for the card title
    - Insert a new entry into the `menuItems` array immediately before the "Organization Settings" entry
    - Card config: `{ title: firstName || "My Profile", description: "View and manage your skills and profile", icon: User, path: \`/user/${user?.userId}\`, color: "bg-purple-500" }`
    - The card must be visible to all authenticated users (no role filtering)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 4.2 Write unit tests for Dashboard Profile card
    - Test that the Profile card appears in the navigation grid for all authenticated users
    - Test card title shows user's first name when available
    - Test card title falls back to "My Profile" when name unavailable
    - Test card navigates to `/user/{currentUserId}` on click
    - Test Profile card appears before Organization Settings card in the grid
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

- [x] 5. Remove ProfileSkillsSection from Organization page
  - [x] 5.1 Clean up `src/pages/Organization.tsx`
    - Remove the `import { ProfileSkillsSection } from '@/components/ProfileSkillsSection'` statement
    - Remove the JSX block that renders `<ProfileSkillsSection userId={user.userId} organizationId={targetOrganization.id} />`
    - Verify all other sections remain intact: Organization Details, Organization Values, AI Scoring Prompts, AI Configuration, Lens Management, Roles & Permissions, Invitation Management, Organization Members
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 5.2 Write unit tests for Organization page cleanup
    - Test that ProfileSkillsSection is not rendered on the Organization page
    - Test that all other Organization sections continue to render correctly
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The design explicitly states property-based testing is not applicable (UI composition only)
- All code uses TypeScript + React, matching the existing project stack
- The `useProfile` hook already exists and provides `fullName`, `organizationId`, and `isLoading`
- The `ProfileSkillsSection` component is reused as-is with no modifications
- The `User` icon from lucide-react is already imported in Dashboard.tsx
