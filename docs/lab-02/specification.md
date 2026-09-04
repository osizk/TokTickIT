# Lab 2 Sprint Engineering Specification

## 1. Sprint Goal

Deliver a Requester-facing ticketing MVP in which a selected temporary Development Requester can create, find, inspect, and manage owned support Tickets and permitted Attachments. The selected identity is a testing context for Lab 2, not authentication.

## 2. Stakeholder Request Interpretation

The IT department needs a professional Requester experience for describing a problem, selecting its Category and Related System, choosing a Requested Priority, attaching evidence, and submitting a request. After submission, the Requester must find only their own Tickets, search/filter/sort/page through them, open Ticket Detail, and manage permitted Attachments. The backend owns the official Ticket Number, persisted ownership, validation, and safe access decisions. The interface establishes reusable Zen Green and responsive conventions for later labs.

## 3. Scope

### Included

- Development Requester Selection and switching using a session-only browser context.
- Active Category and Related System reference data.
- Create Ticket with optional Attachments in one atomic multipart request.
- Backend-generated `TKT-YYYY-######` Ticket Number and initial `NEW` status.
- Requester-owned My Tickets with search, filtering, sorting, and pagination.
- Owned Ticket Detail and Attachment metadata, add, download, and soft removal.
- Strict frontend validation, authoritative backend validation, safe errors, ownership checks, accessibility, responsiveness, and visual evidence.

### Excluded

Real authentication/security, passwords, tokens, roles, IT Staff workflow, Ticket Owner, IT Priority, comments, notes, Actions Taken, Service Actions, Event Log, Resolution Summary, administration, and Ticket status transitions after `NEW`.

## 4. Functional Requirements

- **FR-01:** The application shall load and display only active Development Requesters from PostgreSQL.
- **FR-02:** The selector shall provide loading, empty, safe failure/Retry, keyboard-accessible controls, visible focus, and a disabled Continue button until selection.
- **FR-03:** The selected Requester ID shall be stored only in `sessionStorage`, validated on startup, and cleared when missing, invalid, or inactive.
- **FR-04:** Requester-owned routes shall require a valid selected Requester; Change Requester shall clear requester-specific state and reload all owned data.
- **FR-05:** The application shall load active Categories and Related Systems from PostgreSQL.
- **FR-06:** Create Ticket shall capture Category, Related System, Requested Priority, Summary, Description, and zero-to-five permitted Attachments while displaying Requester and backend-generated fields as read-only.
- **FR-07:** The backend shall validate and persist a Ticket with a unique `TKT-YYYY-######` number and initial `NEW` status.
- **FR-08:** Create Ticket shall use one multipart request with repeated field name `attachments` and application-level database/filesystem compensation.
- **FR-09:** My Tickets shall show only Tickets owned by the selected Requester.
- **FR-10:** My Tickets shall support search, Category/System/Priority/Status filters, sorting, page size 10/25/50, pagination, Clear Filters, and URL query state.
- **FR-11:** Ticket Detail shall show owned Ticket fields read-only and provide an Attachment section.
- **FR-12:** The API shall return active and removed Attachment metadata without exposing storage paths or stored filenames.
- **FR-13:** An owner shall add one permitted Attachment to an owned Ticket, download an active Attachment, and soft-remove an owned Attachment with confirmation and reason.
- **FR-14:** Removed Attachments shall retain metadata but cannot be downloaded or previewed and do not count toward the active limit.
- **FR-15:** Requester, Ticket, and Attachment ownership shall be enforced server-side; missing and cross-owner resources use the same safe `404`.
- **FR-16:** The UI shall implement the Zen Green visual system, accessible controls, field-level errors, busy states, and desktop/tablet/mobile layouts without clipping or horizontal scrolling.
- **FR-17:** The product shall preserve entered Create Ticket values after a failed request and prevent duplicate client submissions while busy.
- **FR-18:** Tests and evidence shall trace every Acceptance Criterion to an actual test path and final result.

## 5. Business Rules

- **BR-01:** Ticket Number format is `TKT-YYYY-######`; allocation is backend-owned and unique.
- **BR-02:** A Ticket's Ticket Date is its backend-generated `createdAt`.
- **BR-03:** A new Ticket starts with Current Status `NEW`; Lab 2 has no status transition.
- **BR-04:** `X-Requester-Id` is a spoofable Lab 2 testing context, not authentication.
- **BR-05:** A Ticket request must not accept `requesterId` in JSON or multipart fields.
- **BR-06:** Every requester-scoped request requires an active Requester context.
- **BR-07:** A missing resource and a cross-requester resource return the same safe `404`.
- **BR-08:** Summary is required and 5–120 trimmed characters; Description is required and 10–5000 trimmed characters.
- **BR-09:** Requested Priority is one of `LOW`, `MEDIUM`, `HIGH`, or `URGENT`.
- **BR-10:** Only active Categories, Related Systems, and Development Requesters are selectable.
- **BR-11:** A Ticket may have at most five active Attachments.
- **BR-12:** Attachments must be JPG/JPEG, PNG, WEBP, or PDF; extension, MIME, and signature must agree; each file is at most 5 MiB.
- **BR-13:** Create Ticket validates every field/file before persistence and commits Ticket plus Attachments only after all staged files move successfully.
- **BR-14:** Any create/add failure rolls back database work and removes every staged/final file created by that request.
- **BR-15:** Soft removal records time, reason, and remover while retaining metadata and protected bytes.
- **BR-16:** Removed Attachments cannot be downloaded or previewed and do not consume an active slot.
- **BR-17:** My Tickets defaults to `updatedAt desc`, then `id desc`, page 1, page size 10.
- **BR-18:** Search covers Ticket Number, Summary, and Description; filters cover Category, Related System, Requested Priority, and Status.
- **BR-19:** Invalid list parameters return `400`; valid pages beyond the end return empty results with metadata.
- **BR-20:** The client disables and guards Submit while a request is in flight; server idempotency keys are outside Lab 2.
- **BR-21:** The labsheet reference image does not authorize excluded staff, collaboration, resolution, or workflow fields.

## 6. UI Specification Summary

Routes are `/select-requester`, `/tickets`, `/tickets/new`, and `/tickets/:ticketNumber`. A route guard requires a valid session Requester. The shell shows TokTickIT identity, active navigation, selected Requester, and Change Requester.

Zen Green tokens are primary `#006B3C`, secondary `#0B7A46`, pale `#EAF6EF`, and near-white `#F5F7F6`, with white cards, readable charcoal-green text, visible focus, field-level errors, non-color-only badges, and consistent controls.

Desktop is `>=992px`, tablet `768–991px`, and mobile `<768px`. Desktop uses a centered multi-column layout; tablet uses practical two-column grouping; mobile stacks fields and uses Ticket cards. No viewport may clip labels, overlap messages, hide actions, or scroll horizontally.

Create Ticket has reference-data loading/failure states, read-only Requester/Ticket Number/Ticket Date fields, field validation, Attachment validation, busy submission, preserved failure values, and success showing the official number. My Tickets has URL-backed search/filter/sort/page controls, table/cards, loading, failure, empty, no-results, and pagination states. Ticket Detail shows owned Ticket fields read-only and active/removed Attachment metadata with upload, download, and confirmed soft removal.

## 7. Data Changes

Add `Requester`, `RelatedSystem`, `TicketCounter`, `Ticket`, and `Attachment`; add `isActive` and required timestamps to `Category`. Use `TicketPriority` (`LOW`, `MEDIUM`, `HIGH`, `URGENT`) and `TicketStatus` (`NEW`) enums. Use unique email/name/number constraints, restrictive foreign keys, requester-first ownership indexes, reference/filter/sort indexes, and soft-removal fields. Use an annual counter row and a transaction for Ticket Number allocation. Seed four active Requesters, one inactive Requester, four Categories, and seven Related Systems idempotently.

### 7.1 Database design justifications

`TicketCounter` is a separate row for each calendar year so the backend can lock and increment one authoritative sequence inside the Ticket transaction. This makes `TKT-YYYY-######` allocation concurrency-safe, prevents duplicate numbers, and naturally starts a new six-digit sequence each year.

Attachments use soft removal rather than deleting their database row or immediately deleting their protected bytes. The retained metadata and `removedAt`/`removalReason`/`removedByRequesterId` values provide an audit trail, while the API blocks download and preview and excludes removed rows from the five-active-attachment limit. This preserves evidence for review without exposing or serving removed content.

### 7.2 Exact data model contract

Unless a later approved migration says otherwise, database identifiers use Prisma `Int @id @default(autoincrement())`, matching the existing `Category` model and the public reference-data shapes. The UUID used in a protected attachment path is independent of the database identifier. Persist timestamps as UTC `DateTime`; Prisma `@updatedAt` maintains `updatedAt` on updates.

**`Requester`**

- Fields: `id Int @id @default(autoincrement())`; `name String`; `email String @unique`; `isActive Boolean @default(true)`; `createdAt DateTime @default(now())`; `updatedAt DateTime @default(now()) @updatedAt`.
- Relations: `tickets Ticket[]`; `removedAttachments Attachment[] @relation("AttachmentRemovedBy")`.
- Constraints/indexes: active requester queries use an index on `[isActive, name]`; inactive rows remain in the database but are never returned by the reference API.

**`Category`**

- Fields: existing `id Int @id @default(autoincrement())` and `name String @unique`; add `isActive Boolean @default(true)` and `updatedAt DateTime @default(now()) @updatedAt`; retain `createdAt DateTime @default(now())`.
- Relations: `tickets Ticket[]`.
- Constraints/indexes: active selector queries use `[isActive, name]`; seed names are idempotent and unique.

**`RelatedSystem`**

- Fields: `id Int @id @default(autoincrement())`; `name String @unique`; `isActive Boolean @default(true)`; `createdAt DateTime @default(now())`; `updatedAt DateTime @default(now()) @updatedAt`.
- Relations: `tickets Ticket[]`.
- Constraints/indexes: active selector queries use `[isActive, name]`; seed names are idempotent and unique.

**`TicketCounter`**

- Fields: `id Int @id @default(autoincrement())`; `year Int @unique`; `lastIssued Int @default(0)`; `createdAt DateTime @default(now())`; `updatedAt DateTime @default(now()) @updatedAt`.
- Relations: none exposed to the API.
- Constraints/indexes: exactly one row per year; allocation locks the year row, increments `lastIssued`, and formats the result as six digits before creating the Ticket.

**`Ticket`**

- Fields: `id Int @id @default(autoincrement())`; `ticketNumber String @unique`; `requesterId Int`; `categoryId Int`; `relatedSystemId Int`; `requestedPriority TicketPriority`; `status TicketStatus @default(NEW)`; `summary String`; `description String`; `createdAt DateTime @default(now())`; `updatedAt DateTime @default(now()) @updatedAt`.
- Relations: `requester Requester @relation(fields: [requesterId], references: [id], onDelete: Restrict)`; `category Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)`; `relatedSystem RelatedSystem @relation(fields: [relatedSystemId], references: [id], onDelete: Restrict)`; `attachments Attachment[]`.
- Constraints/indexes: requester ownership/list queries use `[requesterId, updatedAt, id]`, `[requesterId, createdAt, id]`, and requester/filter columns; `ticketNumber` is unique. `createdAt` is the backend-generated Ticket Date.

**`Attachment`**

- Fields: `id Int @id @default(autoincrement())`; `ticketId Int`; `originalName String`; `mimeType String`; `sizeBytes Int`; `storedFilename String @unique`; `uploadedAt DateTime @default(now())`; `removedAt DateTime?`; `removalReason String?`; `removedByRequesterId Int?`.
- Relations: `ticket Ticket @relation(fields: [ticketId], references: [id], onDelete: Restrict)`; `removedByRequester Requester? @relation("AttachmentRemovedBy", fields: [removedByRequesterId], references: [id], onDelete: Restrict)`.
- Constraints/indexes: use `[ticketId, removedAt]` for active-count and metadata queries; `sizeBytes` is at most 5 MiB; `storedFilename` and all filesystem paths are internal and never serialized in API responses.

Enums are exactly:

```prisma
enum TicketPriority { LOW MEDIUM HIGH URGENT }
enum TicketStatus { NEW }
```

## 8. API Contract Summary

Use `X-Requester-Id` on requester-scoped operations and structured errors with `code`, `message`, and optional `fieldErrors`. Implement:

- `GET /api/categories`
- `GET /api/related-systems`
- `GET /api/requesters`
- `POST /api/tickets` (multipart, repeated `attachments`)
- `GET /api/tickets`
- `GET /api/tickets/:ticketNumber`
- `GET /api/tickets/:ticketNumber/attachments`
- `POST /api/tickets/:ticketNumber/attachments`
- `GET /api/tickets/:ticketNumber/attachments/:attachmentId/download`
- `DELETE /api/tickets/:ticketNumber/attachments/:attachmentId`

Use `200` for retrieval/download/removal, `201` for creation, `400` for invalid input/query/context, `404` for unavailable/absent/unauthorized resources, `409` for active-capacity or already-removed conflicts, `413` for oversized files, `415` for unsupported or signature-mismatched files, and safe `500` responses.

## 9. Acceptance Criteria

- **AC-01:** Given active Requesters exist, when the selector loads, then only active Requesters appear and Continue remains disabled until selection.
- **AC-02:** Given the Requester API is loading, empty, or failing, when the selector renders, then the corresponding loading, empty, or safe Retry state is accessible and usable.
- **AC-03:** Given a stored Requester ID is valid, when the app starts, then it is retained; given it is invalid/inactive, when startup validation completes, then it is cleared and selection is shown.
- **AC-04:** Given Requester A is selected, when Change Requester selects B, then requester-owned data, filters, and list/detail state reload for B.
- **AC-05:** Given valid Ticket fields and zero-to-five valid files, when the owner submits, then one Ticket and all Attachments are persisted and a `201` response displays the official number.
- **AC-06:** Given a successful create, then the number matches `TKT-YYYY-######`, Ticket Date comes from `createdAt`, and status is `NEW`.
- **AC-07:** Given a blank or boundary-invalid field, when submission is attempted, then a nearby message appears, the API is not called, and focus/ARIA state identifies the error.
- **AC-08:** Given any invalid/oversized/unsupported/mismatched Attachment, when Create Ticket is submitted, then no Ticket or file remains and a safe error is shown.
- **AC-09:** Given an unexpected create failure, when the response fails, then field values/files remain available and no partial Ticket is visible.
- **AC-10:** Given Requester A and B have Tickets, when A opens My Tickets, then only A's Tickets appear.
- **AC-11:** Given list query controls are used, when a request is made, then search, filters, sorting, pagination, page sizes, defaults, metadata, and invalid-query behavior match the API contract.
- **AC-12:** Given no owned Tickets or no matches, when My Tickets loads, then empty and no-results states are distinct and actionable.
- **AC-13:** Given an owned Ticket Number, when the owner opens detail, then all Lab 2 Ticket fields are read-only and correct.
- **AC-14:** Given a Ticket or Attachment owned by another Requester, when it is requested directly, then the API returns the same safe `404` as a missing resource.
- **AC-15:** Given an owned Ticket has fewer than five active Attachments, when one valid file is added, then metadata is returned and active count increases.
- **AC-16:** Given an active Attachment, when it is downloaded, then safe headers/content are returned; given it is removed, then download/preview is blocked.
- **AC-17:** Given an active owned Attachment and valid reason, when removal is confirmed, then metadata remains with removal audit fields and the slot becomes available.
- **AC-18:** Given five active Attachments, when another is added, then the API returns `409`; given a removed Attachment exists, then it does not count toward five.
- **AC-19:** Given any requester-scoped API receives no/malformed/inactive context, when it runs, then safe documented status/error behavior occurs.
- **AC-20:** Given a Submit request is in flight, when the user clicks again, then only one request is sent and the button is busy/disabled.
- **AC-21:** Given desktop, tablet, and mobile viewports, when the required screens render, then no clipping, overlap, unreadable control, or horizontal page scroll occurs.
- **AC-22:** Given keyboard-only interaction, when the user navigates forms, lists, dialogs, and buttons, then labels, focus, messages, and actions are accessible.
- **AC-23:** Given the seed runs repeatedly, when database contents are inspected, then required reference records have no duplicates.
- **AC-24:** Given the exact release candidate that will be promoted into `main`, when all documented commands run before promotion, then server/client tests/builds, Playwright, migrations, seed verification, traceability, and evidence audits pass; the candidate SHA is recorded and must not change before merge.

## 10. Product Definition of Done

- All approved FR, BR, and AC scope is implemented without excluded functionality.
- Backend validation and ownership are authoritative; frontend validation is strict and accessible.
- Migration and repeated seed are safe; test database/storage are isolated.
- All planned tests pass against the exact pre-main release candidate; none are skipped, disabled, or replaced by unrelated tests, and the tested candidate SHA is recorded before promotion.
- API, UI, data, responsive, accessibility, and attachment behavior match this contract.
- `tests.md` maps every AC to an actual test path and final result.
- `ai-use.md` contains real prompts, decisions, verification, and reflection.
- `reviewer.md` contains review identity, PR links, responses, approvals, and merge evidence.
- README commands are current; screenshots are readable, captioned, and linked to requirements.
- All eight Issues are Done on the final Project board and release integration is documented.

## 11. Assumptions and Decisions

- Protected local storage is acceptable for this coursework deployment; object storage is deferred.
- Attachment bytes use a configurable local root and are never served as public static files.
- Dates are persisted as UTC and localized only for display.
- The real `.env.test` and credentials are never committed; only `.env.test.example` is committed.
- Server Vitest and Playwright require the local ignored `server/.env.test` and reject database names that do not end with `_test`; neither falls back to `server/.env`, and Playwright additionally accepts only the documented E2E schema allowlist.
- Migration and repeated-seed verification uses the guarded `npm run prisma:test:migrate` and `npm run prisma:test:seed` commands, which require `server/.env.test` and reject a database or attachment-storage path outside the disposable test environment.
- Playwright is a client development dependency, configured under `client/` with `testDir: ../e2e` and run by `cd client && npx playwright test`.
- Issue 1 used the numbered `feature/5-Lab2Contract` branch and was merged before the product increments. Issues 2 through 8 followed the approved numbered branches through `feature/12-Lab2ReleaseEvidence`, with each feature PR targeting `lab2-staging`; the final release PR targets `main` only after the release evidence is approved. The Lab 1-only `feature/Lab1Doc` exception and an unapproved Lab 2 documentation branch are not part of this workflow.
