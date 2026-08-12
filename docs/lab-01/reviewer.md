# Lab 1 - Peer Review Record

**Author:** Name: Ashira Sansoda and student ID: 67070503445 GitHub: [@osizk](https://github.com/osizk)

**Peer reviewer:** Name: Thira Rungruangkaset and student ID: 67070503419 GitHub: [@HolyThiccDaddy](https://github.com/HolyThiccDaddy)

## Pull Requests I authored (reviewed by my partner)

GitHub shows that all four pull requests were authored by `@osizk`, reviewed by `@HolyThiccDaddy`, and merged into `lab1-staging`.

| PR | Branch | Merge commit | Reviewer verdict |
|----|--------|--------------|------------------|
| [#5](https://github.com/osizk/TokTickIT/pull/5) | `feature/1-project-foundation-` | `a76506c` | Passed. [Reviewer comment](https://github.com/osizk/TokTickIT/pull/5#issuecomment-5253342201): "You are doing good lil bro. Pass." |
| [#6](https://github.com/osizk/TokTickIT/pull/6) | `feature/2-health-check` | `91347e8` | Passed. [Reviewer comment](https://github.com/osizk/TokTickIT/pull/6#issuecomment-5255396039): the code was reviewed and the PR was approved for merging. |
| [#7](https://github.com/osizk/TokTickIT/pull/7) | `feature/3-catogory-seed` | `a77b701` | Positive review. [Reviewer comment](https://github.com/osizk/TokTickIT/pull/7#issuecomment-5263129746): "Good job so far. Nicely done!" |
| [#8](https://github.com/osizk/TokTickIT/pull/8) | `feature/4-category-list` | `f839442` | Passed. [Reviewer comment](https://github.com/osizk/TokTickIT/pull/8#issuecomment-5264244317): the Issue 4 flow, Prisma work, and UI were approved for merging. |

> Note: GitHub uses the spelling `feature/3-catogory-seed`; the lab sheet spells the branch `feature/3-category-seed`.

**Reviewer comment received:** The comments and verdicts are recorded in the table above. The reviewer approved each PR, with the final Issue 4 comment explicitly giving it a pass.

**How I responded:** No separate author response is visible in the GitHub PR timelines. The reviewed pull requests were merged after the reviewer comments.

## Pull Requests I reviewed for my partner

Partner repository: [HolyThiccDaddy/toktickit](https://github.com/HolyThiccDaddy/toktickit/tree/lab1-staging)

| PR | Branch | Base and result | My review comment | Partner response |
|----|--------|-----------------|-------------------|------------------|
| [#5](https://github.com/HolyThiccDaddy/toktickit/pull/5) | `feature/1-project-foundation` | `lab1-staging`; merged as `6c85940` | "Everything looks great." | No separate response was recorded. |
| [#6](https://github.com/HolyThiccDaddy/toktickit/pull/6) | `feature/2-health-check` | `main`; closed without merging | I confirmed the health endpoint matched Issue 2 and suggested removing unused catch variables. I also identified that the PR targeted the wrong branch. | The partner replied, "Thanks for the help. Ashira." |
| [#7](https://github.com/HolyThiccDaddy/toktickit/pull/7) | `feature/3-category-seed` | `main`; closed without merging | I noted that the PR targeted the wrong branch. | No separate response was recorded. |
| [#8](https://github.com/HolyThiccDaddy/toktickit/pull/8) | `feature/2-health-check` | `lab1-staging`; merged as `640f439` | I confirmed the health endpoint matched Issue 2 and left small cleanup comments. | The partner explained that the unused variable might be kept for future use and replied, "Thanks." |
| [#9](https://github.com/HolyThiccDaddy/toktickit/pull/9) | `feature/3-category-seed` | `lab1-staging`; merged as `0d38d35` | I asked for Issue 4 changes to be separated from the Issue 3 PR. After the update, I confirmed that the Issue 4 implementation was removed and the Issue 3 Prisma, migration, and seed work looked good. | The partner said they would make the requested change and ask for another review. |
| [#10](https://github.com/HolyThiccDaddy/toktickit/pull/10) | `feature/4-category-list` | `lab1-staging`; merged as `7d6dc9d` | "Everything looks good, you can merge now." | No separate response was recorded. |

**My review comment:** I found two wrong-base PRs (#6 and #7) and asked for Issue 4 work to be separated from Issue 3 in #9. The partner corrected the branch/base and scope problems in the later PRs.

**Partner's response:** The partner acknowledged the feedback, corrected the branch and scope issues, and submitted the corrected PRs (#8, #9, and #10).
