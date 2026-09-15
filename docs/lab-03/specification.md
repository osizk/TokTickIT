# Lab 3 Sprint Engineering Specification

## 1. Sprint Goal

TokTickIT will replace the temporary Lab 2 Development Requester selector with secure authenticated accounts and backend-enforced role authorization. Authenticated Requesters keep their existing Ticket and Attachment experience and gain Public Comments and a non-authoritative problem-resolution indication. IT Staff and Administrators receive a shared operational Ticket workflow, while Administrators also receive a deliberately small User Management screen. Existing Lab 2 records, ownership, protected files, Zen Green conventions, accessibility, and responsive behavior must survive the increment.

## 2. Stakeholder Request

The stakeholder needs real users who sign in with an email address and password. An account using an initial password must change it before entering the application. Requesters must continue working with their own Tickets. IT Staff need a queue and detail workflow for finding, assigning, prioritizing, communicating about, and progressing Tickets. Administrators need simple user-account management. Hiding a control is not authorization; every protected operation must be checked by the backend.

## 3. Scope

### Included

- Login, logout, current-user retrieval, server-side sessions, password hashing, and mandatory first-login password change.
- Roles `REQUESTER`, `IT_STAFF`, and `ADMINISTRATOR`, with one role per User and backend role checks.
- Data-preserving migration from Lab 2 `Requester` identity to `User` identity.
- Authenticated continuation of all Lab 2 Requester Ticket and Attachment operations, with no client-supplied ownership ID.
- Public Comments, Internal Notes, and Requester `Problem Appears Resolved` indication.
- IT Staff/Administrator Ticket Queue and Ticket Detail operations, including assignment, IT Priority, status workflow, and Attachment continuity.
- Minimal Administrator User Management: list/search/role filter, create, edit, activation, one-role assignment, and new initial password.
- Idempotent role/Ticket/comment/note seed data, full tests, responsive/accessibility/visual evidence, and release traceability.

### Explicitly excluded

Self-registration; email invitations or password-reset email; MFA, SSO, and social login; multiple roles; departments/organizations/profile photos; user deletion, bulk operations, import/export, account history, advanced recovery/unlocking; Actions Taken; formal SLA/escalation/notifications; dashboards/KPIs beyond queue counts; public/internal entry editing or deletion; production/cloud deployment; and multi-tenant administration.

## 4. Functional Requirements

### 4.1 Roles and Authorization Matrix

The backend is authoritative. The Administrator staff permissions below are an explicit Sprint 3 decision: the labsheet makes Administrators eligible Ticket Owners and visible to Public Comments/Internal Notes. User Management remains a separate Administrator responsibility and screen.

| Operation | Requester | IT Staff | Administrator |
|---|---:|---:|---:|
| Login, current user, change own password, logout | Yes | Yes | Yes |
| Create Ticket | Own identity | No | No |
| List/open Requester Tickets | Own only | All through staff queue | All through staff queue |
| Add/remove Attachment | Own Ticket only | No | No |
| List/download Attachment | Own Ticket only | All permitted Tickets | All permitted Tickets |
| View/post Public Comments | Own Ticket only | All permitted Tickets | All permitted Tickets |
| View/create Internal Notes | No | Yes | Yes |
| Indicate a problem appears resolved | Own Ticket only | No | No |
| Queue search/filter/sort/page | No | Yes | Yes |
| Claim/assign/reassign Ticket | No | Yes | Yes |
| Change IT Priority/status | No | Yes | Yes |
| List/create/edit/deactivate Users | No | No | Yes |
| Set another User's new initial password | No | No | Yes |

Unauthenticated requests return safe `401`. Authenticated wrong-role requests return safe `403` unless that would reveal a protected resource. Missing and inaccessible Tickets, Attachments, comments, and notes use the same safe `404`. User identity, ownership, author, role, status, and timestamps come from the session/backend, never from a Requester body field.

### 4.2 Functional Requirements

- **FR-01 Authentication:** An active User with valid credentials can establish an authenticated server session; invalid and inactive credentials receive the same safe failure.
- **FR-02 First login:** A User marked `mustChangePassword` cannot access normal application screens or APIs until a valid new password is saved.
- **FR-03 Session lifecycle:** The API supports current-user retrieval, idle/absolute expiry, logout invalidation, password-change rotation, reset revocation, and inactive-user rejection.
- **FR-04 Role authorization:** Navigation is role-specific, but every protected endpoint independently enforces the authorization matrix.
- **FR-05 Identity migration:** Existing Requester IDs, names, active state, Ticket ownership, Attachment metadata, removal links, and protected bytes remain valid after migration.
- **FR-06 Authenticated Requester:** The temporary selector, Change Requester action, requester `sessionStorage`, and `X-Requester-Id` ownership trust are removed. Requester Ticket APIs derive identity from the authenticated session.
- **FR-07 Requester Ticket continuity:** An authenticated Requester can create, list, inspect, add/download/remove permitted Attachments, and receive the Lab 2 safe ownership behavior.
- **FR-08 Requester communication:** A Requester can append a Public Comment and indicate that an owned active Ticket appears resolved without formally changing its status.
- **FR-09 Staff queue:** IT Staff and permitted Administrators can search, filter, sort, paginate, and open Tickets in a shared queue.
- **FR-10 Staff detail:** Permitted staff roles can claim, assign, reassign, unassign, set IT Priority, and apply the approved status-transition matrix.
- **FR-11 Communication privacy:** Public Comments are visible to Requesters, IT Staff, and Administrators; Internal Notes are visible only to IT Staff and Administrators.
- **FR-12 Append-only entries:** Comments and notes record authenticated author and backend creation time and cannot be edited or deleted in Lab 3.
- **FR-13 User Management:** Administrators can list/search/filter, create, edit, activate/deactivate, and set a new initial password for Users.
- **FR-14 Administrator safety:** Duplicate emails, invalid roles, self-deactivation, and removal of the last active Administrator are rejected safely and transactionally.
- **FR-15 Seed and migration:** Development/test data is realistic, idempotent, local-only, and does not overwrite user-created records or secrets.
- **FR-16 Safe errors:** APIs return structured status/code/message/field errors without hashes, credentials, storage paths, internal stack traces, or existence leaks.
- **FR-17 UI quality:** All required screens use the Lab 2 Zen Green system, accessible labels/focus, field validation, feedback states, and desktop/tablet/mobile layouts without horizontal page scrolling.
- **FR-18 Traceability:** Every functional requirement, business rule, and acceptance criterion maps to a planned Test ID and actual file path, and final evidence is captured from the tested release candidate/final `main`.

## 5. Business Rules

- **BR-01:** Only an active User with valid credentials may authenticate.
- **BR-02:** Email is trimmed/lowercased and unique; a duplicate normalized email is a `409`.
- **BR-03:** Passwords are 12-128 characters, contain upper/lower/number/symbol, reject leading/trailing whitespace, and are stored only as Argon2id hashes.
- **BR-04:** A password change must include the current password, a different valid new password, and matching confirmation.
- **BR-05:** Five failed attempts for a normalized-email/source-address key in 15 minutes cause a 15-minute temporary block and `429`; success clears the bucket.
- **BR-06:** Session cookies are opaque, `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` outside local HTTP. Tokens are never placed in browser storage.
- **BR-07:** Authenticated unsafe requests require the session-bound `X-CSRF-Token` and accepted Origin; credentialed CORS allows only the configured client origin.
- **BR-08:** A `mustChangePassword` User can use only current-user, change-password, and logout behavior until the change succeeds.
- **BR-09:** Logout, password reset, password change, expiry, revocation, or deactivation invalidates the appropriate session access.
- **BR-10:** A User has exactly one role: `REQUESTER`, `IT_STAFF`, or `ADMINISTRATOR`.
- **BR-11:** Requester ownership comes only from the session; `requesterId` is never accepted from a Ticket body or multipart field.
- **BR-12:** A Ticket has zero or one active primary owner, who must be an active IT Staff or Administrator.
- **BR-13:** Requested Priority is immutable after creation; IT Priority initially copies it and is changed only by IT Staff/Administrator.
- **BR-14:** A Requester cannot formally set `RESOLVED`, `CLOSED`, or any other staff status.
- **BR-15:** Statuses are `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, and `CANCELLED`.
- **BR-16:** Allowed transitions are: `NEW` -> `OPEN|CANCELLED`; `OPEN` -> `IN_PROGRESS|WAITING_FOR_REQUESTER|RESOLVED|CANCELLED`; `IN_PROGRESS` -> `WAITING_FOR_REQUESTER|RESOLVED|CANCELLED`; `WAITING_FOR_REQUESTER` -> `IN_PROGRESS|RESOLVED|CANCELLED`; `RESOLVED` -> `CLOSED|REOPENED`; `CLOSED` -> `REOPENED`; `REOPENED` -> `IN_PROGRESS|WAITING_FOR_REQUESTER|RESOLVED|CANCELLED`; `CANCELLED` has no next state.
- **BR-17:** Confirmation is required for reassigning away from an owner, unassigning, or moving to `RESOLVED`, `CLOSED`, `REOPENED`, or `CANCELLED`.
- **BR-18:** A Requester indication is metadata only, is allowed on an owned active non-terminal Ticket, and is idempotent; it does not change formal status.
- **BR-19:** Public Comments and Internal Notes are trimmed plain text of 1-2,000 characters and are append-only.
- **BR-20:** Internal Note content is never serialized to Requester responses, even when a Ticket is otherwise visible.
- **BR-21:** Search text is trimmed and at most 100 characters. Queue page sizes are 10, 25, or 50; default is page 1, size 10, `updatedAt desc` then `id desc`.
- **BR-22:** Invalid query values return `400`; a valid page beyond the end returns an empty list with pagination metadata.
- **BR-23:** An inactive User cannot authenticate, be assigned a new Ticket, post content, or continue using an existing session.
- **BR-24:** An Administrator cannot deactivate their own account, and the system must retain at least one active Administrator during every role/activation mutation.
- **BR-25:** Deactivation is used instead of User deletion. Initial-password reset sets `mustChangePassword=true` and revokes all sessions for that User.
- **BR-26:** Existing Lab 2 Tickets, Attachments, Ticket Numbers, protected bytes, Categories, and Related Systems are not discarded by migration.
- **BR-27:** Repeated seed runs are idempotent and never commit real credentials, `.env.test`, uploaded files, or secrets.
- **BR-28:** Missing and cross-owner protected resources return the same safe `404`; response messages do not reveal whether a different owner's record exists.

## 6. UI Specification Summary

The UI specification is maintained in `ui-spec.md`. Required routes are `/login`, `/change-password`, `/tickets`, `/tickets/new`, `/tickets/:ticketNumber`, `/staff/tickets`, `/staff/tickets/:ticketNumber`, and `/admin/users`. The shell displays authenticated name/role and Logout, and exposes only role-permitted destinations. The old selector route, Change Requester action, and requester `sessionStorage` state are removed.

Login, Change Password, Requester regression, Staff Queue, Staff Detail, and Administrator User Management define explicit create/view/edit modes plus loading, saving, validation, success, empty/no-results, forbidden, not-found, conflict, and safe-failure states. Existing Lab 2 Zen Green tokens, visible focus, semantic labels, non-color badges, touch targets, exact responsive breakpoints, and no horizontal page scroll remain mandatory.

## 7. Data Changes

All timestamps are PostgreSQL `DateTime` values stored in UTC. Prisma relation names and `onDelete` behavior must be preserved in the migration.

### User and session models

| Model | Fields and types | Relations/constraints |
|---|---|---|
| `User` | `id Int @id @default(autoincrement())`; `name String`; `email String @unique`; `passwordHash String`; `role UserRole`; `isActive Boolean @default(true)`; `mustChangePassword Boolean @default(true)`; `createdAt DateTime @default(now())`; `updatedAt DateTime @updatedAt` | `Ticket.requesterId` -> User `onDelete: Restrict`; `Ticket.ticketOwnerId` -> User `onDelete: SetNull`; Sessions -> User `onDelete: Cascade`; comments/notes -> User `onDelete: Restrict`; resolution and Attachment-removal actor -> User `onDelete: Restrict`. Index `@@index([isActive, role, name])`. Existing Requester IDs are preserved. |
| `Session` | `id Int @id @default(autoincrement())`; `tokenHash String @unique`; `csrfTokenHash String`; `userId Int`; `createdAt DateTime @default(now())`; `lastSeenAt DateTime`; `idleExpiresAt DateTime`; `absoluteExpiresAt DateTime`; `revokedAt DateTime?` | `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`. Indexes `@@index([userId, revokedAt])` and `@@index([idleExpiresAt])`. |
| `LoginAttemptBucket` | `id Int @id @default(autoincrement())`; `keyHash String @unique`; `failureCount Int @default(0)`; `windowStartedAt DateTime`; `blockedUntil DateTime?`; `updatedAt DateTime @updatedAt` | No raw email/IP is stored. Index `@@index([blockedUntil])`. |
| `UserRole` | Enum `REQUESTER`, `IT_STAFF`, `ADMINISTRATOR` | Exactly one role per User. |

### Ticket and entry models

| Model | Fields and types | Relations/constraints |
|---|---|---|
| `Ticket` | `id Int @id @default(autoincrement())`; `ticketNumber String @unique`; `requesterId Int`; `categoryId Int`; `relatedSystemId Int`; `requestedPriority TicketPriority`; `itPriority TicketPriority`; `status TicketStatus @default(NEW)`; `summary String`; `description String`; `ticketOwnerId Int?`; `resolutionIndicatedAt DateTime?`; `resolutionIndicatedByUserId Int?`; `createdAt DateTime @default(now())`; `updatedAt DateTime @updatedAt` | `requester User @relation("SubmittedTickets", fields: [requesterId], references: [id], onDelete: Restrict)`; `category Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)`; `relatedSystem RelatedSystem @relation(fields: [relatedSystemId], references: [id], onDelete: Restrict)`; `ticketOwner User? @relation("OwnedTickets", fields: [ticketOwnerId], references: [id], onDelete: SetNull)`; `resolutionIndicatedBy User? @relation("ResolutionIndications", fields: [resolutionIndicatedByUserId], references: [id], onDelete: Restrict)`. Indexes: `@@index([requesterId, updatedAt, id])`, `@@index([requesterId, createdAt, id])`, `@@index([status, itPriority, ticketOwnerId, updatedAt, id])`, `@@index([ticketOwnerId, updatedAt, id])`, and `@@index([categoryId, relatedSystemId, requestedPriority, status, updatedAt, id])`. |
| `PublicComment` | `id Int @id @default(autoincrement())`; `ticketId Int`; `authorId Int`; `content String`; `createdAt DateTime @default(now())` | `ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Restrict)`; `author User @relation(fields: [authorId], references: [id], onDelete: Restrict)`; index `@@index([ticketId, createdAt, id])`. |
| `InternalNote` | `id Int @id @default(autoincrement())`; `ticketId Int`; `authorId Int`; `content String`; `createdAt DateTime @default(now())` | `ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Restrict)`; `author User @relation(fields: [authorId], references: [id], onDelete: Restrict)`; index `@@index([ticketId, createdAt, id])`; never included in Requester serializers. |
| `TicketStatus` | Enum `NEW`, `OPEN`, `IN_PROGRESS`, `WAITING_FOR_REQUESTER`, `RESOLVED`, `CLOSED`, `REOPENED`, `CANCELLED` | Transition validity is a service rule enforced transactionally. |

### Preserved reference and Attachment models

| Model | Fields and types | Relations/constraints |
|---|---|---|
| `Category` | `id Int @id @default(autoincrement())`; `name String @unique`; `isActive Boolean @default(true)`; `createdAt DateTime @default(now())`; `updatedAt DateTime @updatedAt` | `tickets Ticket[]`; index `@@index([isActive, name])`. |
| `RelatedSystem` | `id Int @id @default(autoincrement())`; `name String @unique`; `isActive Boolean @default(true)`; `createdAt DateTime @default(now())`; `updatedAt DateTime @updatedAt` | `tickets Ticket[]`; index `@@index([isActive, name])`. |
| `TicketCounter` | `id Int @id @default(autoincrement())`; `year Int @unique`; `lastIssued Int @default(0)`; `createdAt DateTime @default(now())`; `updatedAt DateTime @updatedAt` | Annual counter row is locked/updated atomically while allocating a Ticket Number. |
| `Attachment` | `id Int @id @default(autoincrement())`; `ticketId Int`; `originalName String`; `mimeType String`; `sizeBytes Int`; `storedFilename String @unique`; `uploadedAt DateTime @default(now())`; `removedAt DateTime?`; `removalReason String?`; `removedByUserId Int? @map("removedByRequesterId")` | `ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Restrict)`; `removedByUser User? @relation("AttachmentRemovedBy", fields: [removedByUserId], references: [id], onDelete: Restrict)`; index `@@index([ticketId, removedAt])`. The legacy column name is retained and its foreign key is repointed to `User`; metadata is in PostgreSQL and bytes are under the protected local root; stored paths/names are never serialized. |

### Migration sequence

1. Rename/evolve the `Requester` table to `User` while preserving integer IDs and existing foreign-key values.
2. Add role, password hash, activation, and first-login fields in a backfillable state; backfill former Requesters as `REQUESTER`.
3. Hash configured local initial passwords and set migrated users to `mustChangePassword=true`; never commit plaintext credentials.
4. Add sessions and login-attempt buckets.
5. Expand the status enum without truncating Tickets.
6. Add nullable owner and resolution-indication relations.
7. Add `itPriority`, backfill from `requestedPriority`, then enforce non-null.
8. Add PublicComment/InternalNote tables and indexes.
9. Validate row counts, IDs, Ticket ownership, Attachment metadata/files, and Ticket Numbers before final constraints/indexes.
10. Run the complete migration and rollback/recovery checks on the disposable test database before development use. Never reset or delete Lab 2 data.

### Seed and initial-password mapping

Seed at least four active and one inactive Requester, three active and one inactive IT Staff, one active Administrator, realistic Tickets across statuses/priorities/assignment states, and safe Public Comments/Internal Notes. Stable emails and deterministic fixture lookup keys make repeated runs idempotent; user-created records are not overwritten.

The seed and migration scripts read these local-only variables (the real values are never committed):

| Environment key | Applied to | Deterministic fixture accounts |
|---|---|---|
| `LAB3_REQUESTER_INITIAL_PASSWORD` | Every seeded Requester and every migrated former Lab 2 Requester, including inactive Requesters | `amina@example.test`, `somchai@example.test`, `nina@example.test`, `david@example.test`, and `inactive.requester@example.test` |
| `LAB3_IT_STAFF_INITIAL_PASSWORD` | Every seeded IT Staff account | `michael.staff@example.test`, `priya.staff@example.test`, `jon.staff@example.test`, and `inactive.staff@example.test` |
| `LAB3_ADMIN_INITIAL_PASSWORD` | The seeded Administrator account | `admin@example.test` |

Migration must hash the selected group value with Argon2id, set `mustChangePassword=true`, and reject a missing variable before changing rows. The migration test creates a non-fixture legacy Requester such as `legacy.owner@example.test` with an existing Ticket and Attachment, then proves that the same ID, ownership, metadata/file link, non-plaintext password hash, and first-login gate survive migration. The seed test logs in each deterministic fixture with the mapped key, runs the seed twice, and verifies that counts and IDs remain stable. User-created accounts and records are never overwritten.

## 8. API Contract

The exact endpoint schemas, headers, response shapes, status codes, and safe errors are in `api-spec.md`. Authentication uses the opaque cookie session and session-bound CSRF token. Lab 2 `X-Requester-Id` is removed from ownership decisions. API groups are:

- `/api/auth/*`: login, current user, change password, logout.
- `/api/categories` and `/api/related-systems`: authenticated reference data.
- `/api/tickets*`: authenticated Requester continuity, role-sensitive detail/Attachment access, Public Comments, and resolution indication.
- `/api/staff/*`: Queue, assignees, assignment, IT Priority, and status.
- `/api/tickets/:ticketNumber/internal-notes`: IT Staff/Administrator notes.
- `/api/admin/users*`: Administrator-only User Management.

Errors use `{ error: { code, message, fieldErrors? } }`. Required statuses are `400`, `401`, `403`, `404`, `409`, `413`, `415`, `429`, and safe `500` where applicable.

## 9. Acceptance Criteria

- **AC-01:** Given valid active credentials, login establishes a session and returns safe User identity/role data.
- **AC-02:** Given invalid credentials or an inactive account, login returns the same safe failure and never establishes access.
- **AC-03:** Given `mustChangePassword=true`, normal screens/APIs remain blocked until a valid password change succeeds.
- **AC-04:** Given an authenticated User, current-user, expiry, logout, reset revocation, and inactive-user behavior are enforced; direct access after logout fails.
- **AC-05:** Given a role-protected API or route, backend authorization rejects missing/wrong roles even when the UI control is hidden.
- **AC-06:** Given migration of Lab 2 data, User IDs, Ticket ownership, Attachment metadata/files, references, and Ticket Numbers remain correct.
- **AC-07:** Given an authenticated Requester, selector/header/storage identity mechanisms are absent and all Lab 2 Ticket/Attachment ownership behavior uses the session.
- **AC-08:** Given an owned Ticket, a Requester can create/list/detail/manage permitted Attachments and receives safe cross-owner `404` responses.
- **AC-09:** Given an owned Ticket, a Requester can append a Public Comment and record a non-authoritative resolution indication; status does not change.
- **AC-10:** Given staff/admin access, Queue search, filters, sorting, pagination, defaults, metadata, and invalid-query errors match the API contract.
- **AC-11:** Given Queue data, assigned/unassigned ownership, badges, open-detail, loading, empty, no-results, forbidden, failure, and responsive states are usable.
- **AC-12:** Given a permitted staff/admin User, claim/assign/reassign/unassign operations enforce active ownership and required confirmations.
- **AC-13:** Given IT Priority/status changes, only allowed values/transitions and confirmation rules succeed; invalid/stale transitions return `409`.
- **AC-14:** Given Public Comments/Internal Notes, visibility, authorship, append-only behavior, validation, and safe rendering prevent note disclosure.
- **AC-15:** Given existing Attachments, staff/admin detail preserves permitted metadata/download continuity without granting Requester-only mutation.
- **AC-16:** Given an Administrator, User list/search/optional role filter returns Name, Email, Role, Status, and Edit action without advanced excluded features.
- **AC-17:** Given valid admin input, create/edit/one-role/activation behavior works; invalid roles and duplicate emails fail safely.
- **AC-18:** Given a new initial password, the target User must change it at next login; reset revokes old sessions.
- **AC-19:** Given administrator safety rules, self-deactivation and removal of the last active Administrator are rejected transactionally.
- **AC-20:** Given any invalid, forbidden, missing, conflict, rate-limited, or unexpected operation, structured safe errors are returned without sensitive data or existence leaks.
- **AC-21:** Given required screens and keyboard/mobile use, labels, focus, validation, busy guards, semantic state feedback, badges, and responsive layouts remain accessible and unclipped.
- **AC-22:** Given migration and two seed runs on an isolated test database, required counts remain stable and existing data remains preserved.
- **AC-23:** Given the release candidate and final `main`, all required test/build/E2E/evidence gates run from a recorded SHA and no required test is skipped.

## 10. Definition of Done

### 10.1 Product Definition of Done

- All approved FR, BR, and AC scope is implemented without excluded features.
- Backend validation, authentication, CSRF, ownership, role authorization, safe errors, and session invalidation are authoritative.
- Migration and repeated seed preserve existing Lab 2 data and use isolated test resources.
- Passwords, session tokens, hashes, credentials, and internal notes are never exposed or committed.
- Unit, API/integration, UI, style/accessibility, authorization, migration/regression, responsive, visual, and E2E tests pass with no required skips.
- `tests.md` maps every AC to a real test ID and file path, with complete final output recorded.
- `ai-use.md` records real prompts, decisions, verification, and the student's final reflection.
- `reviewer.md` records real identities, PRs, feedback, responses, approvals, and merge evidence.
- README/.gitignore, screenshots, captions, repository links, Project evidence, and final-main SHA are accurate.

### 10.2 Course-Delivery Definition of Done

- Issue #33 is approved and merged before product Issues begin.
- Issues #33-#40 use the planned branches from the latest `lab3-staging`, with accurate Project statuses and mapped FR/BR/AC/Test IDs.
- Every PR targets `lab3-staging`, receives an actual teammate **Approve**, and merges only after explicit student authorization.
- Documentation and evidence are updated continuously, not reconstructed after implementation.
- All eight Issues are Done on the final Kanban board.
- The final submission is exactly one concise PDF with `Answer Part 1` through `Answer Part 9` in order, readable captions, and working links.

## 11. Assumptions and Decisions

- The opaque PostgreSQL session, CSRF, Argon2id, password policy, queue query contract, Administrator staff access, status matrix, and confirmation rules recorded in this specification and the linked API/UI contracts are the working decisions for Issue #33.
- Protected local Attachment storage is acceptable for this coursework; shared/object storage is deferred.
- Dates are persisted in UTC and localized only for display.
- Real `.env.test`, credentials, secrets, uploaded files, sessions, dumps, and test reports are never committed.
- The guarded test database must end in `_test`; Playwright may use only allowlisted test schemas and may not reuse the development server.
- `feature/13-Lab3Contract` is already created at the latest `lab3-staging` baseline. No branch, commit, push, PR, merge, or Project mutation is authorized by this document.
