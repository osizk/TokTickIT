# Lab 3 - AI Use and Reflection

**LLM/agent used:** OpenAI Codex coding agent (GPT-5-family model exposed by the Codex workspace)

The table records real prompts used while planning and beginning Issue #33. It is intentionally limited to prompts that materially changed the Lab 3 plan or workflow. The final personal reflection will be written after implementation and verification; it will not be reconstructed from memory.

## Selected key prompts

| # | Prompt | Purpose | What the AI suggested | Student decision/correction | Verification |
|---|---|---|---|---|---|
| 1 | “Now time for Lab 3; read it carefully and deeply understand it, then make `PLAN_LAB3.md` in `docs/lab-03`.” | Start Lab 3 planning from the labsheet and repository context. | Read the Lab 3 PDF and repository baseline, then proposed a contract-first plan with scope, roles, migration, APIs, UI, tests, evidence, and staged Issues. | Accepted the contract-first structure and reviewed the proposed authentication, staff, and admin scope against the labsheet before implementation. | The resulting plan was inspected in `docs/lab-03/PLAN_LAB3.md`; the PDF headings, exclusions, and evidence requirements were cross-checked. |
| 2 | “Let start do Issue 33 by preparing the contract documents on the current Lab 3 branch.” | Begin the documentation-only contract Issue without jumping to product code. | Checked the current branch/baseline, ran the required-file red-phase check, and drafted `specification.md`, `api-spec.md`, `ui-spec.md`, and the living evidence documents. | Accepted the Issue #33 scope and kept Git/PR/Project mutations out of this turn. | The expected failing guard was observed before the six contract files existed. The new documents were then inspected for FR/BR/AC/Test traceability, exclusions, and secret-safe wording. |

## Verification and human decisions

- The assistant's proposed session, CSRF, password, migration, role, queue, status-transition, and User Management decisions remain explicitly marked as contract decisions in `specification.md`; implementation must not silently expand them.
- The student retained authority over branch creation, commits, pushes, PRs, reviews, Project status, and merges. Issue creation was separately authorized; Issue #33 implementation mutations are not yet authorized.
- Planned test IDs and paths in `tests.md` are not claimed as passing. They will be replaced or confirmed with actual paths and complete output as each Issue is implemented.
- The real failing-first output is preserved in `tests.md`; no successful result is inferred merely from document creation.

## Reflection

To be completed by the student after Lab 3 implementation and final evidence review. The reflection must explain what was learned, what AI suggestions were accepted or rejected, how outputs were verified, and why human judgment was necessary.
