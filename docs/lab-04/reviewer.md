# Lab 4 Peer Review

Author: Ashira Sansoda (67070503445), [osizk](https://github.com/osizk). Repository: [osizk/TokTickIT](https://github.com/osizk/TokTickIT).

Peer reviewer: Thira Rungruangkaset (67070503419), [HolyThiccDaddy](https://github.com/HolyThiccDaddy). Partner repository: [HolyThiccDaddy/toktickit](https://github.com/HolyThiccDaddy/toktickit).

## Pull Requests reviewed by my partner

| PR | Branch and merge evidence | Reviewer feedback | My response | Final review record |
| --- | --- | --- | --- | --- |
| [PR #63](https://github.com/osizk/TokTickIT/pull/63) — Issue #55 contract | `feature/21-Lab4Contract` → `lab4-staging`; corrected contract commit `b9ebdc224e6ab823c56f6ef944d25eecfd9ced54`; merged by `5cb5b31eaa0603673cef142d6082660c6a100459` | Friend's review comments identified the broken local labsheet link, baseline-vs-reviewed-SHA evidence, `.gitignore` scope mismatch, and missing Lab 2 authenticated E2E continuity mapping. | Removed the PDF hyperlink, reproduced the committed-link failure, strengthened the SHA-aware check, mapped retained flows/gaps, and clarified retained ignore housekeeping in the PR description. The student reports that the friend accepted the corrections by comment and explicitly considers that sufficient to proceed. | Merged into `lab4-staging` at `5cb5b31`. This was comment-based sign-off, not a formal GitHub **Approve** review; no formal Approve is claimed. |
| [PR #65](https://github.com/osizk/TokTickIT/pull/65) — Issue #57 Actions Taken UI | `feature/23-Lab4ActionsUI` → `lab4-staging`; client code/tests were verified on `5480ccbf8902193e081b7c54c2612b1638360ac6`; current pushed PR head is `8ef270c690274c4412504e17bf40f03ca58d70ed` (documentation-only evidence update). | Partner confirmed the functional fixes and requested SHA-bound test evidence. On the next review, the partner confirmed `tests.md` was corrected and asked that this row distinguish the tested code SHA from the current pushed head. | Reran the full client suite (15 files/88 tests) and production build on `5480ccb`; `tests.md` records that exact SHA and its results. This row records the later docs-only head `8ef270c` separately. | The latest GitHub review on `8ef270c` is **Changes requested** for this reviewer-record correction. No subsequent re-review, **Approve**, or merge is claimed; PR #65 remains open. |

Current work is [Issue #57](https://github.com/osizk/TokTickIT/issues/57), submitted as [PR #65](https://github.com/osizk/TokTickIT/pull/65). Its dependency PR #64 was merged into `lab4-staging` by `6cabca6`; its formal review record is not audited here. Feedback above distinguishes student-supplied partner comments from formal GitHub **Approve** reviews. Retain one row per PR.

**Reviewer verdict:** PR #63 was merged after student-accepted comment sign-off; no formal **Approve** is claimed. PR #65's latest review requested an accurate reviewer record distinguishing tested code SHA `5480ccb` from pushed docs-only head `8ef270c`. No later review or formal **Approve** is claimed; PR #65 is not merged.

**My response:** I accepted the reproducibility and coverage corrections. I retained the small Lab 3 draft-ignore entry as housekeeping rather than removing student work; the PR description acknowledges it. The corrected committed-source check passed at `b9ebdc2`. The student accepted comment-based sign-off for this PR; this is distinct from a formal GitHub **Approve**. Authenticated browser gaps remain explicitly planned for Issue #61, not falsely reported passing.

## Pull Requests I reviewed for my partner

| PR | Branch and merge evidence | My review verdict | Partner response and final result |
| --- | --- | --- | --- |

No verified partner Lab 4 review is recorded yet. Link only actual relevant partner PRs and real feedback/responses; their PR numbers need not match this repository. Do not import older-lab PRs to fill this table.

**My review verdict:** Pending an actual review of the partner's Lab 4 work.

**Partner response:** Not recorded yet; no response/Approve/merge is claimed.
