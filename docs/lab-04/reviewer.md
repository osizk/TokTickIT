# Lab 4 Peer Review

Author: Ashira Sansoda (67070503445), [osizk](https://github.com/osizk). Repository: [osizk/TokTickIT](https://github.com/osizk/TokTickIT).

Peer reviewer: Thira Rungruangkaset (67070503419), [HolyThiccDaddy](https://github.com/HolyThiccDaddy). Partner repository: [HolyThiccDaddy/toktickit](https://github.com/HolyThiccDaddy/toktickit).

## Pull Requests reviewed by my partner

| PR | Branch and merge evidence | Reviewer feedback | My response | Final review record |
| --- | --- | --- | --- | --- |
| [PR #63](https://github.com/osizk/TokTickIT/pull/63) — Issue #55 contract | `feature/21-Lab4Contract` → `lab4-staging`; corrected contract commit `b9ebdc224e6ab823c56f6ef944d25eecfd9ced54`; merged by `5cb5b31eaa0603673cef142d6082660c6a100459` | Friend's review comments identified the broken local labsheet link, baseline-vs-reviewed-SHA evidence, `.gitignore` scope mismatch, and missing Lab 2 authenticated E2E continuity mapping. | Removed the PDF hyperlink, reproduced the committed-link failure, strengthened the SHA-aware check, mapped retained flows/gaps, and clarified retained ignore housekeeping in the PR description. The student reports that the friend accepted the corrections by comment and explicitly considers that sufficient to proceed. | Merged into `lab4-staging` at `5cb5b31`. This was comment-based sign-off, not a formal GitHub **Approve** review; no formal Approve is claimed. |
| [PR #65](https://github.com/osizk/TokTickIT/pull/65) — Issue #57 Actions Taken UI | `feature/23-Lab4ActionsUI` → `lab4-staging`; client code/tests were verified on `9d26bfdcfd3cc19218fa0e37727d4e37e554b431`; merged PR head `06caef6136b9d21b2ad1ff32fe140b03ef16d7f4`; merge commit `aa4f51ac178433b89a14dcd33f2be425e45bdad0`. | Partner confirmed the functional fixes and requested SHA-bound test evidence; follow-up reviews requested accurate distinction between the tested code SHA and PR head. | Reran the full client suite (15 files/85 tests) and production build on `9d26bfd`; recorded that tested SHA separately from later documentation-only commits in `tests.md`. | Partner submitted formal **Approve** on 11 October 2026; PR #65 was subsequently merged into `lab4-staging` at `aa4f51a`. |
| [PR #66](https://github.com/osizk/TokTickIT/pull/66) — Issue #58 Ticket workflow | `feature/24-Lab4TicketWorkflow` → `lab4-staging`. | No partner review or comments were submitted before it was closed. | Closed unmerged after discovering it was opened through the wrong GitHub account; the branch work was retained. | Closed unmerged; no review, **Approve**, or merge is claimed. |
| [PR #67](https://github.com/osizk/TokTickIT/pull/67) — Issue #58 Ticket workflow | `feature/24-Lab4TicketWorkflow` → `lab4-staging`; remote implementation commit `a83f77b194fe5880e90142984b075750a5e3c495`, evidence follow-up `b8e2fb3`. | Partner submitted **Changes requested** on 11 October 2026: reset history pagination on Ticket change and display timestamps in `Asia/Bangkok`. | Implemented both corrections and added regressions; focused/full client tests and client build passed before the follow-up commit. Re-review has not yet been requested. | Open; the review requested changes on prior remote head `b8e2fb3`; no subsequent **Approve** or merge is claimed. |

Issue #58 is tracked above. Dependency PR #65 was formally approved and merged into `lab4-staging` at `aa4f51a`. Feedback above distinguishes comment-only feedback from formal GitHub **Approve** reviews. Retain one row per PR.

**Reviewer verdict:** PR #63 was merged after student-accepted comment sign-off; no formal **Approve** is claimed. PR #65 received a teammate **Approve** and was merged. The current Issue #58 PR has a **Changes requested** review; it has not been approved or merged.

**My response:** For PR #63, I accepted the reproducibility and coverage corrections and retained the small Lab 3 draft-ignore entry as disclosed housekeeping; its sign-off was comment-based. For PR #65, I corrected the SHA-bound evidence and reviewer record before the partner approved it. For Issue #58, I corrected the PR author account and addressed the two requested UI fixes on the PR branch; browser/E2E evidence remains planned for Issue #61 rather than claimed as complete here.

## Pull Requests I reviewed for my partner

| PR | Branch and merge evidence | My review verdict | Partner response and final result |
| --- | --- | --- | --- |

No PR review by the student of a partner's Lab 4 PR is recorded yet. Link only actual relevant partner PRs and real feedback/responses; their PR numbers need not match this repository. Do not import older-lab PRs to fill this table.

**My review verdict:** Pending an actual review of the partner's Lab 4 work.

**Partner response:** The partner requested changes on the current Issue #58 PR; no subsequent response, **Approve**, or merge is claimed yet.
