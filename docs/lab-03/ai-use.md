# Lab 3 - AI Use and Reflection

**LLM/agent used:** OpenAI Codex coding agent (GPT-5-family model exposed by the Codex workspace)

The table records real prompts used while planning and implementing Lab 3. It is intentionally limited to prompts that materially changed the Lab 3 plan, implementation, or workflow. The final personal reflection will be written after implementation and verification; it will not be reconstructed from memory.

## Selected key prompts

| # | Prompt | Purpose | What the AI suggested | Student decision/correction | Verification |
|---|---|---|---|---|---|
| 1 | “Now time for Lab 3; read it carefully and deeply understand it, then make `PLAN_LAB3.md` in `docs/lab-03`.” | Start Lab 3 planning from the labsheet and repository context. | Read the Lab 3 PDF and repository baseline, then proposed a contract-first plan with scope, roles, migration, APIs, UI, tests, evidence, and staged Issues. | Accepted the contract-first structure and reviewed the proposed authentication, staff, and admin scope against the labsheet before implementation. | The resulting plan was inspected in `docs/lab-03/PLAN_LAB3.md`; the PDF headings, exclusions, and evidence requirements were cross-checked. |
| 2 | “Let start do Issue 33 by preparing the contract documents on the current Lab 3 branch.” | Begin the documentation-only contract Issue without jumping to product code. | Checked the current branch/baseline, ran the required-file red-phase check, and drafted `specification.md`, `api-spec.md`, `ui-spec.md`, and the living evidence documents. | Accepted the Issue #33 scope and kept Git/PR/Project mutations out of this turn. | The expected failing guard was observed before the six contract files existed. The new documents were then inspected for FR/BR/AC/Test traceability, exclusions, and secret-safe wording. |
| 3 | “Finished merging the Lab 3 contract; start Issue #34 authentication foundation from the latest `lab3-staging`, using the approved branch and failing-first workflow.” | Start the next implementation Issue only after the contract merge and begin with planned authentication tests. | Created `feature/14-Lab3AuthFoundation` from the merged staging baseline, ran the planned missing-module red phase, then implemented validation, session-security primitives, additive auth schema/migration, seed safeguards, and initial auth API routes. | Accepted the bounded Issue #34 foundation scope, preserved Lab 2 routes for later authenticated ownership migration, and did not commit, push, or open a PR. | The red-phase failure was recorded in `tests.md`; focused Lab 3 tests (22/22), full server regression (62/62), server build, disposable migration, two seed runs, seeded login, and credential-preservation checks passed. Client and later feature Issues remain deferred. |
| 4 | “Read the inline comments on PR #44, determine which findings belong to Issue #34, fix them without expanding later Issue scope, rerun the affected tests, and prepare the same branch for review.” | Review the actual PR feedback and correct only the migration/seed and Issue #34 evidence gaps. | Fetched both inline comments, changed credential backfill to cover every legacy Requester, added a non-fixture Ticket/Attachment ownership regression, added wrong-CSRF and idle/absolute-expiry API regressions, and refreshed the evidence counts. | Accepted both findings as in-scope corrections; kept later authenticated Requester, staff, admin, UI, and E2E work deferred. No merge or approval was claimed. | Focused Lab 3 tests passed 7 files/25 tests; full server regression passed 19 files/65 tests; server build, disposable migration, and two repeated seed runs passed. |

## Verification and human decisions

- The assistant's proposed session, CSRF, password, migration, role, queue, status-transition, and User Management decisions remain explicitly marked as contract decisions in `specification.md`; implementation must not silently expand them.
- The student retained authority over branch creation, commits, pushes, PRs, reviews, Project status, and merges. Issue #34 implementation work is limited to this local feature branch; commit, push, PR, review, Project, and merge mutations remain separately authorized actions.
- Remaining planned test IDs and paths in `tests.md` are not claimed as passing. They will be replaced or confirmed with actual paths and complete output as each Issue is implemented.
- The real failing-first output is preserved in `tests.md`; no successful result is inferred merely from document creation.

## Reflection

To be completed by the student after Lab 3 implementation and final evidence review. The reflection must explain what was learned, what AI suggestions were accepted or rejected, how outputs were verified, and why human judgment was necessary.
