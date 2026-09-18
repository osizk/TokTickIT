# Lab 3 Test Plan, Traceability, and Evidence

## 1. Scope and baseline

This file is the living test contract for Lab 3. At the start of Issue #33 the repository is on `feature/13-Lab3Contract`, based on `lab3-staging`. The Lab 2 baseline was checked before this documentation work:

| Baseline check | Result |
|---|---|
| `cd server; npm.cmd test -- --run` | 12 files, 40 tests passed |
| `cd client; npm.cmd test -- --run` | 7 files, 31 tests passed |
| `cd server; npm.cmd run build` | Passed |
| `cd client; npm.cmd run build` | Passed |

These baseline results are context, not Lab 3 completion evidence. Lab 3 implementation tests remain planned until their Issues are implemented and verified.

## 2. Planned failing-first evidence

Before writing the Issue #33 contract files, the required-file guard was intentionally run and failed as expected:

```text
EXPECTED_FAIL: Lab 3 contract is not complete; missing specification.md, tests.md, ui-spec.md, api-spec.md, ai-use.md, reviewer.md
```

The command exited with status `1`. This is historical red-phase evidence for Issue #33. After all six contract files were added, the same guard was rerun:

```powershell
$required=@('specification.md','tests.md','ui-spec.md','api-spec.md','ai-use.md','reviewer.md')
$missing=$required | Where-Object { -not (Test-Path (Join-Path 'docs/lab-03' $_)) }
if($missing){ Write-Output ('FAIL: missing ' + ($missing -join ', ')); exit 1 }
Write-Output 'PASS: all six Lab 3 contract files exist'
```

Recorded passing output and exit status:

```text
Git HEAD at test time: 20a7d5543f30f7a6f215d51e80d964178df1366e
PASS: all six Lab 3 contract files exist
Process exit status: 0
```

The guard passed on the committed correction set; the following evidence-only commit records that tested SHA.

### Issue #34 red/green evidence

The first planned Issue #34 test was run before its implementation and failed for the intended reason:

```text
Command: cd server; npm.cmd test -- --run tests/lab-03/auth-validation.unit.test.ts
Expected red phase: Failed to load url ../../src/auth-validation.js because auth-validation.ts did not exist.
Result: failed before assertions (implementation file missing)
```

After the authentication foundation and database-backed checks were implemented, the focused Lab 3 command passed:

```text
Command: cd server; npm.cmd test -- --run tests/lab-03
Test Files  7 passed (7)
Tests       25 passed (25)
Result      exit status 0
```

The complete server regression command was then run on branch `feature/14-Lab3AuthFoundation`:

```text
Command: cd server; npm.cmd test -- --run
Test Files  19 passed (19)
Tests       65 passed (65)
Result      exit status 0
```

The server build also passed (`npm.cmd run build`). The documented disposable-database commands were run with process-only credentials and Lab 3 seed values (the values are intentionally not recorded):

```text
Command: cd server; npm.cmd run prisma:test:migrate
Using server/.env.test for Prisma migrate against database toktickit_lab2_test.
3 migrations found in prisma/migrations
No pending migrations to apply.

Command: cd server; npm.cmd run prisma:test:seed
Seeded 4 categories, 7 related systems, and 5 fixture requesters; all existing Requesters received idempotent credential backfill.
Command repeated: cd server; npm.cmd run prisma:test:seed
Seeded 4 categories, 7 related systems, and 5 fixture requesters; all existing Requesters received idempotent credential backfill.
```

Client work, E2E coverage, and later authenticated Requester/staff/admin feature Issues remain outside Issue #34.

### Issue #35 red/green evidence (authenticated Requester regression)

The planned failing tests were run before the authenticated ownership implementation. These failures are retained as the red-phase record, not counted as passing evidence:

```text
Command: cd server; npm.cmd test -- --run tests/lab-03/requester-regression.api.test.ts
Result: failed 3 tests as expected:
- unauthenticated GET /api/categories returned 200 instead of the required 401;
- Ticket creation trusted a spoofed X-Requester-Id header and stored Requester B instead of the session Requester A;
- cross-owner Ticket detail returned the old header-context validation response instead of safe 404 TICKET_NOT_FOUND.

Command: cd client; npm.cmd test -- --run tests/lab-03/RequesterRegression.test.tsx
Result: failed 2 tests as expected because the legacy health/selector app had no Sign in page or Email field.

Command: cd client; npx playwright test e2e/lab-03/requester-regression.spec.ts --project=desktop
Result: failed 1 test as expected: /tickets resolved to /select-requester instead of /login after the global test seed completed.

Review-fix red phase:

Command: cd client; npm.cmd test -- --run tests/lab-03/RequesterRegression.test.tsx
Result: 3 newly added review-fix tests failed as expected: failed logout had no retryable error, a protected Ticket 401 stayed on My Tickets, and direct /change-password stayed on the session-checking state.

Command: cd server; npm.cmd test -- --run tests/lab-03/resolution-indication.unit.test.ts
Result: 1 test failed as expected because the terminal-status helper was not implemented.

PR #45 follow-up review red phase:

Command: cd client; npm.cmd test -- --run tests/lab-03/RequesterRegression.test.tsx
Result: 4 newly added tests failed as expected: a delayed initial session restore returned the UI to `/login`, and unauthenticated `/staff/tickets`, `/staff/tickets/:ticketNumber`, and `/admin/users` remained on the session-checking state.
```

The E2E red run initially exposed a separate test-isolation seed defect: a preserved Requester ID could collide with the User sequence. The seed now checks occupied IDs before creating a User and synchronizes the User sequence before staff/admin fixtures; the migration/seed regression was rerun from a clean disposable `toktickit_lab2_test` database.

Focused green results after implementation:

```text
Command: cd server; npm.cmd run prisma:test:migrate
Result: 4 migrations found; 20260916100000_lab3_requester_regression applied successfully.

Command: cd server; npm.cmd test -- --run tests/lab-03/requester-regression.api.test.ts
Test Files  1 passed (1)
Tests       3 passed (3)

Command: cd server; npm.cmd test -- --run tests/lab-03/migration-seed.api.test.ts
Test Files  1 passed (1)
Tests       4 passed (4)

Command: cd server; npm.cmd run build
Result: TypeScript build passed.

Command: cd client; npm.cmd test -- --run tests/lab-03/RequesterRegression.test.tsx
Test Files  1 passed (1)
Tests       10 passed (10)

Command: cd server; npm.cmd test -- --run tests/lab-03/resolution-indication.unit.test.ts
Test Files  1 passed (1)
Tests       1 passed (1)

Command: cd client; npm.cmd run build
Result: production TypeScript/Vite build passed.

Command: cd client; npx playwright test e2e/lab-03/requester-regression.spec.ts --project=desktop
Result: 1 passed, 0 skipped.

Inherited regression results after adapting Lab 2 tests to authenticated session fixtures:

Command: cd server; (local test-only password environment variables supplied in the process); npm.cmd test -- --run
Test Files  21 passed (21)
Tests       69 passed (69)

Command: cd client; npm.cmd test -- --run
Test Files  8 passed (8)
Tests       36 passed (36)
```

The first parallel full-server run encountered a migration-test hook timeout; the migration test passed in isolation, and the subsequent complete server run passed 21 files/69 tests. Issue #35 implementation evidence now also covers failed-logout preservation and retry, shared SESSION_REQUIRED redirect handling, terminal resolution-status rules, direct /change-password guarding, stale session-restore suppression after Login, and role landing-route guards. Full authenticated Requester workflow E2E and release screenshots remain later release-gate evidence.

### Issue #36 red/green evidence (IT Staff Ticket Queue)

The planned queue API and UI tests were run before the queue implementation. They failed for the intended missing-route/missing-screen reasons:

```text
Command: cd server; npm.cmd test -- --run tests/lab-03/staff-queue.api.test.ts
Expected red phase: unauthenticated GET /api/staff/tickets returned 404 because the route did not exist (required response: 401 SESSION_REQUIRED).

Command: cd client; npm.cmd test -- --run tests/lab-03/StaffTicketQueue.test.tsx
Expected red phase: the authenticated staff route rendered “Access not available” because the Staff Ticket Queue screen did not exist.
```

The PR #46 review-fix red phase then reproduced the missing Open target before implementation:

```text
Command: cd server; npm.cmd test -- --run tests/lab-03/staff-queue.api.test.ts
Result: 1 of 6 tests failed as expected because GET /api/staff/tickets/:ticketNumber returned 404 instead of the required 200 detail response.

Command: cd client; npm.cmd test -- --run tests/lab-03/StaffTicketQueue.test.tsx
Result: the new Open-detail regression failed during collection because fetchStaffTicket did not exist yet.
```

After the schema migration, queue service, protected routes, API client, UI, and seed fixture work were added, the focused checks passed:

```text
Command: cd server; npm.cmd test -- --run tests/lab-03/staff-queue.api.test.ts
Test Files  1 passed (1)
Tests       6 passed (6)
Result      exit status 0

Command: cd client; npm.cmd test -- --run tests/lab-03/StaffTicketQueue.test.tsx
Test Files  1 passed (1)
Tests       5 passed (5)
Result      exit status 0

Command: cd server; npm.cmd run build
Result: TypeScript build passed.

Command: cd server; npm.cmd run prisma:test:seed
Using server/.env.test for Prisma seed against database toktickit_lab2_test.
Seeded 4 categories, 7 related systems, and 5 requesters; ensured 12 Tickets (0 created this run); all existing Requesters received idempotent credential backfill.
Command repeated: cd server; npm.cmd run prisma:test:seed
Using server/.env.test for Prisma seed against database toktickit_lab2_test.
Seeded 4 categories, 7 related systems, and 5 requesters; ensured 12 Tickets (0 created this run); all existing Requesters received idempotent credential backfill.
```

The queue migration was applied to the guarded disposable `toktickit_lab2_test` database. The final guarded migration check recorded:

```text
Command: cd server; npm.cmd run prisma:test:migrate
Using server/.env.test for Prisma migrate against database toktickit_lab2_test.
5 migrations found in prisma/migrations
No pending migrations to apply.
```

Its storage/database safety checks confirmed the database name ends in `_test` and the attachment path is inside the test-owned storage root. The complete client suite passed 9 files/41 tests after the Open-detail regression was added. An initial full-server attempt failed closed because this local `.env.test` does not contain the three required `LAB3_*_INITIAL_PASSWORD` values. A later process-only attempt was also not counted as passing: the disposable database retained hashes from an earlier generated seed password, so the newly generated value was rejected and the inherited login fixtures became rate-limited. No credential value is recorded here; rerun the complete server suite with the password variables matching the existing disposable seed credentials before release evidence is finalized.

### Issue #38 red/green evidence (Administrator User Management)

The planned API and UI tests were written and run before the Administrator implementation. The first API run was stopped by the test fixture because the cleanup included an unavailable `InternalNote` table; the fixture was corrected to delete only tables present in the current disposable schema. The next red run reached the intended missing-route failures:

```text
Command: cd server; npm.cmd test -- --run tests/lab-03/users-admin.api.test.ts
Result: 5 tests failed as expected with HTTP 404 because the Administrator User Management routes did not exist.

Command: cd client; npm.cmd test -- --run tests/lab-03/UserManagement.test.tsx
Result: failed during collection as expected because client/src/AdminUserManagement.tsx did not exist.
```

After the service, protected routes, API client, responsive User Management screen, and tests were implemented, the focused checks passed against the guarded disposable `toktickit_lab2_test` database:

```text
Command: cd server; npm.cmd test -- --run tests/lab-03/users-admin.api.test.ts
Test Files  1 passed (1)
Tests       6 passed (6)
Result      exit status 0

Command: cd server; npm.cmd run build
Result: TypeScript build passed.

Command: cd client; npm.cmd test -- --run tests/lab-03/UserManagement.test.tsx
Test Files  1 passed (1)
Tests       4 passed (4)
Result      exit status 0

Command: cd client; npm.cmd test -- --run tests/lab-03/UserManagement.test.tsx tests/lab-02/ZenGreen.styles.test.tsx
Test Files  2 passed (2)
Tests       8 passed (8)
Result      exit status 0

Command: cd client; npm.cmd run build
Result: production TypeScript/Vite build passed.

Command: cd client; npm.cmd test -- --run
Test Files  11 passed (11)
Tests       49 passed (49)
Result      exit status 0
```

The API tests verify Administrator-only access, exact safe-user fields with timestamps and no password hash, name/email search, role filtering, one-role creation and validation, duplicate email protection, owner-ineligibility atomic rejection, sole-active-Administrator self-deactivation protection with unchanged User/session state, session revocation after role changes and password reset, and first-login password-change state. The UI tests verify the responsive table/card list, mobile Edit actions, search/filter controls, create/edit form, one-role validation, conflict feedback, and reset action. Full server regression, migration/seed repeat evidence, authenticated E2E, final-main evidence, and Project/review evidence remain release gates for later Issues.

A current complete-server attempt is not claimed as passing: the Issue #38 API file passed 6/6, but inherited authenticated suites stopped at the local missing `LAB3_REQUESTER_INITIAL_PASSWORD`, and the Internal Notes test returned `500` because its migration is not yet applied to this disposable database. No Issue #38 assertion failed; rerun the full server suite after the local Lab 3 password variables and pending migration are configured.

## 3. Planned test matrix

All paths below are intended paths for the implementation branches. A test is not marked passed until its real command and output are recorded here.

Issue #38 focused API-10 and UI-06 results are recorded above (6 API tests and 4 UI tests passed). The matrix labels remain a plan-level traceability record; release-wide regression, migration, E2E, and final-main evidence are still tracked separately and must not be inferred from these focused results.

| Test ID | Type | Covers | Planned test/path | Status |
|---|---|---|---|---|
| UNIT-01 | Unit | BR-02/03, AC-01/02/17 | Password, email normalization, and field-boundary validation — `server/tests/lab-03/auth-validation.unit.test.ts` | Passed: 4 tests |
| UNIT-02 | Unit | BR-05/06/07, AC-03/04/20 | Session expiry, CSRF, cookie flags, rate-limit key behavior — `server/tests/lab-03/session-security.unit.test.ts` | Passed: 3 tests |
| UNIT-03 | Unit | BR-13/15/16/17, AC-13 | Status-transition, Requested/IT Priority mutation matrix, and confirmation rules — `server/tests/lab-03/status-transition.unit.test.ts` | Passed: 2 tests |
| UNIT-04 | Unit | BR-18/19/20, AC-10 | Queue query parsing, defaults, ordering, and page bounds — `server/tests/lab-03/queue-query.unit.test.ts` | Planned |
| UNIT-05 | Unit | BR-18, AC-09 | Resolution indication allows non-terminal statuses and rejects `CLOSED`/`CANCELLED` — `server/tests/lab-03/resolution-indication.unit.test.ts` | Passed: 1 test |
| API-01 | API | FR-01/02, AC-01/02 | Login validation, seeded/temporary active login, safe inactive/unknown failure, and role payload — `server/tests/lab-03/auth.api.test.ts` | Passed: 6 tests |
| API-02 | API | BR-05, AC-02/20 | Failed-login bucket, temporary block, and recovery — `server/tests/lab-03/auth-rate-limit.api.test.ts` | Passed: 1 test |
| API-03 | API | FR-02/03, AC-03/04/18 | First-login password change, session rotation, idempotent logout, old-session revocation, wrong-CSRF rejection, and idle/absolute expiry — `server/tests/lab-03/auth-session.api.test.ts` | Passed: 5 tests; staff/admin protected-route coverage remains in later Issues |
| API-04 | API | FR-04, AC-05/20 | Origin and wrong-role helper safety; full direct endpoint authorization remains with later protected APIs — `server/tests/lab-03/authorization.api.test.ts` | Passed: 2 tests |
| API-05 | Integration | FR-05/15, AC-06/22 | Applied migration User-ID/credential preservation, non-fixture Requester credential backfill with Ticket/Attachment ownership, changed-password preservation, and repeated idempotent seed counts — `server/tests/lab-03/migration-seed.api.test.ts` | Passed: 4 tests; pre-migration Ticket/Attachment fixture audit remains part of the release migration evidence |
| API-06 | API | FR-06/07, AC-07/08/20 | Authenticated Requester Ticket/Attachment continuity, inherited Ticket field/priority validation, exact Lab 2 nested routes, and ownership isolation — `server/tests/lab-03/requester-regression.api.test.ts` | Passed: 3 focused tests plus inherited Lab 2 Ticket/Attachment/list/detail regressions |
| API-07 | API | FR-09, AC-10/11 | Staff queue search/filter/sort/pagination/defaults, Requested/IT Priority filters and sorting, functional staff Open-detail response, and safe failures — `server/tests/lab-03/staff-queue.api.test.ts` | Passed: 6 focused tests; full server regression awaits local Lab 3 password variables |
| API-08 | API | FR-10, AC-12/13/15 | Staff detail assignment, Requested/IT Priority values and mutation, status, and Attachment access — `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Passed: 4 focused tests |
| API-09 | API | FR-08/11/12, AC-09/14 | Public Comments, stable Requester `403 FORBIDDEN` Internal Notes denial, privacy, authorship, validation, append-only behavior — `server/tests/lab-03/comments-notes.api.test.ts` | Partially passed: public-comment test passes; Internal Note test awaits applying `20260917110000_lab3_ticket_operations` to the disposable database |
| API-10 | API | FR-13/14, AC-16/17/18/19 | Admin user list/create/edit/activation/reset, `USER_OWNS_TICKETS` atomic rejection, session revocation after role/activation changes, and safety rules — `server/tests/lab-03/users-admin.api.test.ts` | Passed: 6 tests |
| API-11 | API | FR-07/11, AC-08/15 | Active/removed Attachment metadata, download headers, exact route compatibility, and staff/requester access continuation — `server/tests/lab-03/attachment-continuity.api.test.ts` | Planned |
| API-12 | API | FR-04/16, AC-05/20 | Exact authenticated Categories, Related Systems, and staff-assignee response/error contracts — `server/tests/lab-03/reference-data.api.test.ts` | Planned |
| UI-01 | Component | FR-01/02/17, AC-01/02/03/21 | Login form, safe failure, busy guard, and redirect — `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-02 | Component | FR-02/03/17, AC-03/04/21 | Change-password guard, policy errors, success, and focus — `client/tests/lab-03/ChangePassword.test.tsx` | Planned |
| UI-03 | Component | FR-06/07/08, AC-07/08/09/21 | Authenticated shell, logout retry, session-expiry redirect, stale session-restore suppression, role-route guards, direct Change Password guard, and Requester list/create/detail regression — `client/tests/lab-03/RequesterRegression.test.tsx` | Passed: 10 focused tests plus inherited Lab 2 list/create/detail/attachment UI regressions |
| UI-04 | Component | FR-09/17, AC-10/11/21 | Queue controls, Requested/IT Priority filters and sorting, states, role visibility, cards/table, pagination, and functional Open-detail navigation — `client/tests/lab-03/StaffTicketQueue.test.tsx` | Passed: 5 focused tests; latest full client suite 11 files/49 tests |
| UI-05 | Component | FR-10/11/12, AC-12/13/14/15/21 | Staff detail actions, priority mutation, dialogs, comments, notes, and attachments — `client/tests/lab-03/StaffTicketDetail.test.tsx` | Passed: 3 focused tests |
| UI-06 | Component | FR-13/14, AC-16/17/18/19/21 | User list/editor, validation, activation, `USER_OWNS_TICKETS` conflict feedback, session-effect messaging, reset controls, and mobile cards — `client/tests/lab-03/UserManagement.test.tsx` | Passed: 4 tests |
| STYLE-01 | Style/a11y | FR-17, AC-11/21 | Labels, focus, roles, contrast, touch targets, semantic feedback — `client/tests/lab-03/Accessibility.test.tsx` | Planned |
| STYLE-02 | Responsive | FR-17, AC-11/21 | Desktop/tablet/mobile layout and no page-wide horizontal scroll — `client/tests/lab-03/Responsive.test.tsx` | Planned |
| REG-01 | Regression | AC-06/07/08/15 | Complete prior server suite after migration and auth integration — `server/tests/lab-01/**`, `server/tests/lab-02/**`, `server/tests/lab-03/**` | Historical pass: 21 files, 69 tests; current rerun awaits disposable credential alignment |
| REG-02 | Regression | AC-06/07/08/21 | Complete prior client suite after selector-to-auth migration — `client/tests/lab-01/**`, `client/tests/lab-02/**`, `client/tests/lab-03/**` | Passed: 11 files, 49 tests |
| E2E-01 | E2E | AC-01/02/03/04/05/21 | Login, first-login change, logout, guard, and role navigation — `e2e/lab-03/authentication.spec.ts` | Passed: 9/9 project runs |
| E2E-02 | E2E | AC-07/08/09/14/21 | Requester Ticket continuity, comment, resolution indication, and note privacy — `e2e/lab-03/requester-regression.spec.ts` | Passed: 6/6 project runs |
| E2E-03 | E2E | AC-10/11/12/13/14/15/21 | Staff queue/detail operations, priority filters/mutations, comments, notes, attachments, and responsive views — `e2e/lab-03/staff-ticket-flow.spec.ts` | Passed: 9/9 project runs |
| E2E-04 | E2E | AC-16/17/18/19/21 | Admin User Management and safety protections — `e2e/lab-03/user-administration.spec.ts` | Passed: 6/6 project runs |
| E2E-05 | E2E | AC-23 | Release evidence states and final-main evidence capture — `e2e/lab-03/release-evidence-states.spec.ts` | Passed: 3/3 project runs |
| VIS-01 | Visual | AC-11/21 | Readable desktop/tablet/mobile screenshots and visual checklist — `artifacts/lab-03/screenshots/` | Passed: screenshots generated and manually inspected at all three projects |
| REL-01 | Release | AC-23 | Final-main complete tests/builds, migration/seed, traceability, links, and review audit — `docs/lab-03/release-evidence/` | Planned |

## 4. Commands and evidence to record

Run each command from the indicated directory using the isolated test database and temporary attachment directory. Record the complete terminal output, tested commit SHA, counts, and any intentional red-phase failure.

```powershell
cd server
npm.cmd test -- --run
npm.cmd run build
npm.cmd run prisma:test:migrate
npm.cmd run prisma:test:seed
npm.cmd run prisma:test:seed
cd ..\client
npm.cmd test -- --run
npm.cmd run build
npx playwright test
```

Migration/seed evidence must show successful migration and stable counts after two seed runs. Playwright evidence must show all required Lab 3 tests passing with no required test skipped. Release evidence must be rerun from the recorded final `main` SHA, not from an unmerged feature branch.

### Initial-password migration and seed test mapping

The implementation must use the following local-only keys. The real values belong only in ignored `server/.env` or `server/.env.test`; no password value is recorded in this document.

| Environment key | Seed/migration population | Required verification |
|---|---|---|
| `LAB3_REQUESTER_INITIAL_PASSWORD` | Seeded active/inactive Requesters and every migrated former Lab 2 Requester | API-01 logs in the seeded Requester; API-05 creates `legacy.owner@example.test` as a non-fixture legacy Requester before migration, then proves the same User ID, Ticket requester ID, Attachment link, Argon2id hash, and `mustChangePassword=true` survive. |
| `LAB3_IT_STAFF_INITIAL_PASSWORD` | Seeded active and inactive IT Staff | API-01/API-04 verify a seeded staff account can complete first-login change and receives staff-only authorization afterward. |
| `LAB3_ADMIN_INITIAL_PASSWORD` | Seeded Administrator | API-01/API-10 verify first-login change, administrator authorization, and last-active-Administrator safety. |

`API-05` must run migration on a disposable `_test` database with a pre-existing non-fixture Requester/Ticket/Attachment row, then run the idempotent seed twice. It records before/after IDs and counts, proves the non-fixture row was not replaced by a fixture, proves a row with an existing hash and `mustChangePassword=false` is unchanged after both runs, and confirms that each group key is required (a missing key fails closed before any write). `API-01` uses the deterministic fixture emails from `specification.md`; it does not treat seed fixtures alone as proof of migration preservation.

Priority regression coverage is explicit: `API-06` tests create-time validation of all four `TicketPriority` values and inherited summary/description/reference boundaries; `API-07` tests Requested Priority and IT Priority filters and sorting; `API-08` tests that Requested Priority cannot be changed and IT Priority accepts only the shared enum; `UI-04`/`UI-05` and `E2E-03` verify the same values and controls in the queue/detail workflows.

User-management safety coverage is explicit: `API-10` attempts to deactivate or demote an owner, expects `409 USER_OWNS_TICKETS`, verifies no User/Ticket/session changes occurred, then verifies an eligible role change or inactive change revokes all target sessions. `UI-06` and `E2E-04` verify the conflict message, unchanged ownership, and successful session-effect feedback.

## 5. Acceptance-criteria traceability

| Acceptance criterion | Test IDs |
|---|---|
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | UNIT-01, API-01, API-02, UI-01, E2E-01 |
| AC-03 | API-03, UI-02, E2E-01 |
| AC-04 | UNIT-02, API-03, UI-02, E2E-01 |
| AC-05 | API-04, API-12, E2E-01 |
| AC-06 | API-05, REG-01, REG-02 |
| AC-07 | API-06, UI-03, REG-01, REG-02, E2E-02 |
| AC-08 | API-06, API-11, UI-03, REG-01, E2E-02 |
| AC-09 | API-09, UI-03, E2E-02 |
| AC-10 | UNIT-04, API-07, UI-04, E2E-03 |
| AC-11 | API-07, UI-04, STYLE-02, E2E-03, VIS-01 |
| AC-12 | API-08, UI-05, E2E-03 |
| AC-13 | UNIT-03, API-08, UI-05, E2E-03 |
| AC-14 | API-09, UI-05, UI-03, E2E-02, E2E-03 |
| AC-15 | API-08, API-11, UI-05, E2E-03 |
| AC-16 | API-10, UI-06, E2E-04 |
| AC-17 | UNIT-01, API-10, UI-06, E2E-04 |
| AC-18 | API-03, API-10, UI-02, UI-06, E2E-01, E2E-04 |
| AC-19 | API-10, UI-06, E2E-04 |
| AC-20 | UNIT-02, API-01, API-02, API-04, API-06, API-07, API-10, API-11, API-12 |
| AC-21 | UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, STYLE-01, STYLE-02, E2E-01, E2E-02, E2E-03, E2E-04, VIS-01 |
| AC-22 | API-05, REG-01, REL-01 |
| AC-23 | E2E-05, REL-01 |

## 6. FR-to-Test-ID traceability

Every functional requirement has at least one planned Test ID. The Test ID table above supplies the intended repository path for each ID.

| Functional requirement | Test IDs |
|---|---|
| FR-01 | API-01, UI-01, E2E-01 |
| FR-02 | API-03, UI-02, E2E-01 |
| FR-03 | UNIT-02, API-03, E2E-01 |
| FR-04 | API-04, API-12, E2E-01 |
| FR-05 | API-05, REG-01 |
| FR-06 | API-06, UI-03, REG-02, E2E-02 |
| FR-07 | API-06, API-11, UI-03, REG-01, E2E-02 |
| FR-08 | API-09, UI-03, E2E-02 |
| FR-09 | API-07, UI-04, E2E-03 |
| FR-10 | API-08, UI-05, E2E-03 |
| FR-11 | API-09, UI-03, UI-05, E2E-02, E2E-03 |
| FR-12 | API-09, UI-05, E2E-02, E2E-03 |
| FR-13 | API-10, UI-06, E2E-04 |
| FR-14 | API-10, UI-06, E2E-04 |
| FR-15 | API-05, REL-01 |
| FR-16 | API-01, API-04, API-06, API-07, API-10, API-11, API-12 |
| FR-17 | UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, STYLE-01, STYLE-02, VIS-01 |
| FR-18 | REL-01 |

## 7. BR-to-Test-ID traceability

The following mapping makes the business-rule coverage explicit. Each implementation test must assert the named rule rather than merely execute the endpoint.

| Business rule | Test IDs |
|---|---|
| BR-01 | API-01, API-04, E2E-01 |
| BR-02 | UNIT-01, API-10, UI-06, E2E-04 |
| BR-03 | UNIT-01, API-03, UI-01, UI-02 |
| BR-04 | UNIT-01, API-03, UI-02 |
| BR-05 | UNIT-02, API-02, E2E-01 |
| BR-06 | UNIT-02, API-03, E2E-01 |
| BR-07 | UNIT-02, API-04, E2E-01 |
| BR-08 | API-03, UI-02, E2E-01 |
| BR-09 | API-03, API-10, E2E-01, E2E-04 |
| BR-10 | API-01, API-10, UI-06, E2E-04 |
| BR-11 | API-04, API-06, REG-01 |
| BR-12 | API-08, API-10, UI-05, E2E-03, E2E-04 |
| BR-13 | UNIT-03, API-08, UI-05, E2E-03 |
| BR-14 | API-06, API-08, E2E-02, E2E-03 |
| BR-15 | UNIT-03, API-08, UI-05, E2E-03 |
| BR-16 | UNIT-03, API-08, E2E-03 |
| BR-17 | UNIT-03, API-08, UI-05, E2E-03 |
| BR-18 | API-09, UI-03, E2E-02 |
| BR-19 | API-09, UI-03, UI-05, E2E-02, E2E-03 |
| BR-20 | API-09, UI-03, E2E-02 |
| BR-21 | UNIT-04, API-07, UI-04, E2E-03 |
| BR-22 | UNIT-04, API-07, UI-04, E2E-03 |
| BR-23 | API-01, API-03, API-08, API-09, API-10, E2E-01, E2E-03, E2E-04 |
| BR-24 | API-10, UI-06, E2E-04 |
| BR-25 | API-03, API-10, UI-06, E2E-04 |
| BR-26 | API-05, REG-01, REL-01 |
| BR-27 | API-05, REL-01 |
| BR-28 | API-04, API-06, API-07, API-08, API-09, API-10, API-11, E2E-02, E2E-03 |

## 8. Issue #33 evidence checklist

- [x] Required-file red-phase check was run and failed for the expected reason.
- [x] The passing contract guard was rerun after all six files were added and its output is recorded above.
- [x] `specification.md`, `tests.md`, `ui-spec.md`, `api-spec.md`, `ai-use.md`, and `reviewer.md` are reviewed together as the Lab 3 contract.
- [x] Every FR, BR, and AC has a mapped Test ID and intended file path.
- [x] Contract-only diff contains no product implementation, generated output, credentials, or uploads.
- [x] Focused contract/document checks pass.
- [x] PR into `lab3-staging` is open.
- [ ] Teammate submits an actual GitHub **Approve** review.
- [ ] Student explicitly authorizes merge; card moves to Done only after merge.

## 9. Issue #34 evidence checklist

- [x] Branch `feature/14-Lab3AuthFoundation` was created from the latest merged `lab3-staging`.
- [x] Planned authentication validation test was run red before implementation.
- [x] Authentication validation, session-security primitives, session gates, and authorization safety tests pass (14 tests, including wrong-CSRF and idle/absolute-expiry API regressions).
- [x] All seven Issue #34 focused test files pass (25 tests).
- [x] Server build and the complete server regression suite pass (19 files, 65 tests).
- [x] Additive Prisma schema and migration files define User, Session, LoginAttemptBucket, UserRole, and preserved legacy Requester links.
- [x] Seed code fails closed when local Lab 3 initial-password variables are missing and preserves non-null credentials/changed-password flags on reruns.
- [x] Disposable database migration has been run successfully against `toktickit_lab2_test`.
- [x] Seeded login, first-password change, rate-limit recovery, session rotation/revocation, and origin/role safety have been verified against the migrated test database.
- [x] Migration preservation and repeated-seed integration tests are complete; a non-fixture Requester received an initial credential while its Ticket/Attachment ownership remained unchanged, and a changed non-fixture credential remained unchanged.
- [ ] Teammate submits an actual GitHub **Approve** review.
- [ ] Student explicitly authorizes commit, push, PR, and merge; card moves to Done only after merge.

## 10. Issue #35 evidence checklist

- [x] Branch `feature/15-Lab3RequesterAuthRegression` was created from the merged `lab3-staging` baseline.
- [x] Planned API, UI, and E2E red-phase tests were run before implementation and their observed failures are recorded above.
- [x] Authenticated session ownership ignores a spoofed `X-Requester-Id` header and rejects unauthenticated protected reference access.
- [x] Authenticated Requester Ticket list/create/detail and nested Attachment access pass the focused API regression; cross-owner detail returns safe `404 TICKET_NOT_FOUND`.
- [x] Public Comment creation and idempotent resolution indication pass in the focused API regression.
- [x] Login shell, selector removal, legacy requester-storage cleanup, and protected route redirect pass the focused UI/E2E checks.
- [x] The new PublicComment/resolution migration applies successfully to the disposable test database.
- [x] Review fixes pass: failed logout preserves the workspace with retry, protected `SESSION_REQUIRED` requests redirect to Login, `CLOSED`/`CANCELLED` resolution rules are covered, and direct `/change-password` access is guarded.
- [x] Follow-up review fixes pass: stale initial session restoration is ignored after Login, its delayed `401` cannot redirect the authenticated user, and unauthenticated `/staff/tickets`, `/staff/tickets/:ticketNumber`, and `/admin/users` redirect to Login.
- [x] Server and client builds pass for this Issue.
- [x] Full server/client regression suites pass (server 21 files/69 tests; client 8 files/36 tests).
- [ ] Full Requester comments/attachments E2E and release screenshots remain future release-gate evidence.
- [ ] Teammate submits an actual GitHub **Approve** review.
- [ ] Student explicitly authorizes commit, push, PR, and merge; card moves to Done only after merge.

## 11. Issue #36 evidence checklist

- [x] Branch `feature/16-Lab3StaffQueue` was created from the latest merged `lab3-staging` baseline.
- [x] Planned Staff Queue API and UI tests were run red before implementation; the observed missing-route and missing-screen failures are recorded above.
- [x] Additive migration adds all Lab 3 Ticket statuses, IT Priority, nullable staff ownership, indexes, and the `ON DELETE SET NULL` owner relation.
- [x] Staff Queue API requires an authenticated IT Staff or Administrator, validates every query parameter, returns safe 401/403/400/500 behavior, and exposes only active eligible assignees.
- [x] Queue API focused tests cover search, category/system, Requested/IT Priority, status, owner/me/unassigned, sorting, stable defaults, page sizes, inactive/ineligible references, exact response metadata, and functional staff Open-detail access with safe role/not-found responses (6 tests).
- [x] Queue UI focused tests cover controls, URL query state, table/cards, loading, empty/no-results distinction, safe Retry, forbidden state, and functional Open-detail navigation (5 tests).
- [x] Deterministic queue seed fixtures cover all eight statuses, all four priorities, and assigned/unassigned states; repeated guarded seed runs preserve 12 fixture Tickets.
- [x] Server build, client build, and complete client suite (9 files/41 tests) pass for the current branch.
- [ ] Complete server regression remains to be rerun with the local Lab 3 initial-password variables aligned with the existing disposable test credentials; the failed attempt is not counted as passing.
- [ ] Teammate submits an actual GitHub **Approve** review.
- [ ] Student explicitly authorizes commit, push, PR, and merge; card moves to Done only after merge.

## 12. Issue #37 evidence checklist

- [x] Branch `feature/17-Lab3TicketOperations` was created from the latest merged `lab3-staging` baseline.
- [x] Planned staff-operation API tests were written and run red first; the missing assignment/priority/status routes, staff attachment reads, staff comments, and Internal Notes endpoint were observed before implementation.
- [x] Additive Prisma schema/migration defines append-only `InternalNote` rows linked to Tickets and User authors with restrictive delete behavior.
- [x] Staff assignment API enforces active IT Staff/Administrator owners, required confirmation for reassignment/unassignment, and transactional row locking.
- [x] Staff IT Priority and status APIs enforce the shared enum, the complete status-transition matrix, consequential-status confirmations, and safe validation/conflict responses.
- [x] Public Comments now support Requester, IT Staff, and Administrator actors while preserving ownership-safe Requester access; Internal Notes are staff-only and excluded from Requester responses.
- [x] Staff/Admin Attachment metadata and active-file downloads use the existing Lab 2 routes; Requester-only upload/removal remains unchanged and removed downloads return safe `404`.
- [x] Focused staff API tests pass 4/4 and the status-transition unit tests pass 2/2. The Internal Note API test remains blocked until the additive migration is applied to the disposable test database; the current 500 is recorded rather than marked as passing.
- [x] Focused Staff Ticket Detail UI tests pass 3/3; the existing Staff Queue regression tests pass 5/5.
- [x] Server build and client build pass for this branch.
- [x] Complete client regression was rerun after Issue #37: 10 test files and 44 tests passed.
- [x] Complete server regression was attempted with `npm.cmd test -- --run`: 25 files ran with 47 tests passed, 8 failed, and 28 skipped. The failures are recorded as environment/migration blockers (missing local Lab 3 password variables and unapplied `InternalNote` migration), not as passing evidence.
- [x] Reopening a Ticket now clears its stored Requester resolution indication; the staff-operation API regression covers the reset.
- [x] `api-spec.md` and `ui-spec.md` now describe the implemented Issue #37 operations and staff-detail behavior.
- [ ] Apply `20260917110000_lab3_ticket_operations` to `toktickit_lab2_test`, rerun the complete API-09 notes test, and record the complete terminal output.
- [ ] Teammate submits an actual GitHub **Approve** review.
- [ ] Student explicitly authorizes commit, push, PR, and merge; card moves to Done only after merge.

## 13. Issue #39 evidence checklist

Issue #39 was started on `feature/19-Lab3E2EVisual` from the merged `lab3-staging` commit. The Playwright configuration
now uses the required repository-level `e2e` directory, an explicit `lab-03/**/*.spec.ts` test match, isolated
`*_test` database/schema validation, three responsive projects, and `artifacts/lab-03/playwright-report` output.
Legacy Lab 2 selector specs are not included in the Lab 3 run because the authenticated Lab 3 contract intentionally
removed the selector context.

The planned failing-first specs were added before the fixture helper and green-run configuration were completed. The
first attempted run was blocked before assertions because the local test seed did not have its required process-only
password variables:

```text
Command: cd client; npx.cmd playwright test e2e/lab-03/authentication.spec.ts --project=desktop --reporter=line
Result: blocked before tests; LAB3_REQUESTER_INITIAL_PASSWORD must be set locally before running the Lab 3 seed.
No password value was written to the repository or recorded here.
```

Static Playwright discovery now succeeds and enumerates 33 tests across desktop, tablet, and mobile in the five Lab 3
spec files. This confirms that all required test paths compile and are selected without required skips; it is not a
passing E2E result.

The complete isolated Playwright run then passed using process-only disposable Lab 3 password variables (the values
were not written to the repository). The global setup created the `_test` database/schema, applied the test migration,
seeded the fixture data, and cleaned the isolated schema after the run:

```text
Command: cd client; npx playwright test
Result: 33 passed (1.2m), 0 skipped, exit status 0
Projects: desktop, tablet, mobile
Specs: authentication, requester regression, staff queue/detail, user administration, release evidence states
```

The client regression and production build were rerun after the E2E changes:

```text
Command: cd client; npm.cmd test -- --run
Test Files  11 passed (11)
Tests       49 passed (49)
Result      exit status 0

Command: cd client; npm.cmd run build
Result      production TypeScript/Vite build passed
```

The server build also passed (`cd server; npm.cmd run build`). A complete server regression was rerun from this
branch, but it is not counted as green because the local ignored `.env.test` still lacks the three Lab 3 initial
password variables and the disposable database still needs the Internal Notes migration:

```text
Command: cd server; npm.cmd test -- --run
Test Files  11 failed | 15 passed (26)
Tests       8 failed | 53 passed | 28 skipped (89)
Result      exit status 1
Blockers    missing LAB3_*_INITIAL_PASSWORD values; unapplied InternalNote migration causing the Internal Notes API 500
```

- [x] The Issue #39 branch was created from the latest merged `lab3-staging` baseline.
- [x] Planned Lab 3 authentication, Requester, Staff, Administrator, role-isolation, accessibility, responsive, and
  evidence-state specs were written at the approved paths.
- [x] Playwright remains fail-closed: it requires `server/.env.test`, a disposable database ending in `_test`, and an
  allowlisted E2E schema; it does not fall back to `server/.env`.
- [x] Client regression (11 files/49 tests) and client build pass after the E2E changes.
- [x] Playwright discovery lists 33 Lab 3 tests with no configured skips.
- [x] Run the isolated migration/seed with process-only local Lab 3 password variables; no credential values were
  written to the repository or evidence.
- [x] Run `cd client; npx playwright test`: 33 passed, 0 skipped, exit status 0.
- [x] Preserve readable desktop/tablet/mobile screenshots under `artifacts/lab-03/screenshots/`; representative
  Change Password, Staff Ticket Detail, and mobile User Management images were manually inspected and the caption
  table below maps every evidence path to its requirement.
- [x] Server TypeScript build passes after the E2E changes.
- [ ] Rerun the complete server regression successfully after configuring local Lab 3 passwords and applying the
  Internal Notes migration; then complete the final release gates.
- [ ] Teammate submits an actual GitHub **Approve** review.
- [ ] Student explicitly authorizes commit, push, PR, and merge; card moves to Done only after merge.

Screenshot captions for the green isolated run:

| Evidence path | Caption | Requirement proved |
|---|---|---|
| `authentication/<project>/change-password.png` | First-login Change Password form at the named responsive breakpoint. | AC-03/04, accessible validation and responsive layout. |
| `authentication/<project>/requester-first-login.png` | Authenticated Requester My Tickets shell after the initial password change. | AC-01/02/07 and role identity/navigation. |
| `authentication/<project>/requester-ticket-detail.png` | Requester-owned Ticket detail with comment and attachment lifecycle evidence. | AC-07/08/09/14 and ownership/privacy behavior. |
| `authentication/<project>/logout-and-route-guard.png` | Login screen after logout and a protected-route redirect. | AC-04/05 and session safety. |
| `authentication/<project>/administrator-landing.png` | Administrator User Management landing workspace. | AC-16/17 and Administrator role navigation. |
| `staff-queue/<project>/queue-search.png` | Staff queue with URL-preserved search/filter controls. | AC-10/11 and responsive queue behavior. |
| `staff-queue/<project>/requester-role-isolation.png` | Requester role-denial state for the Staff Queue. | AC-05/20 and role isolation. |
| `staff-ticket-detail/<project>/detail-operations.png` | Staff Ticket Detail with public comments, Internal Notes, and operations controls. | AC-12/13/14/15. |
| `user-management/<project>/admin-users-list.png` | Administrator User Management table or mobile cards with usable Edit actions. | AC-16/17/19/21 and responsive accessibility. |
| `user-management/<project>/admin-no-results.png` | Safe User Management no-results state. | AC-20/21 safe feedback. |

## 14. Visual and evidence checklist

- [ ] Final `main` SHA and merge graph show the Lab 3 branch sequence.
- [ ] Contract PR is visibly approved and merged before product PRs.
- [ ] Login, Change Password, Requester, Staff Queue, Staff Detail, and Admin screenshots have readable captions and requirement links.
- [ ] Safe 401/403/404/409/429 responses and ownership/privacy evidence are sanitized.
- [ ] Complete server/client tests and builds show no unexpected failures.
- [ ] Migration plus two repeated seed runs show stable counts and preserved IDs.
- [ ] Playwright output shows all required Lab 3 tests passed with no required skips.
- [ ] `reviewer.md`, README, Project board, PRs, Issues, and documents have working links.
- [ ] Submission PDF uses exactly `Answer Part 1` through `Answer Part 9` in order.
