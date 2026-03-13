# StarThread - Family Management Application

## Overview
StarThread is a family management application designed to help families organize their lives, plan trips, share moments, and stay connected. It features a unique cosmic/space-themed interface and a relationship-based data model to facilitate family organization and connection, with optional household groupings. The project aims to provide an intuitive and engaging platform for managing family life.

## User Preferences
I want the AI to be concise and to the point. Focus on delivering information efficiently without excessive verbosity. When suggesting code, prioritize functional programming paradigms where applicable. I prefer an iterative development approach, where changes are proposed and discussed before major implementations. Always ask for confirmation before making significant changes to the codebase or architectural decisions. Do not make changes to files in the `src/components/star-view/planets/` directory without explicit instruction.

## System Architecture

### UI/UX Decisions
The application uses a cosmic/space theme with a 3D WebGL "Family Universe" powered by React Three Fiber and Three.js for interactive visualizations. This includes "Universe" and "Galaxy" views where stars represent individuals, color-coded by household. Visuals include volumetric nebula clouds, 2D FBM nebula planes, energy pulse lines for connections, and adaptive quality settings. Navigation features a No Man's Sky-style free-flight camera for galaxies and OrbitControls for system-level views, with warp transitions. Additional visual depth is provided by speed dust particles, parallax nebula wisps, and colored depth-based fog. Background elements follow camera position. The filter panel is collapsible, and empty households are hidden. Star counts are displayed in the top bar.

### Technical Implementations
The application follows a client-server architecture. The backend is built with Express.js and PostgreSQL, handling authentication (session-based, bcrypt, Google OAuth), security (CORS, CSRF, rate limiting, RLS), and data management (auto-migrations, auto-seeding). The frontend is a React application built with Vite, utilizing Radix UI and Tailwind CSS for components, TanStack React Query for state management, and React Router DOM for routing. Core hooks manage user and authentication states.

### Feature Specifications
1.  **Family Universe (3D WebGL)**: Interactive 3D visualization of family relationships with dynamic star rendering, nebula effects, and search/filter capabilities, including protection for minor profiles.
2.  **Onboarding Flow**: A multi-step wizard for new users covering profile setup, adding family members with diverse relationship types, reviewing potential matches, adding trusted contacts, and generating invite links.
3.  **Privacy & Visibility**: Granular controls for privacy levels and per-relationship visibility.
4.  **Relationship Verification**: System for managing pending relationship requests.
5.  **Memorial Flow**: Secure process for memorializing profiles with multi-factor confirmation.
6.  **Trip Planning**: Tools for managing trip logistics (participants, accommodation, activities, budget).
7.  **Love Notes**: Feature for sending gratitude messages.
8.  **Moments**: Sharing of photos and memories.
9.  **Family Stories**: Platform for preserving narratives.
10. **Traditions/Rituals**: Tracking and management of family traditions.
11. **Calendar**: Privacy-aware shared family calendar with scope-based visibility, Google Calendar sync, and client-side recurring event expansion.
12. **Messaging**: Real-time communication with WebSocket delivery, supporting text and image messages.
13. **Star View**: Individual profile page with an OrbitalEngine displaying life aspects, age-based roles, parental controls, and account readiness emails for minors.
14. **Birthdays**: Dedicated page for upcoming and yearly birthday views.
15. **Family Insights**: Data-driven insights on the Home page, contextualized to the user's family graph.
16. **Data Export**: Allows users to export personal data as JSON.
17. **Subscription Model**: Data layer for pricing tiers (Free, Premium Individual, Premium Family, extra seats).
18. **Parental Controls**: Comprehensive feature gating for teen/child accounts, managed by guardians, with server-side enforcement.
19. **Admin System**: Separate admin console for system stats, user management, and support access.
20. **Support Access Tokens**: Privacy-first system allowing users to generate temporary tokens for support access to profile data.
21. **Beta Program**: Allows users to join/leave a beta program, granting full premium features during the beta period and a discount post-beta.
22. **WebGL Error Boundaries**: Robust error handling and retry mechanisms for 3D canvases.
23. **PWA Support**: Installable progressive web app with offline caching and mobile web app capabilities.
24. **Social Platform Linking**: Users can link social media accounts to their profile, with validation and privacy settings.
25. **Policies & Trust Center**: Dedicated `/policies` route for Terms of Service, Privacy Policy, Community Guidelines, Safety Policy, and Beta Program documents.

### System Design Choices
-   The data model is centered on `people` and `relationships`, with optional `households`.
-   Automatic galaxy creation for adults without households.
-   Coming-of-age insights displayed on the Home page.
-   `medical_notes` are segregated to a private user-specific endpoint.
-   API endpoints are categorized by functionality.
-   Data seeding is restricted to development environments.
-   Comprehensive database indexing on frequently queried columns and ON DELETE CASCADE for key foreign keys.
-   Write ownership authorization (`verifyWriteOwnership()`) enforces ownership checks for all writable entities.
-   Session invalidation on password change or reset.
-   Robust input validation for all routes, returning 400 errors for invalid data.
-   Frontend routes use lowercase kebab-case, with automatic conversion from PascalCase page names.
-   An Identity Scoring Engine uses multi-signal probabilistic matching with name similarity, email, birth year, location, family cluster, and relationships.
-   A Person Merge Engine handles merging profiles, relationship deduplication, field provenance tracking, and conflict resolution.
-   Computed Relationship Inference engine traverses up to 3 hops to infer relationships like grandparent, sibling, aunt/uncle, and cousin.
-   Identity routes manage suggestions, merging, and history.
-   A Background Cross-Referencing Engine triggers proactive identity scoring on person creation, updates, relationship confirmations, and periodically.
-   Registration claim suggestions are generated for high-confidence matches during user registration.
-   Identity UI components provide suggested matches, merge dialogs, and family suggestions.
-   New database tables include `person_match_suggestions`, `merge_history`, `merge_conflicts`, and `merged_into_id` on people. `pg_trgm` extension is used for trigram indexing.
-   An API test suite uses Vitest and Supertest for integration testing.
-   GPU resource management ensures proper disposal of Three.js materials and geometries.
-   A unified custom toast system is used for notifications.
-   Form dirty tracking prompts users before discarding unsaved changes.
-   Invite link RLS ensures users can only see their own invite links.
-   PII protection for `linked_user_email`, which is write-only and accessed via a dedicated guardian endpoint.
-   Password minimum length is consistently enforced at 8 characters.
-   Unread message badge on the sidebar, polling every 60 seconds.
-   Birth Year UI allows approximate birth year input when birth_date is empty or for ancestors.
-   Birthday cards link directly to StarView profiles.
-   Universe Membership returns all people within 2 confirmed relationship hops from the user, excluding hidden relationships and dynamically assigning people to virtual clusters if without a household.

## External Dependencies
-   **Database**: PostgreSQL
-   **Backend Framework**: Express.js
-   **Session Management**: `express-session`, `connect-pg-simple`
-   **Password Hashing**: `bcrypt`
-   **File Uploads**: `multer`
-   **WebSocket**: `ws`
-   **Frontend Framework**: React
-   **Build Tool**: Vite
-   **UI Library**: Radix UI
-   **Styling Framework**: Tailwind CSS
-   **State Management**: TanStack React Query
-   **Routing**: React Router DOM v6
-   **3D Graphics**: React Three Fiber, Three.js
-   **Email**: `nodemailer`
-   **Google Calendar**: `googleapis`
-   **Testing**: `vitest`, `supertest`
-   **Mobile Bottom Sheet**: `vaul`