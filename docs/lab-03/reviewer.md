# Lab 3 - Peer Review Record

**Author:** Ashira Sansoda (student ID 67070503445) - [@osizk](https://github.com/osizk)

**Peer reviewer:** Thira Rungruangkaset (student ID 67070503419) - [@HolyThiccDaddy](https://github.com/HolyThiccDaddy)

**My repository:** [osizk/TokTickIT](https://github.com/osizk/TokTickIT)
**Partner repository:** [HolyThiccDaddy/toktickit](https://github.com/HolyThiccDaddy/toktickit)

## Pull Requests I authored (partner feedback and review records)

| PR | Branch | Merge commit | Reviewer verdict |
|---|---|---|---|
| [#43](https://github.com/osizk/TokTickIT/pull/43) | `feature/13-Lab3Contract` | `dceb6f3` | Merged into `lab3-staging`; partner submitted **Changes requested** reviews ([first](https://github.com/osizk/TokTickIT/pull/43#pullrequestreview-5196981000), [latest](https://github.com/osizk/TokTickIT/pull/43#pullrequestreview-5208006328)); no formal Approve recorded. |
| [#44](https://github.com/osizk/TokTickIT/pull/44) | `feature/14-Lab3AuthFoundation` | `8f16213` | Merged; partner submitted comments and a formal **Approve** ([review](https://github.com/osizk/TokTickIT/pull/44#pullrequestreview-5213002067)). |
| [#45](https://github.com/osizk/TokTickIT/pull/45) | `feature/15-Lab3RequesterAuthRegression` | `fdecfd9` | Merged; partner submitted six comment reviews, but no formal Approve review is recorded. |
| [#46](https://github.com/osizk/TokTickIT/pull/46) | `feature/16-Lab3StaffQueue` | `13402cc` | Merged; partner feedback is recorded as a PR comment, with no submitted formal review. |
| [#47](https://github.com/osizk/TokTickIT/pull/47) | `feature/17-Lab3TicketOperations` | `d78b0f0` | Merged; no submitted partner review is recorded. |
| [#48](https://github.com/osizk/TokTickIT/pull/48) | `feature/18-Lab3UserManagement` | `d257f9d` | Merged; partner feedback and responses are recorded below, with no submitted formal review. |
| [#49](https://github.com/osizk/TokTickIT/pull/49) | `feature/19-Lab3E2EVisual` | `522eab4` | Merged; partner feedback and responses are recorded below, with no submitted formal review. |

**Reviewer verdict:** GitHub confirms all seven authored Lab 3 PRs (#43–#49) are merged into `lab3-staging`. Only PR #44 has a recorded teammate **Approve**; PR #43 has changes-requested reviews, PR #45 has comment-only reviews, and PRs #46–#49 have no submitted formal review in the API. The links above are the authoritative records.

Formal GitHub **Approve** recorded: [HolyThiccDaddy approval on PR #44](https://github.com/osizk/TokTickIT/pull/44#pullrequestreview-5213002067).

**My response:** I recorded the actual merge commits, reviewer states, comments, responses, and approval evidence from my repository. I distinguish a formal GitHub **Approve** from comments or changes-requested feedback and do not claim approval where GitHub has no submitted approval.

## Pull Requests I reviewed for my partner

| PR | Branch | Merge commit | My review verdict |
|---|---|---|---|
| [#40](https://github.com/HolyThiccDaddy/toktickit/pull/40) | `feature/lab3-contract` | `40ca398` | I submitted **Changes requested**, then **Approve** ([approval](https://github.com/HolyThiccDaddy/toktickit/pull/40#pullrequestreview-5186011435)). |
| [#41](https://github.com/HolyThiccDaddy/toktickit/pull/41) | `feature/36-db-auth` | `b49c8b2` | I submitted **Changes requested**, then **Approve** ([approval](https://github.com/HolyThiccDaddy/toktickit/pull/41#pullrequestreview-5186798193)). |
| [#42](https://github.com/HolyThiccDaddy/toktickit/pull/42) | `feature/37-requester-regression` | `0ee0002` | I submitted changes-requested reviews, then **Approve** ([approval](https://github.com/HolyThiccDaddy/toktickit/pull/42#pullrequestreview-5212665518)). |
| [#43](https://github.com/HolyThiccDaddy/toktickit/pull/43) | `feature/38-staff-queue` | `c1cd708` | I submitted **Changes requested**, then **Approve** ([approval](https://github.com/HolyThiccDaddy/toktickit/pull/43#pullrequestreview-5232222384)). |
| [#44](https://github.com/HolyThiccDaddy/toktickit/pull/44) | `feature/39-admin-e2e-release` | `bd5872a` | I submitted **Changes requested**, then **Approve** ([approval](https://github.com/HolyThiccDaddy/toktickit/pull/44#pullrequestreview-5245822340)). |

**My review verdict:** GitHub confirms five Lab 3 partner PRs (#40–#44) were merged into the partner's `lab3-staging`, and each has my recorded formal **Approve** after any requested changes were addressed. The partner repository and every PR link are listed above; Lab 2 reviews remain in `docs/lab-02/reviewer.md`.

**Partner's response:** The partner's comments and responses for my Lab 3 PRs are recorded under Issues #33–#39 below. PR #44 contains the recorded teammate **Approve**; the other authored PRs are explicitly labeled comment-only, changes-requested, or no formal review where that is what GitHub shows.

## Issue #34 review status

| PR | Branch | Review status | Response/evidence |
|---|---|---|---|
| [#44](https://github.com/osizk/TokTickIT/pull/44) | `feature/14-Lab3AuthFoundation` | Merged into `lab3-staging`; teammate **Approve** recorded | Merge commit `8f16213`; the approval is [PR review 5213002067](https://github.com/osizk/TokTickIT/pull/44#pullrequestreview-5213002067). |

### Inline review comments and responses

| Reviewer comment | Student response and verification | Status |
|---|---|---|
| [P1 — backfill credentials for every migrated Requester](https://github.com/osizk/TokTickIT/pull/44#discussion_r4017577594): the migration/seed path must include non-fixture Lab 2 Requesters and preserve Ticket/Attachment ownership. | Updated the seed to derive credential backfill from every `Requester` row instead of only the five fixtures. Added a disposable-test integration case that creates a non-fixture Requester with a Ticket and Attachment, runs the idempotent seed, and verifies the User ID, credential state, Ticket requester ID, and Attachment ticket link remain correct. | Addressed in [commit `38aa06a`](https://github.com/osizk/TokTickIT/commit/38aa06a); merged in PR #44 after the partner's formal approval. |
| [P2 — refresh Issue #34 evidence](https://github.com/osizk/TokTickIT/pull/44#discussion_r4017589762): stale test counts and missing explicit idle/absolute-expiry and wrong-CSRF regression evidence. | Updated `tests.md` to the current counts and added API regressions for wrong CSRF plus idle and absolute expiry. The focused Lab 3 suite passed 7 files/25 tests; the full server suite passed 19 files/65 tests; the server build also passed. | Addressed in [commit `38aa06a`](https://github.com/osizk/TokTickIT/commit/38aa06a); merged in PR #44 after the partner's formal approval. |

**Reviewer verdict:** The two inline comments were addressed in pushed commit `38aa06a`; PR #44 then received the partner's formal **Approve** and was merged into `lab3-staging`.

**My review verdict:** I accepted both corrections because they protect real migration data and make the Issue #34 evidence match the tests actually executed. The changes remained within the authentication foundation scope, and GitHub records the subsequent approval and merge.

## Issue #35 review status

| PR | Branch | Review status | Response/evidence |
|---|---|---|---|
| [#45](https://github.com/osizk/TokTickIT/pull/45) | `feature/15-Lab3RequesterAuthRegression` | Merged into `lab3-staging`; comment-only feedback, no formal Approve recorded | The partner identified six findings: failed-logout handling, post-session-expiry `401` routing, resolution terminal-status coverage, direct `/change-password` guarding, stale initial session restoration, and missing Staff/Admin role-route guards. The fixes were merged in commit `fdecfd9`. |

### Partner comments and student responses

| Partner comment | Student response and verification | Status |
|---|---|---|
| Logout failures must not clear the authenticated UI and must provide retry. | Updated the API client to throw on failed logout responses and the shell to preserve the workspace with a retryable error. Added a UI regression covering a failed attempt followed by a successful retry. | Addressed locally; focused test passes. |
| Protected `401 SESSION_REQUIRED` responses must redirect to Login after session restoration. | Added a shared API-to-App session-expiry handler and a regression where the Ticket list returns `401` after sign-in. | Addressed locally; focused test passes. |
| Resolution indication must reject the deterministic terminal statuses. | Defined `CLOSED` and `CANCELLED` as the only terminal statuses for this indication, aligned the specification/API contract, and added unit coverage. | Addressed locally; focused test passes. |
| Direct `/change-password` access must be guarded when unauthenticated. | Added `/change-password` to the protected route predicate and a direct-access regression. | Addressed locally; focused test passes. |
| [P1 — slow initial session restore](https://github.com/osizk/TokTickIT/pull/45#discussion_r4028034803) must not overwrite a successful Login or trigger stale session-expiry handling. | Added an auth-generation guard, ignored stale restore results after Login/logout/session expiry, suppressed the initial restore's stale `401` notification, and added a delayed-response regression. | Addressed in merged PR #45; partner review record is comment-only. |
| [P2 — role landing routes](https://github.com/osizk/TokTickIT/pull/45#discussion_r4028067621) `/staff/tickets`, `/staff/tickets/:ticketNumber`, and `/admin/users` must redirect to Login when unauthenticated. | Added all role landing routes to the protected-path predicate and a parameterized direct-access regression for each route. | Addressed in merged PR #45; partner review record is comment-only. |

**Reviewer verdict:** All six comments were actionable and within Issue #35. The fixes are included in merged PR #45; GitHub records comment-only feedback and no formal partner **Approve**.

**My review verdict:** I accepted all six findings because they address authentication continuity, route protection, and contract determinism rather than optional polish. The focused and complete client test/build results are recorded in `tests.md`; full authenticated Requester E2E remains a later release gate.

## Issue #36 review status

| PR | Branch | Review status | Response/evidence |
|---|---|---|---|
| [#46](https://github.com/osizk/TokTickIT/pull/46) | `feature/16-Lab3StaffQueue` | Merged into `lab3-staging`; partner comment addressed, no submitted formal review | The partner identified one P1: the Queue Open action linked to an unimplemented staff detail route and a staff session could not use the Requester-only detail API. The correction was merged in commit `13402cc` while leaving Staff Ticket Operations for Issue #37. |

### Partner comments and student responses

| Partner comment | Student response and verification | Status |
|---|---|---|
| [P1 — Queue Open action must load staff detail](https://github.com/osizk/TokTickIT/pull/46#issuecomment-5702855591): `/staff/tickets/:ticketNumber` fell through to “Access not available”, and the existing Requester detail endpoint rejected staff sessions. | Added `GET /api/staff/tickets/:ticketNumber` with exact StaffTicket serialization and safe `401`/`403`/`404`/`500` behavior, added the read-only `StaffTicketDetail` route/page, and added API/UI regressions for staff success, missing Ticket, Requester denial, unauthenticated access, and Open navigation. | Addressed in merged PR #46; focused server/client tests and both builds passed. No submitted formal partner review is recorded. |

**Reviewer verdict:** The P1 comment identified a real FR-09/AC-11 Open-action gap. The fix is included in merged PR #46; GitHub shows partner feedback as a comment and no submitted formal **Approve**.

**My review verdict:** I accepted the finding because the approved Queue contract requires a usable Open action. I implemented only the read-only staff detail target needed by Issue #36 and kept assignment, status, comments, notes, and Attachment operations in the planned Issue #37 scope.

## Issue #37 review status

| PR | Branch | Review status | Response/evidence |
|---|---|---|---|
| [#47](https://github.com/osizk/TokTickIT/pull/47) | `feature/17-Lab3TicketOperations` | Merged into `lab3-staging`; no submitted formal partner review | Merge commit `d78b0f0`. The approved Staff Ticket Operations scope and its focused API/UI/build evidence are recorded in `tests.md`; no partner review or approval is claimed because GitHub has no submitted review for this PR. |

**Reviewer verdict:** PR #47 is merged, but the GitHub review API has no submitted partner review for it. The merge status and evidence are recorded without inventing comments or an approval.

**My review verdict:** I verified the merged commit and retained the Issue #37 test/evidence references in `tests.md`. There is no formal partner review to summarize for this PR.

## Issue #38 review status

| PR | Branch | Review status | Response/evidence |
|---|---|---|---|
| [#48](https://github.com/osizk/TokTickIT/pull/48) | `feature/18-Lab3UserManagement` | Merged into `lab3-staging`; partner comments addressed, no submitted formal review | Commits [`335b016`](https://github.com/osizk/TokTickIT/commit/335b016) and [`895f635`](https://github.com/osizk/TokTickIT/commit/895f635) contain the Administrator User Management implementation and review-evidence fixes; merge commit is `d257f9d`. |

### Planned review scope

The review scope was Administrator-only User Management: list/search/role filter, one-role create/edit/activation, duplicate email, owner-ineligibility, self/last-Administrator safety, password reset/session revocation, safe errors, and responsive accessible UI without adding deletion, bulk, import/export, or staff workflow features. The partner comments and student responses are recorded below; GitHub has no submitted formal review for PR #48.

### Partner comments and student responses

| Partner comment | Student response and verification | Status |
|---|---|---|
| [Comment 1](https://github.com/osizk/TokTickIT/pull/48#issuecomment-5726461558): the last-Administrator test only covered self-deactivation and did not prove the sole-active-Administrator User/session state remained unchanged. | Added a guarded disposable-database regression that temporarily establishes exactly one active Administrator, attempts self-deactivation, asserts `409 ADMINISTRATOR_SAFETY_VIOLATION`, compares the User row before/after, verifies the active session count is unchanged, and confirms `/api/auth/me` still succeeds. | Addressed in [`895f635`](https://github.com/osizk/TokTickIT/commit/895f635); Administrator API suite passes 6/6. |
| [Comment 2](https://github.com/osizk/TokTickIT/pull/48#issuecomment-5726462794): User Management tests did not cover the separate mobile card layout and usable Edit actions. | Added mobile-card/Edit-action component coverage and shared responsive stylesheet assertions for the mobile table/card switch, internal table overflow, and page-wide overflow guard. | Addressed in [`895f635`](https://github.com/osizk/TokTickIT/commit/895f635); User Management plus shared style tests pass 8/8. |
| [Comment 3](https://github.com/osizk/TokTickIT/pull/48#issuecomment-5726464111): API-10/UI-06 evidence counts and matrix statuses were inconsistent. | Updated the Issue #38 evidence to 6 API tests and 4 UI tests, changed both matrix rows from Planned to Passed, and recorded the updated complete-client count. | Addressed in [`895f635`](https://github.com/osizk/TokTickIT/commit/895f635) in `tests.md`. |

**Reviewer verdict:** The partner comments were addressed in PR #48 before it merged into `lab3-staging`. GitHub has no submitted formal **Approve** for this PR.

**My review verdict:** I accepted all three comments because they strengthen direct safety coverage, responsive evidence, and traceability accuracy without expanding Issue #38 scope. The focused checks are green locally; full server regression and release evidence remain documented separately in `tests.md`.

## Issue #39 review status

| PR | Branch | Review status | Response/evidence |
|---|---|---|---|
| [#49](https://github.com/osizk/TokTickIT/pull/49) | `feature/19-Lab3E2EVisual` | Merged into `lab3-staging`; partner feedback addressed, no submitted formal review | The partner identified three E2E evidence gaps: a false-positive Staff Queue assertion and missing Staff Detail operations, an indirect `/select-requester` check, and Administrator E2E traceability that overstated mutation/safety coverage. The fixes were merged in commit `522eab4`. |

### Partner comments and student responses

| Partner comment | Student response and verification | Status |
|---|---|---|
| Staff Queue search used `getByText(/Ticket/).first()`, and Staff Ticket Detail only checked controls instead of exercising real operations and Attachment continuity. | Changed the queue assertion to target the seeded `Laptop battery drains during meetings` Ticket. The detail test now creates an isolated Requester Ticket with an Attachment, then verifies staff assignment, IT Priority, status, Public Comment, Internal Note, and active Attachment download. | Addressed locally; Staff Queue/Detail Playwright coverage passes 9/9 across desktop, tablet, and mobile. |
| The old-selector test opened `/tickets` while logged out rather than `/select-requester`. | The regression now visits `/select-requester` directly while logged out and authenticated, verifies the safe redirects, confirms the selector heading is absent, and checks that the legacy `selectedRequesterId` session-storage key is absent. | Addressed locally; Requester regression passes 6/6 across desktop, tablet, and mobile. |
| Administrator E2E-04 claimed mutation/safety coverage without testing Save User, duplicate email, ownership conflict, last Administrator, activation, or password reset. | Narrowed E2E-04 in `tests.md` to Administrator list/search/editor/no-results/responsive/role-isolation smoke coverage. Existing API-10 and UI-06 tests remain the authoritative mutation and Administrator-safety coverage instead of duplicating every case in E2E. | Addressed locally; Administrator E2E passes 6/6 across desktop, tablet, and mobile, and the complete Playwright matrix passes 33/33 with no skips. |
| The release evidence still recorded 8 server failures and 28 skipped tests because the local Lab 3 passwords and Internal Notes migration had not been configured. | Reset only the validated disposable `toktickit_lab2_test` database, applied all six migrations, ran the guarded seed twice (12 then 0 Tickets created), and reran the complete server suite from commit `030d1db`; the result is 26 files/89 tests passed with no failures or skips. The passing terminal output and updated release checkbox are recorded in `tests.md`. | Addressed in the merged evidence update; GitHub has no submitted formal partner review for PR #49. |

**Reviewer verdict:** The three comments identified real assertion and traceability gaps. The updated tests and evidence are included in merged PR #49; GitHub has no submitted formal partner **Approve**.

**My review verdict:** I accepted the comments. The Staff and selector findings required stronger executable assertions; the Administrator finding was corrected by making the E2E claim accurate while retaining the detailed API/UI safety coverage in their intended test paths. The fixes remain within Issue #39.

## Issue #40 release-evidence status

| PR | Branch | Review status | Response/evidence |
|---|---|---|---|
| Not opened | `feature/20-Lab3ReleaseEvidence` | Release audit in progress; no Issue #40 PR review claimed | The repository-level audit, candidate history, pre-promotion record, Project/Issue/PR evidence, and student-confirmed PDF audit are recorded under `docs/lab-03/release-evidence/`. The existing formal teammate **Approve** for PR #44 is recorded above; no Issue #40 approval is claimed because its PR has not been opened. |

**Reviewer verdict:** No Issue #40 PR has been opened yet. GitHub confirms that PRs #43-#49 are merged and Issues #33-#39 are closed. The actual review state of every PR remains recorded without relabeling comments or changes-requested reviews as formal approvals.

**My review verdict:** I kept the release work bounded to evidence tooling and truthful documentation. The repository records the pre-promotion baseline because the final merge SHA cannot exist before promotion; the student confirms the final `main` graph, Project board, and PDF audit will be preserved in the submission PDF. No Issue #40 approval is claimed before its PR exists.

## Review evidence rules

- Record the exact PR, branch, Issue, review, response, and merge links after they exist.
- Distinguish a formal GitHub **Approve** from an issue comment or general conversation.
- Do not mark a PR approved or merged until the GitHub record and the student's authorization show it.
- Keep review evidence for each Lab 3 Issue current while work is fresh rather than reconstructing it at release.
