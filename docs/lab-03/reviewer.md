# Lab 3 - Peer Review Record

**Author:** Ashira Sansoda (student ID 67070503445) - [@osizk](https://github.com/osizk)

**Peer reviewer:** Thira Rungruangkaset (student ID 67070503419) - [@HolyThiccDaddy](https://github.com/HolyThiccDaddy)

## Pull Requests I authored (reviewed by my partner)

| PR | Branch | Merge commit | Reviewer verdict |
|---|---|---|---|
| [#43](https://github.com/osizk/TokTickIT/pull/43) | `feature/13-Lab3Contract` | `dceb6f3` | Contract PR merged into `lab3-staging`; retain the GitHub review timeline as the formal review evidence. |
| [#44](https://github.com/osizk/TokTickIT/pull/44) | `feature/14-Lab3AuthFoundation` | Pending | Issue #34 authentication foundation PR is open into `lab3-staging`; formal review and approval are pending. |
| [#45](https://github.com/osizk/TokTickIT/pull/45) | `feature/15-Lab3RequesterAuthRegression` | Pending | Issue #35 Requester continuity PR received six actionable review comments; the latest stale-restore and role-route fixes are being verified before requesting re-review. |
| [#46](https://github.com/osizk/TokTickIT/pull/46) | `feature/16-Lab3StaffQueue` | Pending | Issue #36 Staff Queue PR received one P1 comment about the required Open-detail target; the read-only staff detail route/page and regressions are addressed locally, with commit/push/re-review pending. |

**Reviewer verdict:** [PR #43](https://github.com/osizk/TokTickIT/pull/43) contains the Issue #33 contract and is merged into `lab3-staging`. The GitHub review timeline remains the source of truth for whether the review was a formal **Approve** or comment-only feedback.

**My response:** I requested review after completing the six contract documents and their traceability checks. I will record the actual comment, requested changes, response, review state, and merge commit here; I will not claim approval in advance.

## Pull Requests I reviewed for my partner

| PR | Branch | Merge commit | My review verdict |
|---|---|---|---|
| Pending | Pending | Pending | No Lab 3 partner PR has been recorded yet. |

**My review verdict:** There is no Lab 3 partner PR to review yet. The Lab 2 partner reviews remain in `docs/lab-02/reviewer.md` and are not repeated here.

**Partner's response:** Pending a real Lab 3 PR and response. When available, record the partner's PR link, comments given and received, requested changes, response links, and whether the review was a formal GitHub **Approve** or a comment-only review.

## Issue #34 review status

| PR | Branch | Review status | Response/evidence |
|---|---|---|---|
| [#44](https://github.com/osizk/TokTickIT/pull/44) | `feature/14-Lab3AuthFoundation` | Pending teammate review | The PR documents the authentication foundation scope and passing tests. No formal **Approve** review or merge has been claimed yet. |

### Inline review comments and responses

| Reviewer comment | Student response and verification | Status |
|---|---|---|
| [P1 — backfill credentials for every migrated Requester](https://github.com/osizk/TokTickIT/pull/44#discussion_r4017577594): the migration/seed path must include non-fixture Lab 2 Requesters and preserve Ticket/Attachment ownership. | Updated the seed to derive credential backfill from every `Requester` row instead of only the five fixtures. Added a disposable-test integration case that creates a non-fixture Requester with a Ticket and Attachment, runs the idempotent seed, and verifies the User ID, credential state, Ticket requester ID, and Attachment ticket link remain correct. | Addressed in [commit `38aa06a`](https://github.com/osizk/TokTickIT/commit/38aa06a), pushed to PR #44; awaiting re-review. |
| [P2 — refresh Issue #34 evidence](https://github.com/osizk/TokTickIT/pull/44#discussion_r4017589762): stale test counts and missing explicit idle/absolute-expiry and wrong-CSRF regression evidence. | Updated `tests.md` to the current counts and added API regressions for wrong CSRF plus idle and absolute expiry. The focused Lab 3 suite now passes 7 files/25 tests; the full server suite passes 19 files/65 tests; the server build also passes. | Addressed in [commit `38aa06a`](https://github.com/osizk/TokTickIT/commit/38aa06a), pushed to PR #44; awaiting re-review. |

**Reviewer verdict:** The two inline comments are actionable and have been addressed in pushed commit `38aa06a`. PR #44 still has comment-only review events; no formal GitHub **Approve** has been claimed.

**My review verdict:** I accepted both corrections because they protect real migration data and make the Issue #34 evidence match the tests actually executed. The changes remain within the authentication foundation scope; Requester/staff/admin product workflows remain deferred to their planned Issues. A new review should be requested for the pushed commit.

## Issue #35 review status

| PR | Branch | Review status | Response/evidence |
|---|---|---|---|
| [#45](https://github.com/osizk/TokTickIT/pull/45) | `feature/15-Lab3RequesterAuthRegression` | Changes requested by partner; fixes in progress | The partner identified six findings: failed-logout handling, post-session-expiry `401` routing, resolution terminal-status coverage, direct `/change-password` guarding, stale initial session restoration, and missing Staff/Admin role-route guards. The findings are within Issue #35 and are being addressed with failing-first client regressions. |

### Partner comments and student responses

| Partner comment | Student response and verification | Status |
|---|---|---|
| Logout failures must not clear the authenticated UI and must provide retry. | Updated the API client to throw on failed logout responses and the shell to preserve the workspace with a retryable error. Added a UI regression covering a failed attempt followed by a successful retry. | Addressed locally; focused test passes. |
| Protected `401 SESSION_REQUIRED` responses must redirect to Login after session restoration. | Added a shared API-to-App session-expiry handler and a regression where the Ticket list returns `401` after sign-in. | Addressed locally; focused test passes. |
| Resolution indication must reject the deterministic terminal statuses. | Defined `CLOSED` and `CANCELLED` as the only terminal statuses for this indication, aligned the specification/API contract, and added unit coverage. | Addressed locally; focused test passes. |
| Direct `/change-password` access must be guarded when unauthenticated. | Added `/change-password` to the protected route predicate and a direct-access regression. | Addressed locally; focused test passes. |
| [P1 — slow initial session restore](https://github.com/osizk/TokTickIT/pull/45#discussion_r4028034803) must not overwrite a successful Login or trigger stale session-expiry handling. | Added an auth-generation guard, ignored stale restore results after Login/logout/session expiry, suppressed the initial restore's stale `401` notification, and added a delayed-response regression. | Addressed locally; focused suite passes 10 tests; not yet committed or pushed. |
| [P2 — role landing routes](https://github.com/osizk/TokTickIT/pull/45#discussion_r4028067621) `/staff/tickets`, `/staff/tickets/:ticketNumber`, and `/admin/users` must redirect to Login when unauthenticated. | Added all role landing routes to the protected-path predicate and a parameterized direct-access regression for each route. | Addressed locally; focused suite passes 10 tests; not yet committed or pushed. |

**Reviewer verdict:** All six comments are actionable and within Issue #35. Re-review is requested only after the latest fixes are committed and pushed; no approval is claimed yet.

**My review verdict:** I accepted all six findings. They address real authentication continuity, route protection, and contract determinism rather than optional polish. The focused and complete client test/build results are recorded in `tests.md`; full authenticated Requester E2E remains a later release gate.

## Issue #36 review status

| PR | Branch | Review status | Response/evidence |
|---|---|---|---|
| [#46](https://github.com/osizk/TokTickIT/pull/46) | `feature/16-Lab3StaffQueue` | Comment addressed locally; commit/push/re-review pending | The partner identified one P1: the Queue Open action linked to an unimplemented staff detail route and a staff session could not use the Requester-only detail API. The correction adds a protected read-only staff detail target while leaving Staff Ticket Operations for Issue #37. |

### Partner comments and student responses

| Partner comment | Student response and verification | Status |
|---|---|---|
| [P1 — Queue Open action must load staff detail](https://github.com/osizk/TokTickIT/pull/46#issuecomment-5702855591): `/staff/tickets/:ticketNumber` fell through to “Access not available”, and the existing Requester detail endpoint rejected staff sessions. | Added `GET /api/staff/tickets/:ticketNumber` with exact StaffTicket serialization and safe `401`/`403`/`404`/`500` behavior, added the read-only `StaffTicketDetail` route/page, and added API/UI regressions for staff success, missing Ticket, Requester denial, unauthenticated access, and Open navigation. | Addressed locally; the focused server suite passes 6 tests, the focused client suite passes 5 tests, complete client tests pass 9 files/41 tests, and both builds pass. Commit/push/re-review remain pending authorization. |

**Reviewer verdict:** The P1 comment identifies a real FR-09/AC-11 Open-action gap. The fix is ready for re-review only after the changed files are committed and pushed; no formal GitHub **Approve** has been claimed.

**My review verdict:** I accepted the finding because the approved Queue contract requires a usable Open action. I implemented only the read-only staff detail target needed by Issue #36 and kept assignment, status, comments, notes, and Attachment operations in the planned Issue #37 scope.

## Review evidence rules

- Record the exact PR, branch, Issue, review, response, and merge links after they exist.
- Distinguish a formal GitHub **Approve** from an issue comment or general conversation.
- Do not mark a PR approved or merged until the GitHub record and the student's authorization show it.
- Keep review evidence for each Lab 3 Issue current while work is fresh rather than reconstructing it at release.
