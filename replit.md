# StarThread - Family Management Application

## Overview
StarThread is a family management application designed to help families organize their lives, plan trips, share moments, and stay connected. It features a unique cosmic/space-themed interface and a relationship-based data model to facilitate family organization and connection, with optional household groupings. The project aims to provide an intuitive and engaging platform for managing family life.

## User Preferences
I want the AI to be concise and to the point. Focus on delivering information efficiently without excessive verbosity. When suggesting code, prioritize functional programming paradigms where applicable. I prefer an iterative development approach, where changes are proposed and discussed before major implementations. Always ask for confirmation before making significant changes to the codebase or architectural decisions. Do not make changes to files in the `src/components/star-view/planets/` directory without explicit instruction.

## System Architecture

### UI/UX Decisions
The application employs a cosmic/space theme with a 3D WebGL "Family Universe" powered by React Three Fiber and Three.js. This includes "Universe" and "Galaxy" views, where stars represent individuals, color-coded by household, and memorial stars have special effects. Visuals include distributed volumetric nebula clouds (`DistributedNebulaClouds` with `VolumetricCloudPocket` ray-marched meshes scattered around household clusters), `SystemAura` (per-galaxy 2D FBM nebula plane), energy pulse lines for connections, and adaptive quality settings with localStorage persistence. Galaxy-level navigation uses a No Man's Sky style free-flight camera (`FreeFlightControls`) with WASD velocity-based movement (smooth acceleration/deceleration/momentum), drag-to-look mouse controls, scroll-wheel speed adjustment, camera sway, and FOV widening at speed. System-level view uses OrbitControls. Warp transitions use quaternion slerp animation between views. Additional visual depth includes `SpeedDust` particles near the camera during movement, `ParallaxNebulaWisps` at multiple depth layers, and colored depth-based fog. Background elements (NebulaBackground, BackgroundStarField) follow the camera position. The filter panel is collapsible and completely hides (not dims) filtered-out galaxies. Empty households (0 members) are hidden from rendering. Star count is shown in the top bar. Home page "Stars in Family" counts only people related to the user.

### Technical Implementations
The application follows a client-server architecture:
-   **Backend**: Express.js with PostgreSQL, handling authentication (session-based, bcrypt, Google OAuth), security (CORS, CSRF, rate limiting, RLS), and data management (auto-migrations, auto-seeding).
-   **Frontend**: React with Vite, utilizing Radix UI and Tailwind CSS for components, TanStack React Query for state, and React Router DOM for routing. Core hooks like `useMyPerson` and `useAuth` manage user and authentication states.

### Feature Specifications
1.  **Family Universe (3D WebGL)**: Interactive 3D visualization of family relationships with dynamic star rendering, nebula effects, and search/filter, including protective measures for minor profiles.
2.  **Onboarding Flow**: 5-step wizard for new users: (1) Profile setup (birthday required, city/state optional, auto-populates birth_year), (2) Add family (18 relationship types including grandparent, step-parent, half-sibling, guardian, godparent, chosen family; captures middle name, birth year, city, state), (3) Review Matches with link/dismiss actions (auto-skips if no medium+ confidence matches via identity scoring), (4) Trusted contacts, (5) Per-member invite links with relationship-specific types.
3.  **Privacy & Visibility**: Granular control over privacy levels and per-relationship visibility.
4.  **Relationship Verification**: System for managing pending relationship requests.
5.  **Memorial Flow**: Secure process for memorializing profiles requiring multi-factor confirmation.
6.  **Trip Planning**: Comprehensive tools for managing trip logistics (participants, accommodation, activities, budget).
7.  **Love Notes**: Feature for sending gratitude messages.
8.  **Moments**: Sharing of photos and memories.
9.  **Family Stories**: Platform for preserving narratives.
10. **Traditions/Rituals**: Tracking and management of family traditions.
11. **Calendar**: Privacy-aware shared family calendar with scope-based visibility, supporting Google Calendar sync and client-side recurring event expansion.
12. **Messaging**: Real-time communication with WebSocket delivery, supporting text and image messages, and mobile-responsive layouts.
13. **Star View**: Individual profile page with an OrbitalEngine displaying various life aspects. Includes age-based role types, parental controls for minors, and a secure process for account readiness emails for children turning 13.
14. **Birthdays**: Dedicated page for upcoming and yearly birthday views.
15. **Family Insights**: Data-driven insights on the Home page, contextualized to the user's family graph.
16. **Data Export**: Allows users to export their personal data as JSON.
17. **Subscription Model**: Implemented data layer for pricing tiers (Free, Premium Individual, Premium Family, extra seats) without integrated billing.
18. **Parental Controls**: Comprehensive feature gating for teen/child accounts, managed by guardians, with server-side enforcement.
19. **Admin System**: Separate admin console for system stats, user management, household listing, and support access, protected by admin authentication.
20. **Support Access Tokens**: Privacy-first system allowing users to generate temporary tokens for support access to their profile data.
21. **Beta Program**: Allows users to join/leave a beta program, granting full premium features during the beta period and a discount post-beta.
22. **WebGL Error Boundaries**: Provides robust error handling and retry mechanisms for 3D canvases.
23. **PWA Support**: Installable progressive web app with offline caching and mobile web app capabilities.
24. **Social Platform Linking**: Users can link/unlink social media accounts (Facebook, X/Twitter, Instagram, LinkedIn, TikTok, YouTube) to their profile. Stored as JSONB `social_links` on the `people` table. Handles/URLs validated on both client and server. Displayed on Profile page and StarView, respecting privacy settings.
25. **Policies & Trust Center**: Dedicated `/policies` route with 5 trust & safety documents (Terms of Service, Privacy Policy, Community Guidelines, Safety Policy, Beta Program). Linked from Settings > Policies tab. Each document has its own detail page at `/policies/:policyKey`.

### System Design Choices
-   Data model centered on `people` and `relationships`, with optional `households`. Auto-computes `name` from `first_name`, `middle_name`, `last_name`.
-   **Auto-galaxy creation**: Adults without a household automatically get one, managed by server-side helpers.
-   **Coming-of-age insights**: Home page displays insights for family members approaching or recently turning 18.
-   `medical_notes` are segregated to a private user-specific endpoint.
-   API endpoints are categorized for specific functionalities.
-   **Seeding**: Data seeding is restricted to development environments.
-   **Database Indexes**: Comprehensive indexes on frequently queried columns (people.household_id, people.user_id, relationships.related_person_id, composite indexes on relationships(person_id, relationship_type), etc.). ON DELETE CASCADE on key foreign keys (relationships, love_notes, trip_participants). `expenses.paid_by` uses SET NULL.
-   **Write Ownership Authorization**: `verifyWriteOwnership()` in `server/routes/entities.js` enforces ownership checks on all writable entity tables (trips, moments, stories, rituals, trusted_contacts, people, households, etc.). Only system admins (`users.role = 'admin'`) bypass RLS checks. No "family admin" concept — all adults are equal. Creators of deceased/memorial profiles get permanent edit rights via `created_by_user_id`.
-   **Session Invalidation**: Password change invalidates all other sessions (keeps current). Password reset invalidates all sessions.
-   **Input Validation**: Calendar routes validate date format, array types, boolean fields, and visibility values (400 errors). Generic entity routes catch PostgreSQL type-mismatch errors (22P02, 22007, 22003) and return 400 instead of 500.
-   **Frontend Routes**: All routes use lowercase kebab-case (e.g., `/family-stories`, `/love-notes`, `/trip-detail`). `createPageUrl()` in `src/utils/index.ts` auto-converts PascalCase page names to kebab-case.
-   **Identity Scoring Engine**: Multi-signal probabilistic matching (`server/identityScoring.js`) with name similarity (35%), email (25%), birth year (15%), location (10%), family cluster (10%), relationships (5%). Returns score, confidence level, breakdown, and human-readable explanations. Email exact match overrides to 95+. `findCandidates()` uses pg_trgm trigram index.
-   **Person Merge Engine**: `server/mergeEngine.js` handles merge with relationship dedup/transfer, field provenance tracking, soft-delete via `merged_into_id`. Two-claimed merges create `merge_conflicts` record requiring admin review.
-   **Computed Relationship Inference**: `server/relationshipInference.js` traverses up to 3 hops to infer grandparent, sibling, aunt/uncle, cousin, in-law relationships. Labeled `source: 'inferred'`, never auto-stored. Endpoint: `GET /api/relationships/inferred/:personId`.
-   **Identity Routes**: `server/routes/identity.js` — suggestions CRUD (`GET /api/identity/suggestions`, `POST .../accept`, `POST .../dismiss`), family suggestions (`GET /api/identity/family-suggestions`), merge (`POST /api/identity/merge`), history (`GET /api/identity/merge-history`).
-   **Background Cross-Referencing Engine**: `server/scoringTriggers.js` — proactive identity scoring triggers: `scoreNewPerson` (on person creation), `rescorePerson` (on profile update), `rescoreNeighbors` (on relationship confirmation), `rescoreForUser` (for user-centric scoring), `periodicRescore` (6-hour interval job for pending low-score suggestions), `scoreFamilySuggestions` (family member suggestions). Wired into entity routes (POST/PATCH Person) and relationship verification. All triggers fire-and-forget (non-blocking).
-   **Registration Claim Suggestions**: `POST /api/auth/register` generates claim suggestions for high-confidence matches against unclaimed people.
-   **Identity UI Components**: `src/components/identity/SuggestedMatches.jsx` (Home page), `src/components/identity/MergePersonDialog.jsx` (Settings page), `src/components/identity/FamilySuggestions.jsx` (Family page list view — "People you might know"), `MatchIndicator` (StarView — subtle match badge for unclaimed profiles).
-   **New Tables**: `person_match_suggestions` (with UNIQUE on user+person), `merge_history`, `merge_conflicts`; `merged_into_id` column on people; pg_trgm extension + trigram index on `people.name`.
-   **API Tests**: Integration test suite using Vitest + Supertest (`server/__tests__/api.test.js`). Run with `npm test`. Covers auth, entity CRUD, ownership, beta, admin, onboarding, identity scoring, search, claim suggestions, merge workflow, and computed relationship inference.
-   **GPU Resource Management**: 3D components manage Three.js material and geometry disposal to prevent memory leaks.
-   **Toast System**: Unified custom toast system for all notifications.
-   **Form Dirty Tracking**: Implemented for forms to track unsaved changes and prompt users before discarding.
-   **Invite Link RLS**: `buildRlsClause` now filters invite_links to `created_by_person_id` (read-level RLS), preventing users from reading other users' invite links.
-   **PII Protection**: `linked_user_email` removed from Person entity columns (not returned in GET responses). Write-only via `WRITE_ONLY_COLUMNS` map. Guardians access child email via dedicated `GET /api/entities/guardian/:wardPersonId/linked-email` endpoint.
-   **Password Minimum Length**: Consistently enforced at 8 characters across all endpoints (auth register, change password, reset password, admin reset).
-   **Unread Message Badge**: Sidebar "Messages" nav item shows amber badge with unread count, polling every 60s.
-   **Birth Year UI**: PersonForm shows "Birth Year (approximate)" number input when birth_date is empty or role_type is 'ancestor'. Auto-syncs from birth_date when set.
-   **Birthday Links**: Birthday cards now link to `/star/:personId` (StarView) instead of `/family`.
-   **Universe Membership (2-Degree Graph)**: `GET /api/relationships/universe-members` returns all people within 2 confirmed relationship hops from the user. Family page uses this instead of listing all people. People without households are assigned to their closest connected household's galaxy or a "Connected Family" virtual cluster. `computeHouseholdEdges` handles cross-household edges for all relationship types (not just parent/child). Visibility settings respected.

## External Dependencies
-   **Database**: PostgreSQL
-   **Backend Framework**: Express.js
-   **Session Management**: `express-session`, `connect-pg-simple`
-   **Password Hashing**: `bcrypt`
-   **File Uploads**: `multer` (with Replit App Storage for GCS presigned URLs)
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