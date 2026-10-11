# Lab 4 Peer Review

Author: Ashira Sansoda (67070503445), [osizk](https://github.com/osizk). Repository: [osizk/TokTickIT](https://github.com/osizk/TokTickIT).

Peer reviewer: Thira Rungruangkaset (67070503419), [HolyThiccDaddy](https://github.com/HolyThiccDaddy). Partner repository: [HolyThiccDaddy/toktickit](https://github.com/HolyThiccDaddy/toktickit).

## Pull Requests reviewed by my partner

| PR | Branch and merge evidence | Reviewer feedback | My response | Final review record |
| --- | --- | --- | --- | --- |
| [PR #63](https://github.com/osizk/TokTickIT/pull/63) — Issue #55 contract | `feature/21-Lab4Contract` → `lab4-staging`; corrected contract commit `b9ebdc224e6ab823c56f6ef944d25eecfd9ced54`; merged by `5cb5b31eaa0603673cef142d6082660c6a100459` | Friend's review comments identified the broken local labsheet link, baseline-vs-reviewed-SHA evidence, `.gitignore` scope mismatch, and missing Lab 2 authenticated E2E continuity mapping. | Removed the PDF hyperlink, reproduced the committed-link failure, strengthened the SHA-aware check, mapped retained flows/gaps, and clarified retained ignore housekeeping in the PR description. The student reports that the friend accepted the corrections by comment and explicitly considers that sufficient to proceed. | Merged into `lab4-staging` at `5cb5b31`. This was comment-based sign-off, not a formal GitHub **Approve** review; no formal Approve is claimed. |
| [PR #65](https://github.com/osizk/TokTickIT/pull/65) — Issue #57 Actions Taken UI | `feature/23-Lab4ActionsUI` → `lab4-staging`; client code/tests were verified on `9d26bfdcfd3cc19218fa0e37727d4e37e554b431`; merged PR head `06caef6136b9d21b2ad1ff32fe140b03ef16d7f4`; merge commit `aa4f51ac178433b89a14dcd33f2be425e45bdad0`. | Partner confirmed the functional fixes and requested SHA-bound test evidence; follow-up reviews requested accurate distinction between the tested code SHA and PR head. | Reran the full client suite (15 files/85 tests) and production build on `9d26bfd`; recorded that tested SHA separately from later documentation-only commits in `tests.md`. | Partner submitted formal **Approve** on 11 October 2026; PR #65 was subsequently merged into `lab4-staging` at `aa4f51a`. |
| [PR #66](https://github.com/osizk/TokTickIT/pull/66) — Issue #58 Ticket workflow | `feature/24-Lab4TicketWorkflow` → `lab4-staging`; tested implementation commit `a83f77b194fe5880e90142984b075750a5e3c495`; evidence-only follow-up is included on the same PR branch. | Awaiting partner review; no feedback received at initial PR creation. | Opened after the full server/client suites and builds passed on the tested implementation commit; the later documentation update adds commit-bound results and PR evidence. | Open; no review, **Approve**, or merge is claimed. |

Current work is [Issue #58](https://github.com/osizk/TokTickIT/issues/58), submitted as [PR #66](https://github.com/osizk/TokTickIT/pull/66) from `feature/24-Lab4TicketWorkflow` into `lab4-staging`. Dependency PR #65 was formally approved and merged into `lab4-staging` at `aa4f51a`. Feedback above distinguishes comment-only feedback from formal GitHub **Approve** reviews. Retain one row per PR.

**Reviewer verdict:** PR #63 was merged after student-accepted comment sign-off; no formal **Approve** is claimed. PR #65 received a teammate **Approve** and was merged. PR #66 is open and awaiting teammate review; no approval or merge is claimed.

**My response:** For PR #63, I accepted the reproducibility and coverage corrections and retained the small Lab 3 draft-ignore entry as disclosed housekeeping; its sign-off was comment-based. For PR #65, I corrected the SHA-bound evidence and reviewer record before the partner approved it. PR #66 is now submitted and awaits review; browser/E2E evidence remains planned for Issue #61 rather than claimed as complete here.

## Pull Requests I reviewed for my partner

| PR | Branch and merge evidence | My review verdict | Partner response and final result |
| --- | --- | --- | --- |

No PR review by the student of a partner's Lab 4 PR is recorded yet. Link only actual relevant partner PRs and real feedback/responses; their PR numbers need not match this repository. Do not import older-lab PRs to fill this table.

**My review verdict:** Pending an actual review of the partner's Lab 4 work.

**Partner response:** PR #66 is awaiting review; no response/Approve/merge is claimed.
