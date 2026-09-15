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
Tests       22 passed (22)
Result      exit status 0
```

The complete server regression command was then run on branch `feature/14-Lab3AuthFoundation`:

```text
Command: cd server; npm.cmd test -- --run
Test Files  19 passed (19)
Tests       62 passed (62)
Result      exit status 0
```

The server build also passed (`npm.cmd run build`). The documented disposable-database commands were run with process-only credentials and Lab 3 seed values (the values are intentionally not recorded):

```text
Command: cd server; npm.cmd run prisma:test:migrate
Using server/.env.test for Prisma migrate against database toktickit_lab2_test.
3 migrations found in prisma/migrations
No pending migrations to apply.

Command: cd server; npm.cmd run prisma:test:seed
Seeded 4 categories, 7 related systems, and 5 requesters.
Command repeated: cd server; npm.cmd run prisma:test:seed
Seeded 4 categories, 7 related systems, and 5 requesters.
```

Client work, E2E coverage, and later authenticated Requester/staff/admin feature Issues remain outside Issue #34.

## 3. Planned test matrix

All paths below are intended paths for the implementation branches. A test is not marked passed until its real command and output are recorded here.

| Test ID | Type | Covers | Planned test/path | Status |
|---|---|---|---|---|
| UNIT-01 | Unit | BR-02/03, AC-01/02/17 | Password, email normalization, and field-boundary validation — `server/tests/lab-03/auth-validation.unit.test.ts` | Passed: 4 tests |
| UNIT-02 | Unit | BR-05/06/07, AC-03/04/20 | Session expiry, CSRF, cookie flags, rate-limit key behavior — `server/tests/lab-03/session-security.unit.test.ts` | Passed: 3 tests |
| UNIT-03 | Unit | BR-13/15/16/17, AC-13 | Status-transition, Requested/IT Priority mutation matrix, and confirmation rules — `server/tests/lab-03/status-transition.unit.test.ts` | Planned |
| UNIT-04 | Unit | BR-18/19/20, AC-10 | Queue query parsing, defaults, ordering, and page bounds — `server/tests/lab-03/queue-query.unit.test.ts` | Planned |
| API-01 | API | FR-01/02, AC-01/02 | Login validation, seeded/temporary active login, safe inactive/unknown failure, and role payload — `server/tests/lab-03/auth.api.test.ts` | Passed: 6 tests |
| API-02 | API | BR-05, AC-02/20 | Failed-login bucket, temporary block, and recovery — `server/tests/lab-03/auth-rate-limit.api.test.ts` | Passed: 1 test |
| API-03 | API | FR-02/03, AC-03/04/18 | First-login password change, session rotation, idempotent logout, and old-session revocation — `server/tests/lab-03/auth-session.api.test.ts` | Passed: 3 tests; later protected-route gates remain in Issue #35 |
| API-04 | API | FR-04, AC-05/20 | Origin and wrong-role helper safety; full direct endpoint authorization remains with later protected APIs — `server/tests/lab-03/authorization.api.test.ts` | Passed: 2 tests |
| API-05 | Integration | FR-05/15, AC-06/22 | Applied migration User-ID/credential preservation, changed-password preservation, and repeated idempotent seed counts — `server/tests/lab-03/migration-seed.api.test.ts` | Passed: 3 tests; pre-migration Ticket/Attachment fixture audit remains part of the release migration evidence |
| API-06 | API | FR-06/07, AC-07/08/20 | Authenticated Requester Ticket/Attachment continuity, inherited Ticket field/priority validation, exact Lab 2 nested routes, and ownership isolation — `server/tests/lab-03/requester-regression.api.test.ts` | Planned |
| API-07 | API | FR-09, AC-10/11 | Staff queue search/filter/sort/pagination/defaults, Requested/IT Priority filters and sorting, and safe failures — `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-08 | API | FR-10, AC-12/13/15 | Staff detail assignment, Requested/IT Priority values and mutation, status, and Attachment access — `server/tests/lab-03/staff-ticket-detail.api.test.ts` | Planned |
| API-09 | API | FR-08/11/12, AC-09/14 | Public Comments, stable Requester `403 FORBIDDEN` Internal Notes denial, privacy, authorship, validation, append-only behavior — `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-10 | API | FR-13/14, AC-16/17/18/19 | Admin user list/create/edit/activation/reset, `USER_OWNS_TICKETS` atomic rejection, session revocation after role/activation changes, and safety rules — `server/tests/lab-03/users-admin.api.test.ts` | Planned |
| API-11 | API | FR-07/11, AC-08/15 | Active/removed Attachment metadata, download headers, exact route compatibility, and staff/requester access continuation — `server/tests/lab-03/attachment-continuity.api.test.ts` | Planned |
| API-12 | API | FR-04/16, AC-05/20 | Exact authenticated Categories, Related Systems, and staff-assignee response/error contracts — `server/tests/lab-03/reference-data.api.test.ts` | Planned |
| UI-01 | Component | FR-01/02/17, AC-01/02/03/21 | Login form, safe failure, busy guard, and redirect — `client/tests/lab-03/Login.test.tsx` | Planned |
| UI-02 | Component | FR-02/03/17, AC-03/04/21 | Change-password guard, policy errors, success, and focus — `client/tests/lab-03/ChangePassword.test.tsx` | Planned |
| UI-03 | Component | FR-06/07/08, AC-07/08/09/21 | Authenticated shell and Requester list/create/detail regression — `client/tests/lab-03/RequesterRegression.test.tsx` | Planned |
| UI-04 | Component | FR-09/17, AC-10/11/21 | Queue controls, Requested/IT Priority filters and sorting, states, role visibility, cards/table, and pagination — `client/tests/lab-03/StaffTicketQueue.test.tsx` | Planned |
| UI-05 | Component | FR-10/11/12, AC-12/13/14/15/21 | Staff detail actions, priority mutation, dialogs, comments, notes, and attachments — `client/tests/lab-03/StaffTicketDetail.test.tsx` | Planned |
| UI-06 | Component | FR-13/14, AC-16/17/18/19/21 | User list/editor, validation, activation, `USER_OWNS_TICKETS` conflict feedback, session-effect messaging, and reset controls — `client/tests/lab-03/UserManagement.test.tsx` | Planned |
| STYLE-01 | Style/a11y | FR-17, AC-11/21 | Labels, focus, roles, contrast, touch targets, semantic feedback — `client/tests/lab-03/Accessibility.test.tsx` | Planned |
| STYLE-02 | Responsive | FR-17, AC-11/21 | Desktop/tablet/mobile layout and no page-wide horizontal scroll — `client/tests/lab-03/Responsive.test.tsx` | Planned |
| REG-01 | Regression | AC-06/07/08/15 | Complete prior server suite after migration and auth integration — `server/tests/lab-01/**`, `server/tests/lab-02/**` | Planned |
| REG-02 | Regression | AC-06/07/08/21 | Complete prior client suite after selector-to-auth migration — `client/tests/lab-01/**`, `client/tests/lab-02/**` | Planned |
| E2E-01 | E2E | AC-01/02/03/04/05/21 | Login, first-login change, logout, guard, and role navigation — `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-02 | E2E | AC-07/08/09/14/21 | Requester Ticket continuity, comment, resolution indication, and note privacy — `e2e/lab-03/requester-regression.spec.ts` | Planned |
| E2E-03 | E2E | AC-10/11/12/13/14/15/21 | Staff queue/detail operations, priority filters/mutations, comments, notes, attachments, and responsive views — `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-04 | E2E | AC-16/17/18/19/21 | Admin User Management and safety protections — `e2e/lab-03/user-administration.spec.ts` | Planned |
| E2E-05 | E2E | AC-23 | Release evidence states and final-main evidence capture — `e2e/lab-03/release-evidence-states.spec.ts` | Planned |
| VIS-01 | Visual | AC-11/21 | Readable desktop/tablet/mobile screenshots and visual checklist — `artifacts/lab-03/screenshots/` | Planned |
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
- [x] Authentication validation, session-security primitives, session gates, and authorization safety tests pass (14 focused tests).
- [x] Server build and the complete server regression suite pass (17 files, 54 tests).
- [x] Additive Prisma schema and migration files define User, Session, LoginAttemptBucket, UserRole, and preserved legacy Requester links.
- [x] Seed code fails closed when local Lab 3 initial-password variables are missing and preserves non-null credentials/changed-password flags on reruns.
- [x] Disposable database migration has been run successfully against `toktickit_lab2_test`.
- [x] Seeded login, first-password change, rate-limit recovery, session rotation/revocation, and origin/role safety have been verified against the migrated test database.
- [x] Migration preservation and repeated-seed integration tests are complete; a changed non-fixture credential remained unchanged.
- [ ] Teammate submits an actual GitHub **Approve** review.
- [ ] Student explicitly authorizes commit, push, PR, and merge; card moves to Done only after merge.

## 10. Visual and evidence checklist

- [ ] Final `main` SHA and merge graph show the Lab 3 branch sequence.
- [ ] Contract PR is visibly approved and merged before product PRs.
- [ ] Login, Change Password, Requester, Staff Queue, Staff Detail, and Admin screenshots have readable captions and requirement links.
- [ ] Safe 401/403/404/409/429 responses and ownership/privacy evidence are sanitized.
- [ ] Complete server/client tests and builds show no unexpected failures.
- [ ] Migration plus two repeated seed runs show stable counts and preserved IDs.
- [ ] Playwright output shows all required Lab 3 tests passed with no required skips.
- [ ] `reviewer.md`, README, Project board, PRs, Issues, and documents have working links.
- [ ] Submission PDF uses exactly `Answer Part 1` through `Answer Part 9` in order.
