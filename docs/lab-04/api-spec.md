# Lab 4 API Contract

Draft for Issue #55; approval pending. Read with [specification.md](specification.md). Preserve existing route names and inherited behavior; proposed coordinated extensions are marked below. `/api` is the base prefix. JSON uses camelCase; timestamps are ISO 8601 UTC strings (`...Z`), positive IDs are integers, versions are nonnegative integers. Reject unknown fields on new mutation bodies. No body-controlled creator/performer/date/requester identity.

## 1. Common security and errors

Use existing HttpOnly session cookie and CSRF protocol. Protected GETs require usable session; writes additionally require permitted Origin and `X-CSRF-Token`. Login and mandatory password-change routes retain their existing authentication/password-gate exceptions. Role checks precede business mutations. Recheck active actor/assignee during atomic writes. GET responses use `Cache-Control: no-store`; protected downloads additionally use `X-Content-Type-Options: nosniff`. No private paths, hashes, secrets, SQL, or stack traces in JSON.

```ts
type Role = 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type TicketStatus = 'NEW' | 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_REQUESTER'
  | 'RESOLVED' | 'CLOSED' | 'REOPENED' | 'CANCELLED';
type ActionStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type IsoUtc = string;
type ApiError = { error: { code: string; message: string; fieldErrors?: Record<string,string> } };
type Reference = { id: number; name: string };
type RequesterIdentity = Reference & { email: string };
type UserIdentity = RequesterIdentity & { role: Role };
type SafeUser = UserIdentity & { isActive: boolean; mustChangePassword: boolean;
  createdAt: IsoUtc; updatedAt: IsoUtc };
type ResolutionIndication = { indicatedAt: IsoUtc; indicatedBy: UserIdentity };
type Pagination = { page: number; pageSize: 10|25|50; totalItems: number;
  totalPages: number; hasPreviousPage: boolean; hasNextPage: boolean };
type GateReason = 'OWNER_REQUIRED'|'OWNER_INELIGIBLE'|'COMPLETED_ACTION_REQUIRED'
  |'UNFINISHED_ACTIONS'|'FOLLOW_UP_REQUIRED';
type ResolutionGate = { canResolve: boolean; canClose: boolean; unmetConditions: GateReason[] };
type TicketCore = { id: number; ticketNumber: string; requester: RequesterIdentity;
  category: Reference; relatedSystem: Reference; requestedPriority: Priority; itPriority: Priority;
  status: TicketStatus; summary: string; description: string;
  resolutionIndication: ResolutionIndication|null; createdAt: IsoUtc; updatedAt: IsoUtc };
type RequesterTicketDetail = TicketCore & { workflowVersion: number };
type StaffTicket = TicketCore & { ticketOwner: UserIdentity|null; workflowVersion: number };
type StaffTicketDetail = StaffTicket & { allowedTransitions: TicketStatus[]; resolutionGate: ResolutionGate };
type Attachment = { id: number; originalName: string; mimeType: string; sizeBytes: number;
  uploadedAt: IsoUtc; removedAt: IsoUtc|null; removalReason: string|null;
  removedByRequesterId: number|null };
type Communication = { id: number; content: string; author: UserIdentity; createdAt: IsoUtc };
```

`allowedTransitions` contains matrix-legal targets, excluding gated RESOLVED/CLOSED when gate fails. Gate flags additionally respect the current state's matrix; unmetConditions lists failed gate predicates in the declaration order, not a status-change guarantee. Requester detail never exposes Internal Notes or staff-only controls. Owner/User identities omit credential/session data.

| Status | Deterministic behavior |
| --- | --- |
| 400 | VALIDATION_ERROR for new field/query validation; REQUEST_BODY_INVALID for malformed JSON; inherited endpoint-specific 400 codes retained. |
| 401 | SESSION_REQUIRED for missing/expired/revoked/inactive protected session; client clears authenticated workspace and redirects to `/login`. AUTHENTICATION_FAILED on login and CURRENT_PASSWORD_INVALID on password change are field/credential errors, not global session-expiry events. Logout exception: always 204 without an active session. |
| 403 | FORBIDDEN for wrong role; PASSWORD_CHANGE_REQUIRED for mandatory password gate; CSRF_INVALID or ORIGIN_NOT_ALLOWED for failed existing write protection. |
| 404 | TICKET_NOT_FOUND for absent/cross-Requester Ticket; ACTION_NOT_FOUND for absent/mismatched Action; ATTACHMENT_NOT_FOUND for absent/cross-Requester/removed download. Safe messages respectively `Ticket was not found.`, `Action was not found.`, `Attachment was not found.` |
| 409 | STALE_VERSION, IDEMPOTENCY_KEY_REUSED, INVALID_ACTION_TRANSITION, INVALID_STATUS_TRANSITION, ACTION_READ_ONLY, RESOLUTION_GATE_NOT_MET, ASSIGNMENT_CONFLICT, USER_HAS_ACTIVE_ACTIONS, CONCURRENT_UPDATE, or documented inherited conflict. Return actionable public message; fieldErrors may point to expected versions, status, assignee, or follow-up. |
| 413 | REQUEST_BODY_TOO_LARGE or inherited attachment size error, no partial write. |
| 415 | Inherited unsupported attachment media/signature errors, no partial write. |
| 429 | Existing login rate limit remains. |
| 500 | Safe endpoint failure code/message below; rolled-back writes, no implementation detail. |

## 2. Actions Taken DTOs

All listed Action business fields and snapshots are public to an authorized Ticket reader. The storage request fingerprint and creation key are not returned.

```ts
type ActionTaken = { id: number; ticketNumber: string; description: string; result: string|null;
  followUpRequired: boolean; followUpNote: string|null; attachmentNotes: string|null;
  status: ActionStatus; cancellationReason: string|null;
  assignee: UserIdentity; createdBy: UserIdentity; performedBy: UserIdentity|null;
  createdAt: IsoUtc; updatedAt: IsoUtc; completedAt: IsoUtc|null; cancelledAt: IsoUtc|null;
  version: number };
type ActionSnapshot = { description: string; result: string|null; followUpRequired: boolean;
  followUpNote: string|null; attachmentNotes: string|null; status: ActionStatus;
  cancellationReason: string|null; assigneeUserId: number; createdByUserId: number;
  performedByUserId: number|null; createdAt: IsoUtc; updatedAt: IsoUtc;
  completedAt: IsoUtc|null; cancelledAt: IsoUtc|null; version: number };
type ActionRevision = { id: number; actionId: number; revisionNumber: number;
  actor: UserIdentity; changedAt: IsoUtc; snapshot: ActionSnapshot };
type WorkflowEvent = { id: number; ticketNumber: string; actor: UserIdentity;
  fromStatus: TicketStatus; toStatus: TicketStatus; reason: string|null;
  workflowVersion: number; createdAt: IsoUtc };
type CreateActionBody = { clientRequestId: string; expectedTicketVersion: number;
  description: string; assigneeUserId?: number; result?: string;
  followUpRequired: boolean; followUpNote?: string; attachmentNotes?: string };
type PatchActionBody = { expectedTicketVersion: number; expectedActionVersion: number;
  description?: string; assigneeUserId?: number; result?: string;
  followUpRequired?: boolean; followUpNote?: string; attachmentNotes?: string;
  status?: ActionStatus; cancellationReason?: string };
```

Creation starts OPEN; `clientRequestId` must be a UUID. At least one business field is required for PATCH. Omitted PATCH fields retain values; optional empty strings normalize to null, except required fields cannot be cleared. Follow-up Note is required when final merged state has followUpRequired=true. Cancellation reason is accepted only when transitioning to CANCELLED; completion requires final merged Result. Date/actor/time/version outputs are backend-derived, not body-writable. Completed Actions allow description/result/follow-up/attachment-note correction only; do not change assignee/performer/time/status. Terminal Ticket or cancelled Action gives ACTION_READ_ONLY. Same-state/no-op saves return existing rows/versions without history, after version validation.

| Method/path | Role/input | Exact successful JSON/status | Specific failure codes |
| --- | --- | --- | --- |
| GET `/api/tickets/:ticketNumber/actions-taken` | Authorized Ticket reader; page/pageSize | 200 `{ actions: ActionTaken[], pagination: Pagination, ticketVersion: number }` | 400 VALIDATION_ERROR; 500 ACTION_LIST_FAILED |
| POST same | Staff/Admin; CreateActionBody; JSON+CSRF | First commit 201; identical replay 200; `{ action: ActionTaken, ticketVersion: number, replayed: boolean }` | 400 VALIDATION_ERROR; 409 STALE_VERSION/IDEMPOTENCY_KEY_REUSED/ASSIGNMENT_CONFLICT/ACTION_READ_ONLY/CONCURRENT_UPDATE; 500 ACTION_CREATE_FAILED |
| PATCH `/api/tickets/:ticketNumber/actions-taken/:actionId` | Staff/Admin; PatchActionBody | 200 `{ action: ActionTaken, ticketVersion: number }` | 400 VALIDATION_ERROR; 409 STALE_VERSION/INVALID_ACTION_TRANSITION/ASSIGNMENT_CONFLICT/ACTION_READ_ONLY/CONCURRENT_UPDATE; 500 ACTION_UPDATE_FAILED |
| GET `/api/tickets/:ticketNumber/actions-taken/:actionId/revisions` | Authorized Ticket reader; page/pageSize | 200 `{ revisions: ActionRevision[], pagination: Pagination }` | 400 VALIDATION_ERROR; 500 ACTION_HISTORY_FAILED |
| GET `/api/tickets/:ticketNumber/workflow-events` | Authorized Ticket reader; page/pageSize | 200 `{ events: WorkflowEvent[], pagination: Pagination }` | 400 VALIDATION_ERROR; 500 WORKFLOW_HISTORY_FAILED |

All inherit common session/role/resource errors. Default history/action pagination: page=1, pageSize=25; allowed 10/25/50. Reject duplicates/unknown query keys, invalid IDs/page sizes. Invalid Ticket Number format returns safe Ticket 404; invalid/nonmatching Action ID returns safe Action 404 after Ticket scope check. Empty lists are 200 with zero totalPages. Ticket access never depends on Action creator/assignee. There is no Action/revision/event DELETE or history PATCH endpoint.

Transactions follow specification BR-09/10/14: one parent lock, expected versions, atomic snapshot/version updates, bounded serialization retries. Return STALE_VERSION when either expected version differs; a creation replay is authorized and fingerprint-checked before stale rejection. Generate a new key only for a genuinely new intended creation. A timeout must not cause the UI to silently create a second record.

## 3. Existing Ticket operation extensions

Paths and roles remain unchanged. These required-version input additions are implemented together with all their existing callers in Issue #58, and regression tested; do not temporarily break the old UI.

| Endpoint | Exact input | Success | Specific errors |
| --- | --- | --- | --- |
| GET `/api/staff/assignees` | Staff/Admin; no body | 200 `UserIdentity[]`, active eligible Users, name asc/id asc | 500 ASSIGNEE_LIST_FAILED |
| GET `/api/staff/tickets/:ticketNumber` | Staff/Admin | 200 `{ ticket: StaffTicketDetail }` | Ticket 404; 500 STAFF_TICKET_DETAIL_FAILED |
| PATCH `/api/staff/tickets/:ticketNumber/assignment` | `{ ownerUserId: number|null, expectedVersion: number, confirm?: boolean }` | 200 `{ ticket: StaffTicket }` | 400 invalid fields; 409 STALE_VERSION/ASSIGNMENT_CONFLICT/CONCURRENT_UPDATE; 500 ASSIGNMENT_UPDATE_FAILED |
| PATCH `/api/staff/tickets/:ticketNumber/priority` | `{ itPriority: Priority, expectedVersion: number }` | 200 `{ ticket: StaffTicket }` | 400 invalid fields; 409 STALE_VERSION/CONCURRENT_UPDATE; 500 PRIORITY_UPDATE_FAILED |
| PATCH `/api/staff/tickets/:ticketNumber/status` | `{ status: TicketStatus, expectedVersion: number, confirm?: boolean, cancellationReason?: string }` | 200 `{ ticket: StaffTicket }` | 400 missing confirmation/reason/fields; 409 STALE_VERSION/INVALID_STATUS_TRANSITION/RESOLUTION_GATE_NOT_MET/CONCURRENT_UPDATE; 500 STATUS_UPDATE_FAILED |
| POST `/api/tickets/:ticketNumber/resolution-indication` | Requester own; empty JSON object or no body | 200 `{ resolutionIndication: ResolutionIndication }` | 400 RESOLUTION_INDICATION_NOT_ALLOWED for CLOSED/CANCELLED; 409 CONCURRENT_UPDATE; 500 RESOLUTION_INDICATION_FAILED |

Changing an existing non-null Owner requires confirm=true; unassigned claim does not. Ineligible Owner/Action assignee gives ASSIGNMENT_CONFLICT. Status targets and confirmation follow the full specification matrix. Gate failure message identifies failed public predicates; never claims an indicated resolution is an actual status change. Cancellation commits unfinished Action cancellation snapshots and one Ticket workflow event in the same transaction; reopening clears indication. No-op assignment/priority/status does not alter timestamps/version/history. Indication locks parent and increments workflowVersion only when first recorded; idempotent repeat leaves it unchanged. Its unchanged body does not accept a caller's requester identity.

## 4. Dashboard DTOs and predicates

```ts
type RecentWindow = { from: IsoUtc; through: IsoUtc };
type TicketLink = { id: number; ticketNumber: string; summary: string; status: TicketStatus;
  requestedPriority: Priority; itPriority: Priority; updatedAt: IsoUtc };
type StaffTicketLink = TicketLink & { requester: RequesterIdentity; ticketOwner: UserIdentity|null };
type AssignedActionLink = { id: number; ticketNumber: string; ticketSummary: string;
  description: string; status: 'OPEN'|'IN_PROGRESS'; updatedAt: IsoUtc };
type RequesterDashboard = { generatedAt: IsoUtc; timezone: 'Asia/Bangkok'; recentWindow: RecentWindow;
  metrics: { activeTicketCount: number; waitingForRequesterCount: number;
    resolvedCount: number; closedCount: number };
  recentTickets: TicketLink[]; attentionTickets: TicketLink[] };
type StaffDashboard = { generatedAt: IsoUtc; timezone: 'Asia/Bangkok'; recentWindow: RecentWindow;
  metrics: { unassignedActiveTicketCount: number; myOwnedActiveTicketCount: number;
    urgentActiveTicketCount: number; ticketsWithMyActiveActionsCount: number };
  statusCounts: Record<TicketStatus,number>; itPriorityCounts: Record<Priority,number>;
  myActions: AssignedActionLink[]; recentTickets: StaffTicketLink[]; urgentTickets: StaffTicketLink[] };
```

| Endpoint | Auth/input | Success | Failures |
| --- | --- | --- | --- |
| GET `/api/dashboard/requester` | Requester; no query/body; identity from session | 200 `RequesterDashboard` | Common 401/403; 400 VALIDATION_ERROR for unsupported query; 500 REQUESTER_DASHBOARD_FAILED |
| GET `/api/dashboard/staff` | Staff/Admin; no query/body | 200 `StaffDashboard` | Common 401/403; 400 VALIDATION_ERROR; 500 STAFF_DASHBOARD_FAILED |

Use one REPEATABLE READ database snapshot and one generatedAt per response. UTC recent range inclusive `[generatedAt - 7×24h, generatedAt]` on Ticket.updatedAt, excluding future dates. All section arrays max 5; updatedAt desc/id desc. Recent includes all statuses; attention=Requester-owned WAITING_FOR_REQUESTER. Active status set is NEW/OPEN/IN_PROGRESS/WAITING_FOR_REQUESTER/REOPENED. Requester resolved/closed metrics mean current status, not an invented resolved-at interval. Staff statusCounts covers all eight states across all Tickets; itPriorityCounts covers active Tickets only. Urgent means IT Priority URGENT on an active Ticket. myActions means current actor's assigned OPEN/IN_PROGRESS Actions on active Tickets; its metric counts distinct Tickets, not Actions. Unassigned means null Owner; myOwned means current actor Owner. All counts are integers ≥0; no percentages/trends without defined source.

### List/drill-down extensions

Preserve `GET /api/tickets` Requester and `GET /api/staff/tickets` Staff/Admin. Success stays 200 `{ items, pagination }`; Staff items are StaffTicket, Requester list items retain the existing list shape below. Dashboard links navigate to lists, not mutate roles/identity.

```ts
type RequesterTicketListItem = { id: number; ticketNumber: string; summary: string;
  category: Reference; relatedSystem: Reference; requestedPriority: Priority; status: TicketStatus;
  createdAt: IsoUtc; updatedAt: IsoUtc };
```

Existing Requester controls: search (Number/summary/description), categoryId, relatedSystemId, `priority`, status; sort updatedAt/createdAt/ticketNumber/summary/`requestedPriority`, order asc/desc, page default1, pageSize default10 allowed10/25/50. The filter key is `priority`, but the sort value is `requestedPriority`; do not conflate them. Staff search Number/summary/Requester name/email; categoryId/relatedSystemId/requestedPriority/itPriority/status/owner (`me`, `unassigned`, or eligible numeric User ID), sort updatedAt/createdAt/ticketNumber/summary/requestedPriority/itPriority/status/owner. Preserve URL control state. Default updatedAt desc/id desc; other sorts use id in the same order as deterministic tie-breaker. Priority uses LOW < MEDIUM < HIGH < URGENT, not alphabetic. Status follows enum declaration order; Owner sorts name with PostgreSQL nulls-last asc/nulls-first desc, then id. Validate active reference/eligible Owner filters and search ≤100. Requester status now accepts all eight statuses, not only NEW.

Both lists add `statusGroup=active`, and paired `updatedSince`/`updatedBefore` ISO UTC values with from≤through, inclusive boundaries. Reject status plus statusGroup, incomplete date pair, malformed/duplicate/unknown queries, and caller-selected Requester identity with 400 VALIDATION_ERROR. Staff additionally adds `actionAssignee=me` (distinct Tickets with current actor's active Actions and active Ticket status); Requester cannot use Staff-only query keys. Lists retain empty-state pagination (totalPages=0 when zero results). Invalid page does not bypass scope. Inherited list 500 safe errors remain.

| Metric/section | Link/predicate |
| --- | --- |
| Requester active | `/tickets?statusGroup=active` |
| Requester attention/resolved/closed | `/tickets?status=WAITING_FOR_REQUESTER`, `RESOLVED`, or `CLOSED` |
| Recent (either role) | Corresponding list with updatedSince/from and updatedBefore/through; encode UTC values from response |
| Staff unassigned/my-owned | `/staff/tickets?statusGroup=active&owner=unassigned` or `owner=me` |
| Staff urgent | `/staff/tickets?statusGroup=active&itPriority=URGENT` |
| Staff current-user Actions metric | `/staff/tickets?statusGroup=active&actionAssignee=me` |
| Staff status/IT Priority summaries | Corresponding status; priority link additionally statusGroup=active |
| Ticket/Action row | Role-appropriate Ticket detail; Action row anchors/focuses that Action on Staff detail |

Share backend predicates and test dashboard count against matching list total on an unchanged fixture snapshot. Separate later requests may legitimately differ after other users mutate data; do not promise a cross-request frozen database. Recent means Ticket.updatedAt activity only; unchanged inherited attachment/comment/note operations are not falsely counted as Ticket updates.

## 5. Attachment and inherited API continuity

Do not replace routes with assumed old-lab aliases. The inspected current server and client use the following nested routes; these are retained verbatim. Metadata is PostgreSQL, bytes protected non-public local storage; no raw storage names/paths returned.

| Route | Request/access | Success | Specific failures |
| --- | --- | --- | --- |
| GET `/api/tickets/:ticketNumber/attachments` | Authorized Ticket reader | 200 `{ attachments: Attachment[] }`, active and removed metadata | Ticket 404; 500 ATTACHMENT_LIST_FAILED |
| POST same | Requester own, multipart single field `file` | 201 `{ attachment: Attachment }` | 400 VALIDATION_ERROR; 409 ATTACHMENT_LIMIT_REACHED for five active files; 413 ATTACHMENT_TOO_LARGE; 415 UNSUPPORTED_ATTACHMENT; Ticket404; 500 ATTACHMENT_CREATE_FAILED with DB/filesystem compensation |
| GET `/api/tickets/:ticketNumber/attachments/:attachmentId/download` | Authorized reader | 200 bytes, Content-Type verified MIME, Content-Length, sanitized Content-Disposition attachment filename + UTF-8 filename*, nosniff/no-store | Safe Attachment404 including removed; 500 ATTACHMENT_DOWNLOAD_FAILED if bytes unavailable |
| DELETE `/api/tickets/:ticketNumber/attachments/:attachmentId` | Requester own; `{ removalReason: string }` trimmed 5–250 | 200 `{ attachment: Attachment }` retained metadata | 400 VALIDATION_ERROR; 409 ATTACHMENT_ALREADY_REMOVED for repeat; scoped404; inherited safe500 INTERNAL_ERROR |

JPEG/PNG/WEBP/PDF extension/MIME/signature must agree; ≤5 MiB each, ≤5 active attachments per Ticket. Soft-removal retains protected bytes; removed entries cannot download and do not count toward limit. Create Ticket remains one atomic multipart request with `attachments` (plural), fields categoryId/relatedSystemId/requestedPriority/summary/description; no requesterId body. Buffer/validate, stage, transaction/counter/rows/final UUID moves, commit after success; roll back and remove request-owned staged/final files on failure. Existing single upload follows equivalent compensation.

The following retained exact success envelopes are regression contracts, not new implementation scope:

```ts
type AuthResponse = { user: SafeUser; csrfToken: string };
type LoginBody = { email: string; password: string };
type ChangePasswordBody = { currentPassword: string; newPassword: string; confirmPassword: string };
type CreateUserBody = { name: string; email: string; role: Role; isActive: boolean; initialPassword: string };
type UpdateUserBody = { name?: string; email?: string; role?: Role; isActive?: boolean };
type CreatedTicket = { id: number; ticketNumber: string; requester: RequesterIdentity;
  category: Reference; relatedSystem: Reference; requestedPriority: Priority; status: TicketStatus;
  summary: string; description: string; createdAt: IsoUtc; updatedAt: IsoUtc; attachments: Attachment[] };
```

| Endpoint | Request | Success/security |
| --- | --- | --- |
| GET `/api/health` | Public | 200 `{ status: 'ok', service: 'TokTickIT API' }`; does not prove credentials/seed/login work |
| POST `/api/auth/login` | LoginBody, permitted Origin | 200 AuthResponse + session cookie; 400 VALIDATION_ERROR; wrong credentials/inactive account401 AUTHENTICATION_FAILED; 429 LOGIN_RATE_LIMITED; safe500 AUTHENTICATION_FAILED |
| GET `/api/auth/me` | Session, including password-gated User | 200 AuthResponse; 401 SESSION_REQUIRED |
| POST `/api/auth/change-password` | Session+CSRF, ChangePasswordBody | 200 AuthResponse + rotated cookie; 400 VALIDATION_ERROR; 401 CURRENT_PASSWORD_INVALID does not sign out; safe500 AUTHENTICATION_FAILED; policy 12–128 with uppercase/lowercase/number/symbol, no edge whitespace, differs from current, confirmation matches |
| POST `/api/auth/logout` | Permitted Origin; session CSRF when session exists | 204 no body, clear cookie; repeated/no active session204; failed network/server logout leaves authenticated UI with retry |
| GET `/api/categories`, `/api/related-systems` | Usable session | 200 Reference[] of active values |
| GET `/api/requesters` | Usable session | 200 RequesterIdentity[] active references; not a login/selector context |
| POST `/api/tickets` | Requester atomic multipart described above | 201 `{ ticket: CreatedTicket, attachments: Attachment[] }` |
| GET `/api/tickets/:ticketNumber` | Requester own | 200 `{ ticket: RequesterTicketDetail }`; safe scoped404 |
| GET `/api/tickets/:ticketNumber/comments` | Authorized Ticket reader | 200 `{ comments: Communication[] }` |
| POST same | Reader with write protection, `{ content: string }` trim1–2000 | 201 `{ comment: Communication }`; append-only |
| GET `/api/tickets/:ticketNumber/internal-notes` | Staff/Admin | 200 `{ notes: Communication[] }`; Requester403 FORBIDDEN |
| POST same | Staff/Admin+write protection, `{ content: string }` trim1–2000 | 201 `{ note: Communication }`; Requester403; append-only |
| GET `/api/admin/users` | Admin; search/role validated, search≤100 | 200 `{ users: SafeUser[] }` |
| POST `/api/admin/users` | Admin+CSRF CreateUserBody | 201 `{ user: SafeUser }`; existing validation/email conflict, no plaintext password returned |
| PATCH `/api/admin/users/:userId` | Admin+CSRF nonempty UpdateUserBody | 200 `{ user: SafeUser }`; safe User404, existing duplicate-email409, safety rules below |
| POST `/api/admin/users/:userId/initial-password` | Admin+CSRF `{ initialPassword: string }` policy-valid | 200 `{ user: SafeUser }`; mustChangePassword true, sessions revoked |

Admin mutation precedence: existing self/last-active-Administrator protection → existing any-owned-Ticket guard USER_OWNS_TICKETS → new unfinished assigned-Action guard USER_HAS_ACTIVE_ACTIONS. Deactivate/demote-to-Requester conflict gives409 and leaves all data/sessions unchanged. Eligible Staff↔Admin role changes preserve assigned Actions but revoke sessions on actual role change. Actual activation changes also revoke sessions; password reset always revokes. Names/email-only changes retain existing session behavior. Historical completed/cancelled Action references remain valid when actors later become inactive. Test safety races with assignment under SERIALIZABLE retry protocol.

Inherited safe failure codes remain explicit: references500 REFERENCE_DATA_UNAVAILABLE; Requester list500 TICKET_LIST_FAILED; Staff list500 STAFF_QUEUE_FAILED; Ticket create500 TICKET_CREATE_FAILED; Comments list/create500 COMMENT_LIST_FAILED/COMMENT_CREATE_FAILED; Notes list/create500 NOTE_LIST_FAILED/NOTE_CREATE_FAILED; User list/create/update/reset500 USER_LIST_FAILED/USER_CREATE_FAILED/USER_UPDATE_FAILED/PASSWORD_RESET_FAILED. Other unclassified Ticket service failures use existing500 INTERNAL_ERROR. Admin validation400 VALIDATION_ERROR, missing/invalid User404 USER_NOT_FOUND, duplicate email409 DUPLICATE_EMAIL, self/last-Admin409 ADMINISTRATOR_SAFETY_VIOLATION. Credential errors do not become generic session-expiration redirects. All success/body schemas above are complete; inherited validation limits are retained rather than loosened for Lab 4.

## 6. Implementation and test dependencies

Issue #56 adds Action schema/list/create/update/history and User safety; #57 adds Actions UI; #58 integrates Ticket versions/gate/events/cancellation and existing callers; #59 adds dashboard APIs/list predicates; #60 adds dashboard routes/UI; #61 expands isolated Playwright coverage and regression; #62 finishes evidence. Transitional APIs must keep existing features functional until coordinated caller extensions land. [tests.md](tests.md) records planned tests and actual evidence; no endpoint is claimed implemented by this contract.
