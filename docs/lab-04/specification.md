# Lab 4 Specification — Actions Taken, Dashboards, and Final Regression

Status: **Draft engineering contract for Issue #55; student and teammate approval pending.** Source: [Lab 4 labsheet](Lab4_labsheet.pdf), including its nine-part rubric. Baseline inspected: `a6cd507efcf4c666491cd79ef81ec0fbfba0f18c`; `feature/21-Lab4Contract` starts from `lab4-staging`. The private plan's earlier branch snapshot is historical, not the current baseline. No product implementation is authorized by this document alone.

## 1. Sprint Goal

Complete database-backed Actions Taken, enforce the final Ticket workflow and resolution gate, and provide useful role-scoped dashboards while preserving the Lab 3 authenticated application. Deliver traceable tests and genuine review, workflow, and submission evidence.

## 2. Stakeholder Request

IT Staff need a shared operational dashboard and attributable, editable work records independent of Ticket ownership. Requesters need an owned attention/recent-work dashboard and read-only visibility of all Actions Taken on their Tickets. Administrators retain staff access and safe User Management. The instructor requires an approved contract before implementation, additive data changes, regression coverage, and a nine-part evidence PDF.

## 3. Scope

In scope: Action creation, assignment, editing, completion, cancellation, immutable revisions, Ticket workflow events, resolution gating, concurrency/retry protection, bounded dashboard queries and drill-downs, seed/migration/recovery verification, accessibility, responsive Zen Green UI, and inherited-feature regression.

Preserve authentication, mandatory password change, Requester My Tickets/Create/detail/attachments/public comments/resolution indication, Staff Queue/detail/assignment/priorities/internal notes, and Administrator safety rules. The development Requester selector and spoofable header are not authentication and must not return.

Excluded: SLA/escalation/on-call, notifications/email/SMS/LINE/push, inventory/procurement/costing, billing/payroll, approval/signatures, advanced BI/data warehouse, multitenancy, production-cloud deployment, Staff Create Ticket, profile photos, fabricated trends, and any new unapproved feature. Existing attachment continuity does not authorize a new Action attachment-upload subsystem.

## 4. Functional Requirements

| ID | Requirement |
| --- | --- |
| FR-01 | List all Actions and immutable revisions for a permitted Ticket, in stable order. Requesters see their own Ticket's public Action fields read-only. |
| FR-02 | Create an Action with backend date/creator, eligible assignee, and an eventual backend completion performer independent of Ticket Owner. |
| FR-03 | Edit and reassign eligible Actions with version checks and retained revision history. |
| FR-04 | Support OPEN, IN_PROGRESS, COMPLETED, and CANCELLED Action lifecycle and metadata. |
| FR-05 | Apply identical strict frontend and authoritative backend field validation; retain drafts after failed saves. |
| FR-06 | Prevent duplicate creation on clicks/retries; record every real Action change once without rewriting history. |
| FR-07 | Enforce the Ticket transition matrix, resolution gate, advisory Requester indication, reopening, and atomic cancellation effects. |
| FR-08 | Serialize competing workflow-affecting mutations and reject stale versions without partial changes. |
| FR-09 | Provide Staff/Admin metrics, current-user assigned Actions, recent Tickets, urgent Tickets, and usable drill-downs. |
| FR-10 | Provide Requester-owned active/attention/resolved/closed metrics and recent/attention Tickets without leaking others' data. |
| FR-11 | Match dashboard metrics to bounded, validated list predicates and preserve inherited list controls. |
| FR-12 | Add schema/migration/seed safely, preserve legacy rows and changed credentials, and verify recovery and repeat runs. |
| FR-13 | Enforce sessions, role/ownership authorization, CSRF, eligible assignees, and User Management assignment safety on direct APIs. |
| FR-14 | Preserve previous features, accessible responsive presentation, accurate documentation, and genuine course-delivery evidence. |

### Roles and authorization

All workspace access requires an active authenticated User with `mustChangePassword=false`. Missing/expired/revoked/inactive sessions return `401 SESSION_REQUIRED`; the password gate returns `403 PASSWORD_CHANGE_REQUIRED`. Logout is explicitly idempotent `204`, including no active session. Origin/CSRF checks apply to authenticated writes.

| Capability | Requester | IT Staff | Administrator |
| --- | --- | --- | --- |
| Requester dashboard, My Tickets, own create/detail | Own scope | No | No |
| Read Actions/revisions/workflow events; attachment metadata/download; public comments | Own Ticket | All Tickets | All Tickets |
| Action mutations, Staff dashboard/queue/operations, Internal Notes | Forbidden | Allowed | Allowed |
| Existing attachment upload/remove and resolution indication | Own Ticket | Forbidden | Forbidden |
| User Management | Forbidden | Forbidden | Allowed |

Wrong role is `403 FORBIDDEN`. For permitted reader roles, absent and cross-Requester Tickets receive the same `404 TICKET_NOT_FOUND`; absent/mismatched Action IDs receive the same `404 ACTION_NOT_FOUND` after Ticket access is established. Never use body IDs or `X-Requester-Id` to select the authenticated identity. All Action business fields are Requester-visible; private work belongs in Internal Notes.

## 5. Business Rules

| ID | Rule |
| --- | --- |
| BR-01 | Each Action belongs to exactly one Ticket; nested Action/revision lookups must match that Ticket. |
| BR-02 | Action assignee, creator, completion performer, and Ticket Owner may differ. Editing an Action never silently changes Ticket Owner. |
| BR-03 | Requesters read all owned Action states and public revisions but cannot mutate them. |
| BR-04 | Action date/creator come from the backend; completion performer/time come from the authenticated completion transaction and remain immutable afterward. |
| BR-05 | New/reassigned Actions require an active IT Staff/Administrator; default assignee is the creating actor. |
| BR-06 | Trim text. Description 5–2000; nonempty Result 5–2000 and required on completion; nonempty Follow-up Note 5–2000 and required when follow-up is true, otherwise optional; Attachment Notes 0–1000; cancellation reason 5–250. `followUpRequired` is a real Boolean. |
| BR-07 | OPEN → IN_PROGRESS/COMPLETED/CANCELLED; IN_PROGRESS → COMPLETED/CANCELLED. COMPLETED cannot change status or assignee; CANCELLED is read-only. |
| BR-08 | Completion requires Result and eligible assignee, sets performer/time once; cancellation sets reason/time once. Completed narrative/Result/follow-up corrections are allowed only on active Tickets and create revisions. |
| BR-09 | Initial revision number is 1 while Action version is 0. Every actual mutation increments version and appends exactly one snapshot revision. No-op saves append nothing. Actions order `createdAt asc, id asc`; revisions order `revisionNumber asc`; workflow events order `createdAt asc, id asc`. No application endpoint updates/deletes history. |
| BR-10 | Creation uses a UUID request key scoped to creator. Same key and normalized payload returns the original resource; different payload/Ticket with that key returns 409. Uncertain network retries keep the key and draft. |
| BR-11 | Ticket transitions follow the matrix below; RESOLVED/CLOSED/REOPENED/CANCELLED require explicit confirmation. Ticket cancellation additionally requires a reason. |
| BR-12 | Entering RESOLVED or CLOSED requires an eligible non-null Owner, at least one COMPLETED Action with valid Result, no OPEN/IN_PROGRESS Actions, and no COMPLETED Action with follow-up required. CANCELLED Actions do not satisfy completion or block follow-up. |
| BR-13 | Requester resolution indication is advisory and idempotent; it never changes status. CLOSED/CANCELLED prohibit indication. Reopening clears it atomically. |
| BR-14 | Expected versions and one parent Ticket lock protect Action/Owner/IT-priority/status/indication transactions. Roll back all rows, revisions, versions, and events on failure. |
| BR-15 | RESOLVED/CLOSED/CANCELLED Tickets reject Action mutation. Ticket cancellation atomically cancels unfinished Actions with its reason. Preserve legacy status/history; do not invent Actions/events. Legacy RESOLVED Tickets with zero Actions must reopen and meet the new gate before closing. |
| BR-16 | Requester dashboard identity comes exclusively from the session's legacy Requester mapping; Staff/Admin dashboard may aggregate all Tickets. Never return unrestricted Ticket collections. |
| BR-17 | Active Ticket states are NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED; active Action states are OPEN/IN_PROGRESS on active Tickets. Metrics count Tickets distinctly unless explicitly counting Actions. |
| BR-18 | Store/return UTC, display Asia/Bangkok. Recent window is the inclusive preceding 7×24 hours through one `generatedAt`. Lists are bounded and deterministically ordered; zero counts are valid. |
| BR-19 | Dashboard links use the same predicates as corresponding list APIs, not client-side filtering of entire collections. |
| BR-20 | Reject deactivation/demotion to Requester when a User has unfinished assigned Actions: 409 USER_HAS_ACTIVE_ACTIONS. Existing self/last-Administrator and Ticket ownership guards remain; rejected changes preserve User and sessions. |
| BR-21 | Additive migrations and create-only seed graphs preserve existing data, credential hashes, and completed password changes. Repeat runs do not rewrite business history or reset counters. Recovery uses a verified disposable backup/rehearsal, not destructive production reset. |
| BR-22 | Safe structured errors, authorization, inherited features, accessible responsive UI, honest test/review evidence, and secret protection are release requirements. |

### Ticket transitions

| Current | Allowed target states |
| --- | --- |
| NEW | OPEN, CANCELLED |
| OPEN | IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CANCELLED |
| IN_PROGRESS | WAITING_FOR_REQUESTER, RESOLVED, CANCELLED |
| WAITING_FOR_REQUESTER | IN_PROGRESS, RESOLVED, CANCELLED |
| RESOLVED | CLOSED, REOPENED |
| CLOSED | REOPENED |
| REOPENED | IN_PROGRESS, WAITING_FOR_REQUESTER, RESOLVED, CANCELLED |
| CANCELLED | None |

UI may display only currently legal transitions; direct API enforcement is mandatory. Preserve existing `LOW`, `MEDIUM`, `HIGH`, `URGENT` shared priority enum and semantic order. Requester `priority` and Staff `requestedPriority`/`itPriority` query names remain unchanged. Ticket Number `TKT-YYYY-######` uses the annual concurrency-safe counter. `Ticket.createdAt` is Ticket Date. Inherited trimmed constraints: Summary 5–120, Description 10–5000, search ≤100, attachment removal reason 5–250. New Tickets start NEW; the existing creation service initializes IT Priority from Requested Priority, while the schema fallback is LOW.

## 6. UI Specification Summary

Add `/dashboard` for Requesters and `/staff/dashboard` for Staff/Admin as normal post-login landing routes; preserve authorized deep links, password gate, logout, and all existing routes. Add public Actions/history sections to owned Requester detail and inline Action editors adjacent to the selected Staff detail record. Reuse existing navigation and Zen Green tokens; no new router/chart/modal framework is needed. [ui-spec.md](ui-spec.md) defines controls, messages, focus, all states, responsive boundaries, and screenshots.

## 7. Data Changes

Prisma/PostgreSQL remains authoritative. Every new FK uses `onDelete: Restrict`, `onUpdate: Cascade`; do not change existing FK behavior silently. IDs are Prisma `Int @id @default(autoincrement())`; timestamps are `DateTime` stored as instants, returned as ISO UTC. New string bounds are validated server-side; enum/default/nullability are also schema constraints. Add matching User/Ticket back-relations.

| Model/change | Exact fields and defaults | Relations and constraints/index columns |
| --- | --- | --- |
| Ticket extension | `workflowVersion Int @default(0)` | Existing PK/Number/relations unchanged. All existing rows receive 0. |
| ActionTaken | `id Int`; `ticketId Int`; `assigneeUserId Int`; `createdByUserId Int`; `performedByUserId Int?`; `description String`; `result String?`; `followUpRequired Boolean @default(false)`; `followUpNote String?`; `attachmentNotes String?`; `status ActionStatus @default(OPEN)`; `cancellationReason String?`; `createdAt DateTime @default(now())`; `updatedAt DateTime @default(now()) @updatedAt`; `completedAt DateTime?`; `cancelledAt DateTime?`; `version Int @default(0)`; `clientRequestId String @db.Uuid`; `requestFingerprint String @db.Char(64)` | `ticketId → Ticket.id`; required assignee/creator plus nullable performer → User.id, three named User relations. Unique `(createdByUserId, clientRequestId)`. Index `(ticketId, createdAt, id)` and `(assigneeUserId, status, updatedAt, id)`. |
| ActionTakenRevision | `id Int`; `actionId Int`; `revisionNumber Int`; `actorUserId Int`; `changedAt DateTime @default(now())`; `snapshot Json` | Action/User FKs; unique `(actionId, revisionNumber)`. Snapshot shape defined in API contract. Immutable through application, including historical actor references. |
| TicketWorkflowEvent | `id Int`; `ticketId Int`; `actorUserId Int`; `fromStatus TicketStatus`; `toStatus TicketStatus`; `reason String?`; `workflowVersion Int`; `createdAt DateTime @default(now())` | Ticket/User FKs; unique `(ticketId, workflowVersion)`; index `(ticketId, createdAt, id)`. Only actual status changes create an event. |
| ActionStatus | Enum OPEN, IN_PROGRESS, COMPLETED, CANCELLED | No replacement of TicketStatus or TicketPriority. |

Use Prisma's conventional constraint names for these exact column combinations; migration review checks actual SQL names/columns. No speculative indexes for every filter combination.

Inherited relationships remain: `Ticket.requesterId → Requester.id`, category/system → reference IDs with Restrict; nullable `ticketOwnerId → User.id` remains SetNull, with application guards preventing ineligible ownership; resolution actor → User Restrict. User nullable unique `legacyRequesterId → Requester.id` Restrict; Session User FK remains Cascade. Attachments/Comments/Notes retain Restrict Ticket/actor links. Keep existing unique Ticket Number, User/Requester email, Session token hash, Attachment stored filename, annual counter year; preserve current Ticket indexes `(requesterId, updatedAt, id)`, `(requesterId, createdAt, id)`, `(requesterId, categoryId, relatedSystemId, requestedPriority, status)`, `(status, itPriority, ticketOwnerId, updatedAt, id)`, `(ticketOwnerId, updatedAt, id)`, `(categoryId, relatedSystemId, requestedPriority, status, updatedAt, id)`, and `(resolutionIndicatedByUserId)`.

Design justification 1: separate Action attribution/assignment from Ticket Owner to represent real work by multiple staff without overwriting accountability. Design justification 2: immutable snapshots plus optimistic versions retain corrections and reject lost updates; the parent lock makes the resolution predicate and its effects atomic. Design justification 3: aggregate queries and bounded indexed lists keep dashboards useful without exposing or loading whole collections.

### Transactions, migration, seed, and recovery

Workflow-affecting writes use a PostgreSQL transaction with parent Ticket `FOR UPDATE`, expected-version comparison, and SERIALIZABLE isolation. Recheck actor and assignee eligibility inside the transaction. Retry serialization/deadlock aborts through Prisma's retryable conflict handling at most three transaction attempts; revalidate versions/key each time. Exhaustion returns safe 409 CONCURRENT_UPDATE. No client auto-overwrite. All actual Action/Owner/IT-priority/status/indication changes increment Ticket workflowVersion once; unchanged requests do not. Attachments/Comments/Notes keep their existing contracts and do not advance workflowVersion.

For Action creation, authenticate/authorize before resolving the request key. A matching committed key/payload replays before stale-version rejection; changed payload gives 409. The normalized fingerprint contains Ticket identity and business fields, excludes versions/transport fields, and is never exposed. Revisions, events, counter increments, cancellation, and indication clearing commit or roll back together.

Issue #56's additive migration creates ActionStatus, ActionTaken/Revision and Ticket workflowVersion; Issue #58's migration adds TicketWorkflowEvent when workflow integration begins. Neither changes old statuses, identities, files, comments, notes, credentials, or history. Verify a pre-Lab-4 database fixture upgraded by the real migrations, including a non-fixture Requester who changed password. Do not fabricate historical Action snapshots. Rehearse backup/restore in a dedicated disposable database; document retaining new tables rather than dropping real post-upgrade work if application rollback is required.

Seed retains four active/one inactive Requester, required categories and seven systems, existing Staff/Admin fixtures, plus realistic new Ticket graphs with zero/one/multiple Actions, varied states/priorities/Owners and zero/nonzero dashboard results. Identify new fixture graphs by stable reserved Ticket Numbers; create the whole graph transactionally only if the number is absent. On an existing number, leave the entire graph unchanged; report skips/collisions rather than repurpose a real Ticket. Fixed UUID creation keys identify new Action fixtures. Never reset counter below the highest existing annual number. Repeated reference/User fixture runs must not reset edited names/activation/roles/passwords; correct the inherited updating upserts in Issue #56. Credential backfill applies only when `passwordHash IS NULL`; preserve hashes and `mustChangePassword=false` on reruns. Keep local `LAB3_REQUESTER_INITIAL_PASSWORD`, `LAB3_IT_STAFF_INITIAL_PASSWORD`, `LAB3_ADMIN_INITIAL_PASSWORD`; no new committed passwords. Test first seed, rerun after edits/password change, and stable counts/history.

## 8. API Contract

[api-spec.md](api-spec.md) is the normative exact shape/status contract. Add scoped Action list/create/update/revision and workflow-event routes, and two role dashboard routes. Preserve existing attachment routes and response/error behavior. Extend Staff mutations with required expected versions, Ticket cancellation with reason, and list APIs with bounded dashboard predicates. These coordinated input extensions are explicit Lab 4 changes, not undocumented route replacements.

## 9. Acceptance Criteria

| ID | Observable acceptance | FR / BR | Test IDs |
| --- | --- | --- | --- |
| AC-01 | All Action states/history are stably listed; own-only Requester reads and mismatched resources are safe. | FR-01; BR-01,03,09 | API-01,02; UI-01; E2E-01 |
| AC-02 | Creator/date/default assignee are backend-derived; completion performer may differ from Owner/creator. | FR-02; BR-02,04,05 | UNIT-01; API-01,08; E2E-01 |
| AC-03 | Boundary/conditional validation is strict; failures preserve drafts and do not write partial rows. | FR-05; BR-06,22 | UNIT-01; API-01; UI-01; E2E-01 |
| AC-04 | Editing/reassignment retains immutable prior snapshots and advances versions only on real change. | FR-03,06; BR-05,09 | API-01,03; UI-01; E2E-01 |
| AC-05 | Complete/cancel metadata and allowed Action transitions are enforced. | FR-04; BR-07,08 | UNIT-02; API-01; UI-01; E2E-01 |
| AC-06 | Duplicate clicks/retries and stale concurrent saves cannot duplicate or overwrite work. | FR-06,08; BR-10,14 | API-03; UI-01,02; E2E-01 |
| AC-07 | Only matrix-permitted confirmed Ticket transitions succeed, including direct API calls. | FR-07; BR-11 | UNIT-02; API-04; UI-02; E2E-02 |
| AC-08 | Resolution/closure reject missing/ineligible Owner, missing completion, unfinished work, and required follow-up. | FR-07,08; BR-12,14 | UNIT-02; API-03,04; UI-02; E2E-02 |
| AC-09 | Requester indication is advisory; reopening clears it without rewriting history. | FR-07; BR-13 | API-04; REG-01; E2E-02 |
| AC-10 | Terminal/legacy behavior is explicit; cancellation effects roll back together on forced failure. | FR-07,12; BR-15 | API-04,07; E2E-02 |
| AC-11 | Staff metrics and current-user Action list match database fixtures, including unassigned and urgent work. | FR-09; BR-17 | UNIT-03; API-06; UI-04; E2E-03 |
| AC-12 | Requester metrics/attention/recent lists contain only owned data, including direct API isolation. | FR-10; BR-16 | API-02,05; UI-03; E2E-03 |
| AC-13 | Zero/time-boundary/tied-date metrics and capped lists are consistent and bounded. | FR-09,10; BR-18 | UNIT-03; API-05,06; PERF-01; E2E-03 |
| AC-14 | Metric/status/priority/recent drill-downs yield the corresponding filtered total and preserve controls. | FR-11; BR-19 | API-05,06; UI-03,04; E2E-03 |
| AC-15 | Inactive/non-staff assignment and unsafe User mutations fail without changing User/session/work records. | FR-13; BR-05,20 | API-08; REG-01; E2E-01 |
| AC-16 | Real upgrade and repeated seed preserve previous rows, credentials, counters, and edited fixture data. | FR-12; BR-21 | API-07; REG-01 |
| AC-17 | Disposable backup/recovery rehearsal preserves verified data and documents safe operational rollback. | FR-12; BR-21 | API-07; MAN-01 |
| AC-18 | Session/CSRF/role/ownership and representative prior features still work; failures are sanitized. | FR-13,14; BR-22 | API-02; REG-01; E2E-01,02,03 |
| AC-19 | Major Lab 4 pages are usable with keyboard at desktop/tablet/mobile and responsive boundaries. | FR-14; BR-22 | UI-01,02,03,04; STYLE-01; MAN-01 |
| AC-20 | Approved contracts precede implementation; actual reviews/tests/Project/history and nine-part evidence are complete. | FR-14; BR-22 | DOC-01; REG-01; MAN-01 |

[tests.md](tests.md) expands every Test ID to a real planned file/command and verification status. Planned is not passing.

## 10. Definition of Done

### Product

Every FR/BR/AC maps to a verified test/evidence path; required unit/API/UI/auth/workflow/regression/performance-smoke/E2E checks pass without skipping required tests. Server/client builds pass. Real migrations, non-destructive repeated seed and disposable recovery are verified. Strict safe authorization, concurrency, bounded queries, accessible responsive UI and old feature continuity hold. Real screenshots are readable, captioned and sanitized; no mocked/generated evidence.

### Course delivery and review

Issue #55's six contract documents are reviewed and approved, with the four public contract documents merged before product implementation. Issues #55–62 run sequentially on approved branches from latest `lab4-staging`. Each card follows Backlog → Specified → Started → PR Review → Fixing if needed → Done only after approved merge. Git/GitHub mutations require exact student authorization; actual teammate **Approve** is required before authorized merge. Preserve complete command output, tested SHA, traceability, real prompts and real reviewer responses continuously. Release candidate passes all gates; checks explicitly required from final `main` run after release merge, never marked done in advance. Final Kanban shows every Lab 4 Issue Done. Submit one concise PDF with exact `Answer Part 1` through `Answer Part 9`, working links, readable images and requirement-specific captions. Final `main` is source of truth.

## 11. Assumptions and Decisions

The Action lifecycle, completed corrections, assignment rule, resolution gate, legacy reopening requirement, version/idempotency protocol, cancellation effects, seven-day dashboard definition and create-only seed strategy above are **proposed decisions awaiting contract approval**, not claims that the labsheet dictated every detail. No product changes until approved. Use existing libraries/storage/auth; no cloud or chart dependency. Local real/test environment files, secrets, uploaded bytes and transient reports stay uncommitted. Only sanitized example files may be committed. Screenshots must be genuine captures, not generated images. Personal AI reflection and peer approvals are not invented. Any later change to this contract requires explicit scope review and corresponding test/document updates.
