# Lab 2 - AI Use and Reflection

**LLM/agent used:** OpenAI Codex, based on GPT-5.

## Selected key prompts

The prompts below are concise summaries of prompts used during this work.

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Read every file in `docs/lab-02` and plan Lab 2 without changing other files. | Reviewed the labsheet and repository baseline, identified missing Lab 2 models/APIs/UI, and checked which decisions needed approval. |
| 2 | Read `docs/lab-02/PLAN_LAB2.md` and start without committing or pushing. | Confirmed the current `feature/5-Lab2Contract` branch, found the contract files missing, and began Issue 1 with documentation only. |
| 3 | Review the Lab 2 specification feedback about adding a database-design reason and exact model field types and relations. | Added the `TicketCounter`/soft-removal rationale and exact Prisma model contract, then checked the specification diff against the approved requirements. |
| 4 | Edit `specification.md` with the requested database rationale and model details, keeping the change limited to that document. | Updated the specification, aligned `updatedAt` defaults with the migration, and verified formatting before the local commit. |
| 5 | Create a local commit for the reviewed specification update without pushing it. | Created commit `a644340` with only `specification.md`, then verified that no push occurred and the working tree was clean. |
| 6 | Implement Issue #13 Data/reference APIs from the latest `lab2-staging`; keep `PLAN_LAB2.md` private/ignored and do not commit, push, or change GitHub Project status. | Created `feature/lab2-data-reference`, wrote the failing tests first, added the schema/migration/seed/reference routes and safe errors, updated living evidence, and verified Prisma validation, migration, repeated seed, 8 server tests, build, and `git diff --check`. |

## Reflection

