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

The command exited with status `1`. This is historical red-phase evidence for Issue #33. The six contract files are now present; the guard must be rerun and pass before the Issue #33 PR is opened.

## 3. Planned test matrix

All paths below are intended paths for the implementation branches. A test is not marked passed until its real command and output are recorded here.

| Test ID | Type | Covers | Planned test/path | Status |
|---|---|---|---|---|
| UNIT-01 | Unit | BR-02/03, AC-01/02/17 | Password, email normalization, and field-boundary validation — `server/tests/lab-03/auth-validation.unit.test.ts` | Planned |
| UNIT-02 | Unit | BR-05/06/07, AC-03/04/20 | Session expiry, CSRF, cookie flags, rate-limit key behavior — `server/tests/lab-03/session-security.unit.test.ts` | Planned |
| UNIT-03 | Unit | BR-21/22, AC-13 | Status-transition matrix and confirmation rules — `server/tests/lab-03/status-transition.unit.test.ts` | Planned |
| UNIT-04 | Unit | BR-18/19/20, AC-10 | Queue query parsing, defaults, ordering, and page bounds — `server/tests/lab-03/queue-query.unit.test.ts` | Planned |
| API-01 | API | FR-01/02, AC-01/02 | Login success, safe invalid/inactive failure, and role payload — `server/tests/lab-03/auth.api.test.ts` | Planned |
| API-02 | API | BR-05, AC-02/20 | Failed-login bucket, temporary block, and recovery — `server/tests/lab-03/auth-rate-limit.api.test.ts` | Planned |
| API-03 | API | FR-02/03, AC-03/04/18 | First-login password change, session rotation, logout, expiry, and reset revocation — `server/tests/lab-03/auth-session.api.test.ts` | Planned |
| API-04 | API | FR-04, AC-05/20 | Missing/wrong-role route and endpoint authorization — `server/tests/lab-03/authorization.api.test.ts` | Planned |
| API-05 | Integration | FR-05/15, AC-06/22 | Migration preservation and repeated idempotent seed counts — `server/tests/lab-03/migration-seed.api.test.ts` | Planned |
| API-06 | API | FR-06/07, AC-07/08/20 | Authenticated Requester Ticket/Attachment continuity and ownership isolation — `server/tests/lab-03/requester-regression.api.test.ts` | Planned |
| API-07 | API | FR-09, AC-10/11 | Staff queue search/filter/sort/pagination/defaults and safe failures — `server/tests/lab-03/staff-queue.api.test.ts` | Planned |
| API-08 | API | FR-10, AC-12/13/15 | Staff detail assignment, priority, status, and Attachment access — `server/tests/lab-03/staff-ticket.api.test.ts` | Planned |
| API-09 | API | FR-08/11/12, AC-09/14 | Public Comments, Internal Notes privacy, authorship, validation, append-only behavior — `server/tests/lab-03/comments-notes.api.test.ts` | Planned |
| API-10 | API | FR-13/14, AC-16/17/18/19 | Admin user list/create/edit/activation/reset and safety rules — `server/tests/lab-03/admin-users.api.test.ts` | Planned |
| API-11 | API | FR-07/11, AC-08/15 | Active/removed Attachment metadata and staff/requester access continuation — `server/tests/lab-03/attachment-continuity.api.test.ts` | Planned |
| UI-01 | Component | FR-01/02/17, AC-01/02/03/21 | Login form, safe failure, busy guard, and redirect — `client/src/**/__tests__/lab3-login.test.tsx` | Planned |
| UI-02 | Component | FR-02/03/17, AC-03/04/21 | Change-password guard, policy errors, success, and focus — `client/src/**/__tests__/lab3-change-password.test.tsx` | Planned |
| UI-03 | Component | FR-06/07/08, AC-07/08/09/21 | Authenticated shell and Requester list/create/detail regression — `client/src/**/__tests__/lab3-requester-regression.test.tsx` | Planned |
| UI-04 | Component | FR-09/17, AC-10/11/21 | Queue controls, states, role visibility, cards/table, and pagination — `client/src/**/__tests__/lab3-staff-queue.test.tsx` | Planned |
| UI-05 | Component | FR-10/11/12, AC-12/13/14/15/21 | Staff detail actions, dialogs, comments, notes, and attachments — `client/src/**/__tests__/lab3-staff-detail.test.tsx` | Planned |
| UI-06 | Component | FR-13/14, AC-16/17/18/19/21 | User list/editor, validation, activation, and reset controls — `client/src/**/__tests__/lab3-user-management.test.tsx` | Planned |
| STYLE-01 | Style/a11y | FR-17, AC-11/21 | Labels, focus, roles, contrast, touch targets, semantic feedback — `client/src/**/__tests__/lab3-accessibility.test.tsx` | Planned |
| STYLE-02 | Responsive | FR-17, AC-11/21 | Desktop/tablet/mobile layout and no page-wide horizontal scroll — `client/src/**/__tests__/lab3-responsive.test.tsx` | Planned |
| REG-01 | Regression | AC-06/07/08/15 | Complete prior server suite after migration and auth integration — `server/tests/lab-01/**`, `server/tests/lab-02/**` | Planned |
| REG-02 | Regression | AC-06/07/08/21 | Complete prior client suite after selector-to-auth migration — `client/src/**/__tests__/**` | Planned |
| E2E-01 | E2E | AC-01/02/03/04/05/21 | Login, first-login change, logout, guard, and role navigation — `e2e/lab-03/authentication.spec.ts` | Planned |
| E2E-02 | E2E | AC-07/08/09/14/21 | Requester Ticket continuity, comment, resolution indication, and note privacy — `e2e/lab-03/requester-regression.spec.ts` | Planned |
| E2E-03 | E2E | AC-10/11/12/13/14/15/21 | Staff queue/detail operations, comments, notes, attachments, and responsive views — `e2e/lab-03/staff-ticket-flow.spec.ts` | Planned |
| E2E-04 | E2E | AC-16/17/18/19/21 | Admin User Management and safety protections — `e2e/lab-03/user-administration.spec.ts` | Planned |
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

## 5. Acceptance-criteria traceability

| Acceptance criterion | Test IDs |
|---|---|
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | UNIT-01, API-01, API-02, UI-01, E2E-01 |
| AC-03 | API-03, UI-02, E2E-01 |
| AC-04 | UNIT-02, API-03, UI-02, E2E-01 |
| AC-05 | API-04, E2E-01 |
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
| AC-20 | UNIT-02, API-01, API-02, API-04, API-06, API-07, API-10, API-11 |
| AC-21 | UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, STYLE-01, STYLE-02, E2E-01, E2E-02, E2E-03, E2E-04, VIS-01 |
| AC-22 | API-05, REG-01, REL-01 |
| AC-23 | REL-01 |

## 6. Issue #33 evidence checklist

- [x] Required-file red-phase check was run and failed for the expected reason.
- [ ] `specification.md`, `tests.md`, `ui-spec.md`, `api-spec.md`, `ai-use.md`, and `reviewer.md` are reviewed together and approved as the Lab 3 contract.
- [ ] Every FR, BR, and AC has a mapped Test ID and intended file path.
- [ ] Contract-only diff contains no product implementation, generated output, credentials, or uploads.
- [ ] Focused contract/document checks pass.
- [ ] PR into `lab3-staging` is opened only after student authorization.
- [ ] Teammate submits an actual GitHub **Approve** review.
- [ ] Student explicitly authorizes merge; card moves to Done only after merge.

## 7. Visual and evidence checklist

- [ ] Final `main` SHA and merge graph show the Lab 3 branch sequence.
- [ ] Contract PR is visibly approved and merged before product PRs.
- [ ] Login, Change Password, Requester, Staff Queue, Staff Detail, and Admin screenshots have readable captions and requirement links.
- [ ] Safe 401/403/404/409/429 responses and ownership/privacy evidence are sanitized.
- [ ] Complete server/client tests and builds show no unexpected failures.
- [ ] Migration plus two repeated seed runs show stable counts and preserved IDs.
- [ ] Playwright output shows all required Lab 3 tests passed with no required skips.
- [ ] `reviewer.md`, README, Project board, PRs, Issues, and documents have working links.
- [ ] Submission PDF uses exactly `Answer Part 1` through `Answer Part 9` in order.
