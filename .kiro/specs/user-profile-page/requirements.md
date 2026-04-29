# Requirements Document

## Introduction

The User Profile Page introduces a dedicated personal hub for each user at `/user/:userId`. Currently, profile-level skills (ProfileSkillsSection) live on the Organization Settings page, which is restricted to leadership roles. Since skills are personal to each individual, they should be accessible to everyone. This feature creates a new page that starts with the Profile Skills section and is designed to grow into a comprehensive personal hub with future sections such as payroll, growth dashboards, and impact metrics. A Dashboard navigation card makes the page discoverable to all authenticated users.

## Glossary

- **User_Profile_Page**: A React page component rendered at `/user/:userId` that displays personal profile information and skills for the specified user.
- **Dashboard**: The main landing page (`/`) that displays navigation cards to various sections of the application.
- **Profile_Card**: A navigation card on the Dashboard that links the current user to their own User Profile Page.
- **ProfileSkillsSection**: An existing React component that manages profile-level skills including creation, AI-generated concept axes, active/inactive toggling, and deletion. Accepts `userId` and `organizationId` props.
- **Organization_Page**: The existing Organization Settings page at `/organization` restricted to leadership roles, which currently renders the ProfileSkillsSection.
- **Router**: The React Router v7 configuration in `src/App.tsx` that defines application routes and their access controls.
- **ProtectedRoute**: An existing route wrapper component that ensures only authenticated users can access a route.

## Requirements

### Requirement 1: User Profile Page Route

**User Story:** As a developer, I want a new route at `/user/:userId` so that each user has a dedicated URL for their personal profile page.

#### Acceptance Criteria

1. WHEN a user navigates to `/user/:userId`, THE Router SHALL render the User_Profile_Page component within a ProtectedRoute wrapper.
2. THE Router SHALL extract the `userId` parameter from the URL path and pass it to the User_Profile_Page component.
3. WHEN an unauthenticated user navigates to `/user/:userId`, THE ProtectedRoute SHALL redirect the user to the authentication page.

### Requirement 2: User Profile Page Layout

**User Story:** As a user, I want a well-structured profile page so that I can view and manage my personal information in one place.

#### Acceptance Criteria

1. THE User_Profile_Page SHALL display a header with a back-navigation button that returns the user to the Dashboard.
2. THE User_Profile_Page SHALL display a page title using the profile user's first name (e.g., "Stefan") when viewing their profile. IF the name is unavailable, THE page title SHALL fall back to "Profile".
3. WHEN the current user views their own profile, THE User_Profile_Page SHALL set the document title to "{firstName}'s Profile | Asset Tracker". IF the name is unavailable, THE document title SHALL be "My Profile | Asset Tracker".
4. THE User_Profile_Page SHALL use a single-column layout with vertically stacked sections, consistent with the existing Settings page layout pattern.

### Requirement 3: Profile Skills Section Integration

**User Story:** As a user, I want to see and manage my profile skills on my personal profile page so that I can access them without needing leadership permissions.

#### Acceptance Criteria

1. THE User_Profile_Page SHALL render the existing ProfileSkillsSection component, passing the `userId` from the URL parameter and the current user's `organizationId`.
2. WHEN the User_Profile_Page loads, THE ProfileSkillsSection SHALL display the skills belonging to the user identified by the `userId` URL parameter.
3. THE User_Profile_Page SHALL display a loading indicator while the organization context is being resolved.
4. IF the organization context is unavailable, THEN THE User_Profile_Page SHALL display an informational message indicating that organization data is required.

### Requirement 4: Remove ProfileSkillsSection from Organization Page

**User Story:** As a product owner, I want the ProfileSkillsSection removed from the Organization page so that profile skills are managed exclusively on the User Profile Page.

#### Acceptance Criteria

1. THE Organization_Page SHALL NOT render the ProfileSkillsSection component.
2. THE Organization_Page SHALL remove the import statement for ProfileSkillsSection.
3. WHEN a leadership user visits the Organization_Page, THE Organization_Page SHALL continue to display all other existing sections (Organization Details, Organization Values, AI Scoring Prompts, AI Configuration, Lens Management, Roles & Permissions, Invitation Management, Organization Members) without changes.

### Requirement 5: Dashboard Navigation Card

**User Story:** As a user, I want a "My Profile" card on the Dashboard so that I can easily navigate to my personal profile page.

#### Acceptance Criteria

1. THE Dashboard SHALL display a Profile_Card with the title set to the current user's first name (e.g., "Stefan") and a description of "View and manage your skills and profile".
2. IF the user's display name is not available, THE Profile_Card SHALL fall back to "My Profile" as the title.
3. THE Dashboard SHALL display the Profile_Card to all authenticated users regardless of their role.
4. WHEN a user clicks the Profile_Card, THE Dashboard SHALL navigate to `/user/{currentUserId}` where `{currentUserId}` is the authenticated user's own user ID.
5. THE Profile_Card SHALL use a user-themed icon consistent with the existing Dashboard card design pattern.
6. THE Profile_Card SHALL appear before the "Organization Settings" card in the Dashboard grid layout.

### Requirement 6: Extensible Page Structure

**User Story:** As a developer, I want the User Profile Page to be structured for extensibility so that future sections (payroll, growth dashboards, impact metrics) can be added without restructuring the page.

#### Acceptance Criteria

1. THE User_Profile_Page SHALL organize content into discrete, independently renderable section components within a vertical stack layout.
2. THE User_Profile_Page SHALL use the same Card-based section pattern used by the existing Settings and Organization pages.
3. WHEN a new section is added to the User_Profile_Page, THE User_Profile_Page SHALL require only the addition of a new section component in the vertical stack without modifying existing sections.
