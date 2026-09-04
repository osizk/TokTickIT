# Lab 2 - Test Plan and Evidence

All Lab 2 feature tests live under `server/tests/lab-02/`, `client/tests/lab-02/`, and `e2e/lab-02/`; feature scenarios were planned before product implementation and updated with their real result in the implementing branch. Issue #19 adds only release-state evidence coverage. This file records the release audit on `lab2-staging` at merge commit `9499959`; checks from final `main` remain a post-release gate.

## Summary Test Table

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Vitest | Ticket Number, field, query, and Attachment validation/unit boundaries | Passed locally: 5 validation/unit tests; Ticket Number formatting and concurrency are asserted by API-05 in `create-ticket.api.test.ts`. |
| 2 | Supertest/Vitest | Reference APIs, requester context, Ticket creation, ownership, list, detail, and Attachment APIs | Passed locally: complete server regression, 11 files and 37 tests. |
| 3 | Vitest + Testing Library | Requester selection, Create Ticket, My Tickets, Detail, Attachment states, and duplicate-submit behavior | Passed locally: complete client regression, 7 files and 31 tests (including STYLE-01). |
| 4 | Vitest/DOM + Playwright axe/DOM assertions | Zen Green classes, labels, errors, focus, badges, responsive classes, and non-color indicators | Passed by 3 stylesheet assertions, component DOM assertions, and Issue #18 axe, focus, viewport, no-scroll, and screenshot checks. |
| 5 | Playwright | Complete requester Ticket/Attachment lifecycle and cross-requester isolation | Passed with explicit isolated schema on desktop, tablet, and mobile (3 tests). |
| 6 | Playwright screenshots | Desktop, tablet, and mobile Create Ticket, My Tickets, and Ticket Detail evidence | 9 responsive lifecycle screenshots plus 27 submission-state screenshots were refreshed by the release run with captions in `artifacts/lab-02/screenshots/`. |
| 7 | npm/Vitest/Prisma | Final server/client regressions, builds, migration, and repeated idempotent seed | Passed on the release branch: server/client tests and builds, isolated migration, and two consecutive seed runs. Final `main` rerun remains gated on the release merge. |

The Issue #19 release audit is complete on `lab2-staging`; the final `main` and GitHub Project board checks are intentionally recorded as post-merge gates rather than claimed early.

### Issue #13 evidence (2026-08-26)

- [x] Planned failing baseline run recorded: missing `/api/related-systems` and `/api/requesters` returned `404`, and the existing category failure returned an unstructured error string.
- [x] `server/tests/lab-02/reference-data.test.ts` passes 5 tests; Lab 1 health/category regression tests also pass (8 server tests total).
- [x] `npm run build` passes on the Issue #13 branch.
- [x] `npx prisma migrate deploy` applies `20260826100000_lab2_data_reference` successfully.
- [x] `npm run prisma:seed` ran twice without duplicate conflicts; active endpoint counts remain 4 categories, 7 related systems, and 4 requesters, with one inactive requester retained in the database.
- [x] Issue #19 completed an equivalent isolated PostgreSQL schema audit with a temporary attachment directory: migration applied, seed ran twice, and counts remained 4 active categories, 7 related systems, 5 requesters (4 active and 1 inactive). Only `.env.test.example` is tracked; the real `.env.test`, credentials, and uploaded files remain local/ignored. A separate database named `toktickit_lab2_test` was not created because the local role lacks database-create permission.

### Issue #14 evidence (2026-08-27)

- [x] Planned failing baseline recorded before implementation: `client/tests/lab-02/RequesterSelection.test.tsx` failed because the requester API helper and Lab 2 route/context UI were not yet implemented; the four existing Lab 1 client tests passed.
- [x] `client/tests/lab-02/RequesterSelection.test.tsx` passes 7 tests covering loading, active options, disabled Continue, safe failure/Retry, empty state, startup storage validation, malformed/inactive stored IDs, protected-route guarding, and Change Requester.
- [x] Combined client regression run (`npm.cmd test -- --run` from `client/`) passes 2 test files and 11 tests: 7 Issue #14 tests plus 4 Lab 1 tests.
- [x] Client production build (`npm.cmd run build` from `client/`) passes after the requester-context implementation.
- [x] Relevant server regression run (`npm.cmd test -- --run` from `server/`) passes 3 test files and 8 tests, and the server TypeScript build passes.
- [x] Manual reference-API smoke check on 2026-08-28: `/api/requesters` returned HTTP 200 with 4 active records, `/api/categories` returned 4 records, and `/api/related-systems` returned 7 records.
- [x] Responsive, accessibility, and Playwright evidence was completed by Issue #18; the requester-context component suite remains part of the current 31-test client regression.

### Issue #15 evidence (2026-08-27)

- [x] Planned failing baseline recorded before implementation: the three new server suites could not import their not-yet-created validation/service modules, the create endpoint returned `404` instead of the planned `400`/`201`/`415` responses, and the initial client form test failed because the placeholder had no Summary field.
- [x] `server/tests/lab-02/ticket-validation.unit.test.ts` passes 3 tests for trimmed values, inclusive boundaries, exact priorities, malformed references, unsupported fields, and body `requesterId` rejection.
- [x] `server/tests/lab-02/attachment-validation.unit.test.ts` passes 2 tests for JPEG/PNG/WEBP/PDF signatures, the exact 5 MiB boundary, oversized files, and extension/MIME/signature mismatches.
- [x] `server/tests/lab-02/create-ticket.api.test.ts` passes 7 tests for context/body rules, successful multipart creation and metadata privacy, mismatched files, six-file rejection, staged-file compensation, storage failure, and concurrent unique `TKT-YYYY-######` allocation.
- [x] `server/tests/lab-02/create-ticket-rollback.api.test.ts` passes a deterministic post-row filesystem-failure test: the database transaction rolls back and staged/final files are removed.
- [x] Full server regression (`npm.cmd test -- --run`) passes 7 files and 21 tests, including all Lab 1 tests; server TypeScript build passes.
- [x] Full client regression (`npm.cmd test -- --run`) passes 3 files and 19 tests, including all Lab 1 tests; client production build passes.
- [x] Manual API smoke check on 2026-08-28: a valid `curl.exe` multipart request returned `201` with a backend Ticket Number, `createdAt`, `NEW`, and no stored filename/path; the temporary diagnostic Ticket was removed afterward.
- [x] Responsive screenshots and Playwright coverage were completed by Issues #18 and #19; this Issue #15 record remains the historical focused-test evidence.

### Issue #16 evidence (2026-08-28)

- [x] Planned failing baseline recorded before implementation: the new list API suite received `404` because `GET /api/tickets` did not exist, and the new My Tickets UI suite could not import the not-yet-created `fetchTickets` helper.
- [x] `server/tests/lab-02/my-tickets.api.test.ts` passes 4 tests for required requester context, inactive requester safety, invalid query validation, search across Ticket Number/summary/description, category/system/priority/status filters, sort/order, page sizes, pagination, public-field shape, and requester ownership isolation.
- [x] `client/tests/lab-02/MyTickets.test.tsx` passes 4 tests for loading/list controls, desktop table and mobile cards, URL query persistence, filter/page requests, distinct owned-empty and filtered-no-results states, clear filters, safe failure, and Retry.
- [x] Full server regression (`npm.cmd test -- --run`) passes 8 files and 25 tests; full client regression passes 4 files and 23 tests. Both TypeScript/production builds pass.
- [x] Server Vitest file parallelism is disabled because these integration suites share the isolated database/storage environment; the full server suite passed 25/25 on two consecutive runs without row-count races.
- [x] Updated the existing Create Ticket reference-data fixture to account for the new My Tickets route loading reference data before navigation to `/tickets/new`; no product behavior was weakened.
- [x] Responsive screenshots, manual browser/API behavior, and Playwright coverage were completed by Issues #18 and #19; the My Tickets component suite remains part of the current 31-test client regression.

### Issue #17 evidence (2026-08-29)

- [x] Planned failing baseline recorded before implementation: the new detail and Attachment API requests returned `404` because the Issue #17 routes did not yet exist.
- [x] `server/tests/lab-02/ticket-detail.api.test.ts` passes 3 tests for owned read-only detail fields, Attachment metadata privacy, required context, and identical safe `404` behavior for missing/cross-requester Tickets.
- [x] `server/tests/lab-02/attachments.api.test.ts` passes 8 tests for one-file upload, exact download bytes and safe headers, active/removed metadata, soft removal and repeat-removal conflict, active-capacity/free-slot behavior, signature/size validation, cross-requester isolation, and malformed JSON safety.
- [x] `server/tests/lab-02/attachment-rollback.api.test.ts` passes a deterministic post-row filesystem-failure test; the Attachment row rolls back and staged/final files are compensated.
- [x] `client/tests/lab-02/RequesterTicketDetail.test.tsx` passes 2 tests for read-only fields, excluded staff workflow fields, independent loading/error states, and safe Retry actions.
- [x] `client/tests/lab-02/AttachmentSection.test.tsx` passes 3 tests for client signature validation, upload, download, confirmation/reason, removed-row actions, and invalid-file rejection.
- [x] Full server regression (`npm.cmd test -- --run`) passes 11 files and 37 tests, including all Lab 1 tests; server TypeScript build passes.
- [x] Full client regression (`npm.cmd test -- --run`) passes 6 files and 28 tests, including all Lab 1 tests; client production build passes.
- [x] Manual browser/API behavior is represented by the focused API suites and the Issue #18 Playwright flow; responsive screenshots and Playwright coverage were completed by Issues #18 and #19.

### Issue #18 evidence (2026-08-29)

- [x] Planned failing baseline recorded before implementation: `npx --no-install playwright test --list` failed because the Playwright runner was not installed.
- [x] Added `@playwright/test` and `@axe-core/playwright` as client development dependencies; `client/playwright.config.ts` uses `testDir: "../e2e"` and supports `cd client && npx playwright test`.
- [x] `e2e/lab-02/requester-ticket-flow.spec.ts` covers requester selection, Create Ticket with a PDF, My Tickets search, owned detail, exact download, second-file upload, soft removal and blocked removed action, requester switching, and cross-requester API rejection.
- [x] The complete Playwright run passes all 3 projects: desktop (1440px), tablet (900px), and mobile (390px), with 3 tests passed.
- [x] Axe scans pass on requester selection, Create Ticket, Ticket Detail before/after removal, and My Tickets; keyboard focus and document/body horizontal-scroll assertions also pass.
- [x] The first axe run found an insufficient-contrast Attachment Remove link; the shared Zen Green link style was corrected with a header-specific override and the suite was rerun successfully.
- [x] Nine screenshots were refreshed by the Issue #19 release run under `artifacts/lab-02/screenshots/{create-ticket,my-tickets,ticket-detail}/`; captions and requirement mappings are in that directory's `README.md`.
- [x] Global and per-project E2E cleanup seeds idempotent reference data and removes only `E2E-18-` test Tickets, metadata, and protected files. Playwright uses the isolated `toktickit_e2e` PostgreSQL schema and `server/.test-attachments/toktickit_e2e/`; the development database and storage were verified empty after the run.
- [x] Post-Issue #18 regressions pass: server Vitest 11 files/37 tests plus build, and client Vitest 6 files/28 tests plus production build.
- [x] Issue #19 release-documentation and PR/review evidence audit completed on `lab2-staging`.
- [ ] Final `main` regression and final Project-board screenshot/status audit remain after the separately authorized release PR is merged.

### Issue #19 release audit (2026-08-30)

- [x] Release branch `feature/12-Lab2ReleaseEvidence` was created from the latest `lab2-staging` merge `9499959` (Issue #18 PR #27). No GitHub Issue, Project, PR, push, merge, or status mutation was performed by this audit.
- [x] Server regression: `npm.cmd test -- --run` passed 11 files and 37 tests; `npm.cmd run build` passed.
- [x] Client regression: `npm.cmd test -- --run` passed 7 files and 31 tests (including `ZenGreen.styles.test.tsx`); `npm.cmd run build` passed.
- [x] Playwright lifecycle: `PLAYWRIGHT_API_PORT=3019 PLAYWRIGHT_SCHEMA=toktickit_release_e2e npx.cmd playwright test` passed desktop (1440px), tablet (900px), and mobile (390px), 3 tests total. The config now always refuses reuse of an existing server process.
- [x] Playwright submission states: `lab-02/release-evidence-states.spec.ts` passed 2 evidence tests in each desktop, tablet, and mobile project (6 tests total); it produced 27 screenshots (the 9 required requester/Create Ticket states in each viewport) for the labsheet-required loading, empty, failure, validation, invalid-file, API-failure, submitting, and success states.
- [x] Full final Playwright command with both specs passed all 9 tests across desktop, tablet, and mobile with no skips; teardown left the isolated schema/storage clean.
- [x] The release audit used explicit isolated schemas (`toktickit_release_e2e` for the lifecycle run and `toktickit_release_final` for the full run) plus temporary protected storage; global teardown removed both. The post-run development check found 0 Tickets, 0 Attachments, 0 release schemas, and 0 files in `server/attachments`.
- [x] Isolated migration/repeated-seed audit created a disposable schema, ran `npm.cmd run prisma:migrate`, ran `npm.cmd run prisma:seed` twice, and verified 4 categories, 7 related systems, 5 requesters (4 active and 1 inactive). The schema and temporary directory were removed afterward.
- [x] `reviewer.md` now records my authored PRs #20 and #22-#27 plus my reviews of the partner's Lab 2 PRs #19-#25, with actual teammate Approve links where available, reviewer comments, and author/friend responses. My authored PR #20 remains explicitly recorded as the accepted Lab 2 legacy comment-only evidence.
- [x] `README.md` now documents Lab 2 setup, isolated test configuration, Playwright command, protected-storage rules, and contract/evidence links. `specification.md` now records the numbered branch workflow and final release gate.
- [x] The labsheet was checked with the PDF extraction workflow, including the exact `Answer Part 1` through `Answer Part 9` heading order and the required captions and repository/Issue/PR/Project/document links for the one-PDF submission.
- [ ] Before submission, rerun the full commands from final `main` after the release PR is merged, capture the final GitHub Project board with every Lab 2 Issue in Done, and attach the final readable screenshots/links to the PDF.

### Test screenshots

1. Create Ticket evidence: `artifacts/lab-02/screenshots/create-ticket/` (desktop/tablet/mobile captured)
2. My Tickets evidence: `artifacts/lab-02/screenshots/my-tickets/` (desktop/tablet/mobile captured)
3. Ticket Detail and Attachment evidence: `artifacts/lab-02/screenshots/ticket-detail/` (desktop/tablet/mobile captured)
4. Required selection/Create Ticket states: `artifacts/lab-02/screenshots/release-states/{desktop,tablet,mobile}/` (27 captures with captions)

Each final screenshot must include a short caption stating what it shows and which requirement it proves.

## Detailed Planned-Test Table

| Test ID | Tool/level | Requirement / AC | Test and expected result | Automated test path | Result |
|---|---|---|---|---|---|
| UNIT-01 | Vitest/API boundary | BR-01, AC-06 | Ticket Number formatter produces `TKT-YYYY-######`; the concurrent create path also proves uniqueness. | `server/tests/lab-02/create-ticket.api.test.ts` (API-05) | Passed locally (4 concurrent creates; exact format and unique values asserted) |
| UNIT-02 | Vitest unit | BR-08/09, AC-07 | Trimmed field limits, blank values, and priority enum validation are exact. | `server/tests/lab-02/ticket-validation.unit.test.ts` | Passed locally (3 tests) |
| UNIT-03 | Vitest unit | BR-12, AC-08 | Extension/MIME/signature, 5 MiB boundary, filename, and count rules are exact. | `server/tests/lab-02/attachment-validation.unit.test.ts` | Passed locally (2 tests; count is covered by API-04) |
| API-01 | Supertest | FR-01, AC-01/02/23 | Active requester/reference endpoints return active records only and safe failures. | `server/tests/lab-02/reference-data.test.ts` | Passed locally (5 tests) |
| API-02 | Supertest | FR-07, AC-05/06 | Valid multipart create returns `201`, one Ticket, official number, `NEW`, `createdAt`, and metadata. | `server/tests/lab-02/create-ticket.api.test.ts` | Passed locally (1 test) |
| API-03 | Supertest | BR-05/08/09, AC-07/19 | Missing context, body requesterId, invalid fields, inactive references, and invalid priority return documented errors. | `server/tests/lab-02/create-ticket.api.test.ts`, `server/tests/lab-02/ticket-validation.unit.test.ts` | Passed locally for context/body/reference/field cases |
| API-04 | Supertest | BR-13/14, AC-08/09 | Invalid file, storage failure, and transaction failure leave no Ticket, metadata, or request-created file. | `server/tests/lab-02/create-ticket.api.test.ts`, `server/tests/lab-02/create-ticket-rollback.api.test.ts` | Passed locally: invalid-file, count, storage failure, staged-file compensation, and forced post-row move failure |
| API-05 | Supertest | BR-01, AC-06 | Concurrent creates produce unique correctly formatted numbers. | `server/tests/lab-02/create-ticket.api.test.ts` | Passed locally (1 test with 4 concurrent creates) |
| API-06 | Supertest | FR-09/10, AC-10/11/12 | Owned list returns search, filters, sorts, stable order, page sizes, and metadata. | `server/tests/lab-02/my-tickets.api.test.ts` | Passed locally (4 tests) |
| API-07 | Supertest | BR-17/19, AC-11 | Invalid query parameters return `400`; beyond-last valid pages return empty items. | `server/tests/lab-02/my-tickets.api.test.ts` | Passed locally (included in 4-test suite) |
| API-08 | Supertest | FR-11/15, AC-13/14 | Owned detail succeeds; missing and cross-owner detail both return safe `404`. | `server/tests/lab-02/ticket-detail.api.test.ts` | Passed locally (3 tests) |
| API-09 | Supertest | FR-12/13/14, AC-15/16/17/18 | Metadata, add, active download, capacity, removal, retained metadata, and blocked removed download work. | `server/tests/lab-02/attachments.api.test.ts` | Passed locally (7 tests) |
| API-10 | Supertest | BR-12/14, AC-08/17 | Attachment validation and filesystem/database compensation leave safe state. | `server/tests/lab-02/attachments.api.test.ts`, `server/tests/lab-02/attachment-rollback.api.test.ts` | Passed locally (validation and forced post-row rollback) |
| API-11 | Supertest | FR-15, AC-14/19 | Cross-owner detail, metadata, download, add, and remove are safe `404`s. | `server/tests/lab-02/ticket-detail.api.test.ts`, `server/tests/lab-02/attachments.api.test.ts` | Passed locally |
| UI-01 | Vitest/Testing Library | FR-01/02, AC-01/02 | Selector loading, empty, Retry, active options, disabled Continue, labels, and focus. | `client/tests/lab-02/RequesterSelection.test.tsx` | Passed locally (7 Issue #14 tests) |
| UI-02 | Vitest/Testing Library | FR-03/04, AC-03/04 | Valid/invalid sessionStorage and Change Requester clear/reload context. | `client/tests/lab-02/RequesterSelection.test.tsx` | Passed locally (7 Issue #14 tests) |
| UI-03 | Vitest/Testing Library | FR-05/06/17, AC-05/07/09/20 | Create references, validation, file errors, preserved failure values, and duplicate-submit guard. | `client/tests/lab-02/CreateTicket.test.tsx` | Passed locally (8 tests) |
| UI-04 | Vitest/Testing Library | FR-07/08, AC-05/06 | Success displays backend Ticket Number/date/status and next action. | `client/tests/lab-02/CreateTicket.test.tsx` | Passed locally (included in 8-test suite) |
| UI-05 | Vitest/Testing Library | FR-09/10, AC-10/11/12 | My Tickets query controls, table/cards, loading, empty/no-results/failure, pagination. | `client/tests/lab-02/MyTickets.test.tsx` | Passed locally (4 tests) |
| UI-06 | Vitest/Testing Library | FR-11/12/13/14, AC-13/15/16/17/18 | Detail read-only fields, Attachment states, upload/download, confirmation/reason, removed state. | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Passed locally (2 tests) |
| UI-07 | Vitest/Testing Library | AC-17/18 | Removed rows have no download action; invalid/busy actions are disabled. | `client/tests/lab-02/AttachmentSection.test.tsx` | Passed locally (3 tests) |
| STYLE-01 | Vitest/DOM + Playwright | FR-16, AC-21/22 | Required labels, asterisks, errors, focus, buttons, badges, responsive classes, and non-color indicators. | `client/tests/lab-02/ZenGreen.styles.test.tsx`; `client/tests/lab-02/{RequesterSelection,CreateTicket,MyTickets,RequesterTicketDetail,AttachmentSection}.test.tsx`; `e2e/lab-02/requester-ticket-flow.spec.ts`; `artifacts/lab-02/screenshots/` | Passed locally: 3 stylesheet assertions, component assertions, axe/focus/viewport/no-scroll assertions, and visual inspection of 9 captioned screenshots |
| E2E-01 | Playwright | AC-01/05/06/10/13/15/16/17 | Requester A selects, creates with file, finds, opens, downloads, adds, and removes. | `e2e/lab-02/requester-ticket-flow.spec.ts` | Passed locally on desktop/tablet/mobile (3 tests) |
| E2E-02 | Playwright | AC-14 | Requester B cannot see or directly access Requester A resources. | `e2e/lab-02/requester-ticket-flow.spec.ts` | Passed locally on desktop/tablet/mobile (detail, metadata, download, add, and remove all safe 404s) |
| E2E-03 | Playwright | AC-21/22 | Required screens remain usable at desktop/tablet/mobile sizes. | `e2e/lab-02/requester-ticket-flow.spec.ts` | Passed locally with viewport assertions and screenshots |
| EVID-01 | Playwright/screenshots | AC-01/02/05/06/07/08/09/20 | Capture the labsheet-required requester loading/empty/failure and Create Ticket initial/validation/invalid-file/API-failure/submitting/success states. | `e2e/lab-02/release-evidence-states.spec.ts`; `artifacts/lab-02/screenshots/release-states/{desktop,tablet,mobile}/` | Passed locally: 6 evidence tests across 3 viewports; 27 captioned screenshots |
| VIS-01 | Playwright/screenshots | FR-16, AC-21 | Screenshots show Zen Green tokens, field states, table/cards, and no clipping/overlap/scroll. | `artifacts/lab-02/screenshots/{create-ticket,my-tickets,ticket-detail}/` | Passed locally; 9 screenshots and caption README captured |
| REG-01 | npm/Vitest/Prisma | AC-24 | Lab 1 tests/builds, Lab 2 tests/builds, migrations, and repeated seed pass from the release candidate; final `main` rerun is a release gate. | `server/tests/lab-01/*`, `client/tests/lab-01/*`, documented commands, Issue #19 audit | Release candidate passed; final `main` rerun pending release merge |

## Acceptance-Criterion Traceability

| AC | Planned Test IDs |
|---|---|
| AC-01 | API-01, UI-01, E2E-01, EVID-01 |
| AC-02 | API-01, UI-01, EVID-01 |
| AC-03 | UI-02 |
| AC-04 | UI-02, E2E-02 |
| AC-05 | API-02, UI-03, UI-04, E2E-01, EVID-01 |
| AC-06 | UNIT-01, API-02, API-05, UI-04, E2E-01, EVID-01 |
| AC-07 | UNIT-02, API-03, UI-03, EVID-01 |
| AC-08 | UNIT-03, API-04, API-10, UI-03, EVID-01 |
| AC-09 | API-04, UI-03, EVID-01 |
| AC-10 | API-06, UI-05, E2E-01/02 |
| AC-11 | API-06/07, UI-05 |
| AC-12 | API-06, UI-05 |
| AC-13 | API-08, UI-06, E2E-01 |
| AC-14 | API-08/11, E2E-02 |
| AC-15 | API-09/10, UI-06/07, E2E-01 |
| AC-16 | API-09/11, UI-06/07, E2E-01/02 |
| AC-17 | API-09/10, UI-06/07, E2E-01 |
| AC-18 | API-09, UI-07 |
| AC-19 | API-03/11, UI-01 |
| AC-20 | UI-03, STYLE-01, EVID-01 |
| AC-21 | STYLE-01, E2E-03, VIS-01 |
| AC-22 | STYLE-01, E2E-03 |
| AC-23 | API-01, REG-01 |
| AC-24 | REG-01, E2E-01/02/03, VIS-01 |

## Responsive and Visual Checklist

- [x] Desktop, tablet, and mobile screenshots exist for Create Ticket, My Tickets, and Ticket Detail.
- [x] Zen Green colors, readable text, surfaces, and button hierarchy match `ui-spec.md` for the exercised screens.
- [x] Editable/read-only fields, required markers, and field-level messages are clear.
- [x] Focus indicators and non-color status meaning are visible.
- [x] Table/card conversion, filters, pagination controls, Attachment names, and dialogs remain usable in the exercised flow.
- [x] No clipping, overlap, hidden actions, or horizontal page scrolling was observed or reported by the viewport assertions.

## Test Commands

```bash
cd server
npm test
npm run build

cd ../client
npm test
npm run build
npx playwright test
```

Run migrations and the seed against the isolated documented database; run the seed repeatedly and verify no duplicate reference records.

## Results and Evidence

Record passing terminal output and screenshots as each Issue is completed. Every final image must include a caption describing what it proves.

| Area | Result | Evidence |
|---|---|---|
| Unit | Passed locally | 5 validation/unit tests; Ticket Number format/concurrency is covered by API-05. |
| API/integration | Passed locally | Complete server regression: 11 files, 37 tests; focused API evidence in Issues #13, #15, #16, and #17. |
| UI/style/accessibility | Passed locally | Complete client regression: 7 files, 31 tests; stylesheet/component assertions, axe, focus, viewport, and screenshot evidence. |
| Responsive/visual | Passed locally | 9 refreshed desktop/tablet/mobile screenshots plus caption README under `artifacts/lab-02/screenshots/`. |
| E2E | Passed locally (9 passed, no skips) | `PLAYWRIGHT_API_PORT=3019 PLAYWRIGHT_SCHEMA=toktickit_release_final npx.cmd playwright test` - lifecycle and submission-state evidence passed on desktop, tablet, and mobile. |
| Submission-state screenshots | Passed locally | `lab-02/release-evidence-states.spec.ts` - 6 evidence tests passed across 3 viewports; 27 readable, captioned images under `artifacts/lab-02/screenshots/release-states/{desktop,tablet,mobile}/`. |
| Migration/repeated seed | Passed in isolated schema | Release audit applied migration and ran seed twice; exact reference counts verified and schema removed. |
| Development DB/storage hygiene | Passed after cleanup | 0 Tickets, 0 Attachments, 0 release schemas, and 0 files in protected development storage after E2E teardown. |
| Final `main` regression | Pending by design | Run after the release PR is approved and merged into `main`. |

## Known Limitations or Deferred Tests

- Real authentication and shared/object storage are deferred to later labs.
- In-app Attachment preview is not required; active download and removed-download blocking are required.
- Final `main` and GitHub Project board evidence are intentionally pending until the separately authorized release PR is approved and merged; `lab2-staging` is the current release candidate and source for this audit.
