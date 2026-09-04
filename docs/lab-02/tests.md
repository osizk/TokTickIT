# Lab 2 - Test Plan and Evidence

All Lab 2 feature tests live under `server/tests/lab-02/`, `client/tests/lab-02/`, and `e2e/lab-02/`; feature scenarios were planned before product implementation and updated with their real result in the implementing branch. Issue #19 adds only release-state evidence coverage. The release-candidate audit was completed on `lab2-staging` at merge commit `9499959`, and the final technical audit was then rerun from `main` at merge commit `c32005bc01dd54abee0dcf2a7c3ed275cb415be7` (PR #30).

The safe implementation/release-candidate checks and the final-`main` checks below were run against disposable test databases and temporary protected storage. This documentation branch is based on `lab2-staging` and contains documentation-only changes; it does not change product code. The recorded SHA identifies the final `main` code audit; if this documentation-only branch is promoted later, the resulting merge SHA is a new documentation commit and must be the SHA referenced by the submission package.

## Summary Test Table

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Vitest | Ticket Number, field, query, and Attachment validation/unit boundaries | Passed locally: 5 validation/unit tests; Ticket Number formatting and concurrency are asserted by API-05 in `create-ticket.api.test.ts`. |
| 2 | Supertest/Vitest | Reference APIs, requester context, Ticket creation, ownership, list, detail, and Attachment APIs | Safe `.env.test` regression passed 12 files/40 tests on final `main` commit `c32005b`; the exact command output is recorded below. |
| 3 | Vitest + Testing Library | Requester selection, Create Ticket, My Tickets, Detail, Attachment states, and duplicate-submit behavior | Passed locally: complete client regression, 7 files and 31 tests (including STYLE-01). |
| 4 | Vitest/DOM + Playwright axe/DOM assertions | Zen Green classes, labels, errors, focus, badges, responsive classes, and non-color indicators | Passed by 3 stylesheet assertions, component DOM assertions, and Issue #18 axe, focus, viewport, no-scroll, and screenshot checks. |
| 5 | Playwright | Complete requester Ticket/Attachment lifecycle and cross-requester isolation | Safe-config run passed all 9 tests across desktop (1440px), tablet (900px), and mobile (390px) against the disposable `.env.test` database. |
| 6 | Playwright screenshots | Desktop, tablet, and mobile Create Ticket, My Tickets, and Ticket Detail evidence | Safe-config run refreshed 9 responsive lifecycle screenshots plus 27 submission-state screenshots with captions. |
| 7 | npm/Vitest/Prisma | Final server/client regressions, builds, migration, and repeated idempotent seed | Passed from final `main` commit `c32005b` on the disposable `toktickit_lab2_test` database; migration and seed were rerun safely. |

The historical Issue #19 release audit is recorded on `lab2-staging`; the final server/client regression, complete command results, safe test-database checks, and final commit SHA are recorded in the final-main section below. The Project-board screenshot and PDF remain submission evidence rather than product-code changes.

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
- [x] Release-candidate regression, complete terminal output, and safe test-database cleanup were captured on the release branch; the final-`main` SHA and rerun results are recorded in the final-main audit below.

### Issue #19 release audit (2026-08-30)

- [x] Release branch `feature/12-Lab2ReleaseEvidence` was created from the latest `lab2-staging` merge `9499959` (Issue #18 PR #27). No GitHub Issue, Project, PR, push, merge, or status mutation was performed by this audit.
- [x] Historical server regression: `npm.cmd test -- --run` passed 11 files and 37 tests; `npm.cmd run build` passed.
- [x] Client regression: `npm.cmd test -- --run` passed 7 files and 31 tests (including `ZenGreen.styles.test.tsx`); `npm.cmd run build` passed.
- [x] Historical Playwright lifecycle: `PLAYWRIGHT_API_PORT=3019 PLAYWRIGHT_SCHEMA=toktickit_release_e2e npx.cmd playwright test` passed desktop (1440px), tablet (900px), and mobile (390px), 3 tests total. The config refused reuse of an existing server process.
- [x] Historical Playwright submission states: `lab-02/release-evidence-states.spec.ts` passed 2 evidence tests in each desktop, tablet, and mobile project (6 tests total); it produced 27 screenshots (the 9 required requester/Create Ticket states in each viewport) for the labsheet-required loading, empty, failure, validation, invalid-file, API-failure, submitting, and success states.
- [x] Historical full Playwright command with both specs passed all 9 tests across desktop, tablet, and mobile with no skips; teardown left the historical isolated schema/storage clean.
- [x] Historical release audit used explicit schemas (`toktickit_release_e2e` and `toktickit_release_final`) plus temporary protected storage; global teardown removed both. The post-run development check found 0 Tickets, 0 Attachments, 0 release schemas, and 0 files in `server/attachments`.
- [x] Historical isolated migration/repeated-seed audit created a disposable schema, ran `npm.cmd run prisma:migrate`, ran `npm.cmd run prisma:seed` twice, and verified 4 categories, 7 related systems, 5 requesters (4 active and 1 inactive).
- [x] E2E environment guard regression: the server suite passes 3 tests for the `_test` database-name requirement, schema allowlist, and rejection of unsafe values; `npx.cmd playwright test --list` fails closed when `server/.env.test` is missing.
- [x] Safe-config Playwright lifecycle/submission-state run and guarded migration/repeated-seed audit passed on disposable PostgreSQL database `toktickit_lab2_test` configured in local ignored `server/.env.test`; reference counts remained 4 categories, 7 related systems, and 5 requesters (4 active, 1 inactive).
- [x] `reviewer.md` now records my authored PRs #20 and #22-#30 plus my reviews of the partner's Lab 2 PRs #19-#26, with actual teammate Approve links where available, reviewer comments, and author/friend responses. PRs #29 and #30 are explicitly recorded as comment-only reviews, and authored PR #20 remains the accepted Lab 2 legacy comment-only evidence.
- [x] `README.md` now documents Lab 2 setup, isolated test configuration, Playwright command, protected-storage rules, and contract/evidence links. `specification.md` now records the numbered branch workflow and final release gate.
- [x] The labsheet was checked with the PDF extraction workflow, including the exact `Answer Part 1` through `Answer Part 9` heading order and the required captions and repository/Issue/PR/Project/document links for the one-PDF submission.
- [x] The release-candidate command set and complete terminal output were captured on the release branch, and the same command set was rerun from final `main` after PR #30. The final Project board with every Lab 2 Issue in Done and the readable screenshots/links are submission evidence to attach to the PDF.

### Release hardening verification (2026-09-04)

- [x] Historical pre-config-enforcement server regression: `npm.cmd test -- --run` passed 12 files and 40 tests; `npm.cmd run build` passed.
- [x] Client regression after the documentation/configuration changes: `npm.cmd test -- --run` passed 7 files and 31 tests; `npm.cmd run build` passed.
- [x] Playwright fails closed when `server/.env.test` is absent; it no longer falls back to `server/.env`.
- [x] Server Vitest fails closed when `server/.env.test` is absent; it no longer loads the development `server/.env` database for integration tests.
- [x] The environment guard unit suite passes 3 tests for non-`*_test` database names, non-allowlisted schemas, and safe static schema identifiers.
- [x] Safe `.env.test` server regression (12 files/40 tests), Playwright lifecycle/submission-state tests (9 tests across three viewports), and guarded migration/repeated-seed checks passed on the disposable local `toktickit_lab2_test` database; the development database and protected storage remained clean afterward.

### Final `main` audit (2026-09-04)

- [x] Final `main` was verified at [`c32005bc01dd54abee0dcf2a7c3ed275cb415be7`](https://github.com/osizk/TokTickIT/commit/c32005bc01dd54abee0dcf2a7c3ed275cb415be7), the merge commit for [PR #30](https://github.com/osizk/TokTickIT/pull/30) from `lab2-staging`.
- [x] Against disposable PostgreSQL database `toktickit_lab2_test` on port `55432`, guarded migration applied both migrations; `npm.cmd run prisma:test:seed` ran twice and each run reported 4 categories, 7 related systems, and 5 requesters (4 active, 1 inactive).
- [x] Final server regression passed 12 files and 40 tests (`npm.cmd test -- --run`, started 23:26:45, duration 7.16s), and `npm.cmd run build` completed successfully.
- [x] Final client regression passed 7 files and 31 tests (`npm.cmd test -- --run`, started 23:27:08, duration 9.30s), and `npm.cmd run build` completed successfully with Vite 6.4.3 (32 modules, 731ms).
- [x] Final Playwright run used `PLAYWRIGHT_SCHEMA=toktickit_release_final` and `PLAYWRIGHT_API_PORT=3019`; all 9 lifecycle/submission-state tests passed across desktop (1440px), tablet (900px), and mobile (390px) in 1.1 minutes.
- [x] Final cleanup reported `public_tickets=0`, `public_attachments=0`, `e2e_schemas=0`, `test_storage_files=0`, and `dev_storage_files=0`; the ignored `.env.test` and disposable PostgreSQL cluster were removed after verification.
- The final Project board and the nine-part PDF evidence checklist are external submission artefacts; include the readable board screenshot, captions, and working links when submitting the single PDF.

#### Final-main terminal output

The following result blocks are copied from the final-main audit at the SHA above. They are kept beside the release-candidate transcript so the release result is reproducible and reviewable.

Server regression and build:

```text
> toktickit-server@1.0.0 test
> vitest run --run

 RUN v2.1.9 C:/Users/Ashira Sansoda/Desktop/TokTickIT/server

 ✓ tests/lab-02/attachments.api.test.ts (8 tests) 304ms
 ✓ tests/lab-02/create-ticket.api.test.ts (7 tests) 230ms
 ✓ tests/lab-02/my-tickets.api.test.ts (4 tests) 209ms
 ✓ tests/lab-02/ticket-detail.api.test.ts (3 tests) 140ms
 ✓ tests/lab-02/attachment-rollback.api.test.ts (1 test) 123ms
 ✓ tests/lab-02/reference-data.test.ts (5 tests) 99ms
 ✓ tests/lab-02/create-ticket-rollback.api.test.ts (1 test) 103ms
 ✓ tests/lab-02/ticket-validation.unit.test.ts (3 tests) 3ms
 ✓ tests/lab-02/attachment-validation.unit.test.ts (2 tests) 4ms
 ✓ tests/lab-02/e2e-environment.unit.test.ts (3 tests) 3ms
 ✓ tests/lab-01/health.test.ts (2 tests) 18ms
 ✓ tests/lab-01/categories.test.ts (1 test) 71ms

 Test Files  12 passed (12)
      Tests  40 passed (40)
   Start at 23:26:45
   Duration 7.16s (transform 210ms, setup 0ms, collect 2.31s, tests 1.87s, environment 2ms, prepare 936ms)

> toktickit-server@1.0.0 build
> tsc
```

Client regression and production build:

```text
> toktickit-client@1.0.0 test
> vitest run --run

 RUN v2.1.9 C:/Users/Ashira Sansoda/Desktop/TokTickIT/client

 ✓ tests/lab-02/ZenGreen.styles.test.tsx (3 tests) 3ms
 ✓ tests/lab-01/App.test.tsx (4 tests) 275ms
 ✓ tests/lab-02/RequesterTicketDetail.test.tsx (2 tests) 329ms
 ✓ tests/lab-02/RequesterSelection.test.tsx (7 tests) 573ms
 ✓ tests/lab-02/AttachmentSection.test.tsx (3 tests) 819ms
 ✓ tests/lab-02/MyTickets.test.tsx (4 tests) 1614ms
 ✓ tests/lab-02/CreateTicket.test.tsx (8 tests) 7135ms

 Test Files  7 passed (7)
      Tests  31 passed (31)
   Start at 23:27:08
   Duration 9.30s (transform 433ms, setup 1.32s, collect 2.54s, tests 10.75s, environment 7.20s, prepare 1.53s)

> toktickit-client@1.0.0 build
> tsc && vite build

vite v6.4.3 building for production...
transforming...
✓ 32 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.39 kB │ gzip: 0.26 kB
dist/assets/index-DC8-qoq6.css  244.89 kB │ gzip: 33.98 kB
dist/assets/index-CpimXror.js   192.98 kB │ gzip: 57.41 kB
✓ built in 731ms
```

Final Playwright run:

```text
Running 9 tests using 1 worker

  ok 1 [desktop] release-evidence-states.spec.ts - captures requester selection states
  ok 2 [desktop] release-evidence-states.spec.ts - captures Create Ticket validation, failure, submitting, and success states
  ok 3 [desktop] requester-ticket-flow.spec.ts - completes the owned lifecycle and remains accessible at every responsive viewport
  ok 4 [tablet] release-evidence-states.spec.ts - captures requester selection states
  ok 5 [tablet] release-evidence-states.spec.ts - captures Create Ticket validation, failure, submitting, and success states
  ok 6 [tablet] requester-ticket-flow.spec.ts - completes the owned lifecycle and remains accessible at every responsive viewport
  ok 7 [mobile] release-evidence-states.spec.ts - captures requester selection states
  ok 8 [mobile] release-evidence-states.spec.ts - captures Create Ticket validation, failure, submitting, and success states
  ok 9 [mobile] requester-ticket-flow.spec.ts - completes the owned lifecycle and remains accessible at every responsive viewport

  9 passed (1.1m)
```

Guarded migration/seed and cleanup result:

```text
database=toktickit_lab2_test
migrations=20260811000000_init, 20260826100000_lab2_data_reference
seed_run_1=4 categories, 7 related systems, 5 requesters (4 active, 1 inactive)
seed_run_2=4 categories, 7 related systems, 5 requesters (4 active, 1 inactive)
public_tickets=0
public_attachments=0
e2e_schemas=0
test_storage_files=0
dev_storage_files=0
```

#### Captured terminal output

Safe `.env.test` migration and repeated-seed verification on the disposable
database (`toktickit_lab2_test`, PostgreSQL port `55432`):

```text
> toktickit-server@1.0.0 prisma:test:migrate
> node scripts/run-test-prisma.mjs migrate

Using server/.env.test for Prisma migrate against database toktickit_lab2_test.
Environment variables loaded from .env
Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "toktickit_lab2_test", schema "public" at "127.0.0.1:55432"

2 migrations found in prisma/migrations


No pending migrations to apply.

> toktickit-server@1.0.0 prisma:test:seed
> node scripts/run-test-prisma.mjs seed

Using server/.env.test for Prisma seed against database toktickit_lab2_test.
Environment variables loaded from .env
Running seed command `tsx prisma/seed.ts` ...
Seeded 4 categories, 7 related systems, and 5 requesters.

The seed command has been executed.

> toktickit-server@1.0.0 prisma:test:seed
> node scripts/run-test-prisma.mjs seed

Using server/.env.test for Prisma seed against database toktickit_lab2_test.
Environment variables loaded from .env
Running seed command `tsx prisma/seed.ts` ...
Seeded 4 categories, 7 related systems, and 5 requesters.

The seed command has been executed.
```

Safe server regression against that same database:

```text
> toktickit-server@1.0.0 test
> vitest run --run

RUN  v2.1.9 C:/Users/Ashira Sansoda/Desktop/TokTickIT/server

 ✓ tests/lab-02/attachments.api.test.ts (8 tests) 304ms
 ✓ tests/lab-02/create-ticket.api.test.ts (7 tests) 230ms
 ✓ tests/lab-02/my-tickets.api.test.ts (4 tests) 209ms
 ✓ tests/lab-02/ticket-detail.api.test.ts (3 tests) 140ms
 ✓ tests/lab-02/attachment-rollback.api.test.ts (1 test) 123ms
 ✓ tests/lab-02/reference-data.test.ts (5 tests) 99ms
 ✓ tests/lab-02/create-ticket-rollback.api.test.ts (1 test) 103ms
 ✓ tests/lab-02/ticket-validation.unit.test.ts (3 tests) 3ms
 ✓ tests/lab-02/attachment-validation.unit.test.ts (2 tests) 4ms
 ✓ tests/lab-02/e2e-environment.unit.test.ts (3 tests) 3ms
 ✓ tests/lab-01/health.test.ts (2 tests) 18ms
 ✓ tests/lab-01/categories.test.ts (1 test) 71ms

 Test Files  12 passed (12)
      Tests  40 passed (40)
   Start at 21:12:48
   Duration 5.96s (transform 161ms, setup 0ms, collect 2.01s, tests 1.31s, environment 2ms, prepare 849ms)
```

Safe server build:

```text
> toktickit-server@1.0.0 build
> tsc
```

Safe client regression and production build:

```text
> toktickit-client@1.0.0 test
> vitest run --run

RUN v2.1.9 C:/Users/Ashira Sansoda/Desktop/TokTickIT/client

 ✓ tests/lab-02/ZenGreen.styles.test.tsx (3 tests) 3ms
 ✓ tests/lab-02/RequesterTicketDetail.test.tsx (2 tests) 310ms
 ✓ tests/lab-01/App.test.tsx (4 tests) 277ms
 ✓ tests/lab-02/RequesterSelection.test.tsx (7 tests) 524ms
 ✓ tests/lab-02/AttachmentSection.test.tsx (3 tests) 777ms
 ✓ tests/lab-02/MyTickets.test.tsx (4 tests) 1523ms
 ✓ tests/lab-02/CreateTicket.test.tsx (8 tests) 6960ms

Test Files 7 passed (7)
     Tests 31 passed (31)
  Start at 21:09:14
  Duration 8.89s (transform 366ms, setup 1.33s, collect 2.40s, tests 10.38s, environment 6.25s, prepare 1.06s)

> toktickit-client@1.0.0 build
> tsc && vite build

vite v6.4.3 building for production...
transforming...
✓ 32 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.39 kB │ gzip: 0.26 kB
dist/assets/index-DC8-qoq6.css  244.89 kB │ gzip: 33.98 kB
dist/assets/index-CpimXror.js   192.98 kB │ gzip: 57.41 kB
✓ built in 629ms
```

Safe Playwright lifecycle and submission-state run (`cd client && npx playwright test`):

```text
Running 9 tests using 1 worker

ok 1 [desktop] release-evidence-states.spec.ts - captures requester selection states (2.0s)
ok 2 [desktop] release-evidence-states.spec.ts - captures Create Ticket validation, failure, submitting, and success states (3.0s)
ok 3 [desktop] requester-ticket-flow.spec.ts - completes the owned lifecycle and remains accessible at every responsive viewport (5.2s)
ok 4 [tablet] release-evidence-states.spec.ts - captures requester selection states (1.8s)
ok 5 [tablet] release-evidence-states.spec.ts - captures Create Ticket validation, failure, submitting, and success states (2.9s)
ok 6 [tablet] requester-ticket-flow.spec.ts - completes the owned lifecycle and remains accessible at every responsive viewport (5.3s)
ok 7 [mobile] release-evidence-states.spec.ts - captures requester selection states (1.7s)
ok 8 [mobile] release-evidence-states.spec.ts - captures Create Ticket validation, failure, submitting, and success states (2.8s)
ok 9 [mobile] requester-ticket-flow.spec.ts - completes the owned lifecycle and remains accessible at every responsive viewport (5.0s)

9 passed (47.2s)
```

Final read-only cleanup checks:

```text
dev_e2e_tickets=0
dev_e2e_attachments=0
dev_release_schemas=0
test_categories=4
test_systems=7
test_requesters=5
test_tickets=0
test_attachments=0
test_e2e_schemas=0
server/.test-attachments is empty
server/attachments is empty
```

Historical server tests before the `.env.test` config guard:

```text
> toktickit-server@1.0.0 test
> vitest run --run

RUN  v2.1.9 C:/Users/Ashira Sansoda/Desktop/TokTickIT/server

 ✓ tests/lab-02/attachments.api.test.ts (8 tests) 409ms
 ✓ tests/lab-02/create-ticket.api.test.ts (7 tests) 274ms
 ✓ tests/lab-02/my-tickets.api.test.ts (4 tests) 201ms
 ✓ tests/lab-02/ticket-detail.api.test.ts (3 tests) 162ms
 ✓ tests/lab-02/attachment-rollback.api.test.ts (1 test) 266ms
 ✓ tests/lab-02/reference-data.test.ts (5 tests) 231ms
 ✓ tests/lab-02/create-ticket-rollback.api.test.ts (1 test) 130ms
 ✓ tests/lab-02/ticket-validation.unit.test.ts (3 tests) 3ms
 ✓ tests/lab-02/attachment-validation.unit.test.ts (2 tests) 4ms
 ✓ tests/lab-02/e2e-environment.unit.test.ts (3 tests) 3ms
 ✓ tests/lab-01/health.test.ts (2 tests) 18ms
 ✓ tests/lab-01/categories.test.ts (1 test) 194ms

Test Files  12 passed (12)
     Tests  40 passed (40)
  Start at  20:28:40
  Duration  6.50s (transform 188ms, setup 0ms, collect 1.99s, tests 1.89s, environment 2ms, prepare 782ms)
```

Server build:

```text
> toktickit-server@1.0.0 build
> tsc
```

Client tests:

```text
> toktickit-client@1.0.0 test
> vitest run --run

RUN  v2.1.9 C:/Users/Ashira Sansoda/Desktop/TokTickIT/client

 ✓ tests/lab-02/ZenGreen.styles.test.tsx (3 tests) 2ms
 ✓ tests/lab-02/RequesterTicketDetail.test.tsx (2 tests) 262ms
 ✓ tests/lab-01/App.test.tsx (4 tests) 279ms
 ✓ tests/lab-02/RequesterSelection.test.tsx (7 tests) 514ms
 ✓ tests/lab-02/AttachmentSection.test.tsx (3 tests) 768ms
   ✓ Ticket Detail Attachments > requires a removal reason and renders a removed attachment without Download or Preview 456ms
 ✓ tests/lab-02/MyTickets.test.tsx (4 tests) 1527ms
   ✓ My Tickets > loads owned Tickets with controls and a desktop table plus mobile cards 302ms
   ✓ My Tickets > writes search/filter controls to the URL and requests the selected page 478ms
   ✓ My Tickets > distinguishes no owned Tickets from filtered no-results and can clear filters 464ms
   ✓ My Tickets > shows loading and safe retry states 373ms
 ✓ tests/lab-02/CreateTicket.test.tsx (8 tests) 7196ms
   ✓ Create Ticket > renders the approved Create Ticket form inside the selected requester shell 313ms
   ✓ Create Ticket > shows strict validation errors and focuses the first invalid field before submission 302ms
   ✓ Create Ticket > trims fields and shows the backend-created Ticket result after a successful submit 1935ms
   ✓ Create Ticket > preserves entered values and shows a safe message when creation fails 1961ms
   ✓ Create Ticket > guards against duplicate submissions while the create request is pending 1977ms

Test Files  7 passed (7)
     Tests  31 passed (31)
  Start at  20:24:30
  Duration  8.63s (transform 316ms, setup 790ms, collect 1.90s, tests 10.55s, environment 4.13s, prepare 961ms)
```

Client build:

```text
> toktickit-client@1.0.0 build
> tsc && vite build

vite v6.4.3 building for production...
transforming...
✓ 32 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.39 kB │ gzip:  0.26 kB
dist/assets/index-DC8-qoq6.css  244.89 kB │ gzip: 33.98 kB
dist/assets/index-CpimXror.js   192.98 kB │ gzip: 57.41 kB
✓ built in 574ms
```

Playwright safety check:

```text
Error: Playwright requires C:\Users\Ashira Sansoda\Desktop\TokTickIT\server\.env.test. Copy server/.env.test.example and use a disposable *_test database.
```

Server Vitest safety check:

```text
> toktickit-server@1.0.0 test
> vitest run --run

failed to load config from C:\Users\Ashira Sansoda\Desktop\TokTickIT\server\vitest.config.ts
Error: Vitest requires C:\Users\Ashira Sansoda\Desktop\TokTickIT\server\.env.test. Copy server/.env.test.example and use a disposable *_test database.
```

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
| REG-01 | npm/Vitest/Prisma | AC-24 | Lab 1 tests/builds, Lab 2 tests/builds, migrations, and repeated seed pass from the exact release candidate before promotion into `main`. | `server/tests/lab-01/*`, `client/tests/lab-01/*`, documented commands, Issue #19 audit, final-main audit | Passed on final `main` commit `c32005bc` and the disposable `_test` database; command results are recorded in the final-main audit. |

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
| API/integration | Passed on final `main` and disposable `.env.test` database | Server regression passed 12 files/40 tests at final `main` commit `c32005bc`; migration, repeated seed, and cleanup also passed. |
| UI/style/accessibility | Passed locally | Complete client regression: 7 files, 31 tests; stylesheet/component assertions, axe, focus, viewport, and screenshot evidence. |
| Responsive/visual | Passed locally | 9 refreshed desktop/tablet/mobile screenshots plus caption README under `artifacts/lab-02/screenshots/`. |
| E2E | Passed on disposable `.env.test` database | `cd client && npx playwright test` passed all 9 lifecycle/submission-state tests across desktop, tablet, and mobile with allowlisted schemas. |
| Submission-state screenshots | Passed locally | `lab-02/release-evidence-states.spec.ts` - 6 evidence tests passed across 3 viewports; 27 readable, captioned images under `artifacts/lab-02/screenshots/release-states/{desktop,tablet,mobile}/`. |
| Migration/repeated seed | Passed through guarded test commands | `npm run prisma:test:migrate` and two `npm run prisma:test:seed` runs completed against `toktickit_lab2_test`; counts remained 4/7/5. |
| Development DB/storage hygiene | Passed after cleanup | 0 Tickets, 0 Attachments, 0 release schemas, and 0 files in protected development storage after E2E teardown. |
| Final `main` release gate | Passed on final `main` | Final commit `c32005bc01dd54abee0dcf2a7c3ed275cb415be7` was audited after PR #30; server/client tests and builds, Playwright, migration, repeated seed, and cleanup passed. Attach the final Project-board screenshot and captioned links to the single PDF submission. |

## Known Limitations or Deferred Tests

- Real authentication and shared/object storage are deferred to later labs.
- In-app Attachment preview is not required; active download and removed-download blocking are required.
- The release-candidate regression and complete terminal output are captured on the release branch, and the final-`main` regression and exact SHA are recorded above. The final Project-board screenshot and PDF attachment audit are submission artefacts; `lab2-staging` remains the source branch for this documentation-only update before the next promotion into `main`.
