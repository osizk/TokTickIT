# Lab 2 - AI Use and Reflection

**LLM/agent used:** OpenAI Codex, based on GPT-5.

## Selected key prompts

The prompts below are concise summaries of prompts used during this work.

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Read every file in `docs/lab-02` and plan Lab 2 without changing other files. | Reviewed the labsheet and repository baseline, identified missing Lab 2 models/APIs/UI, and checked which decisions needed approval. |
| 2 | Review the Lab 2 specification feedback about adding a database-design reason and exact model field types and relations. | Added the `TicketCounter`/soft-removal rationale and exact Prisma model contract, then checked the specification diff against the approved requirements. |
| 3 | Edit `specification.md` with the requested database rationale and model details, keeping the change limited to that document. | Updated the specification, aligned `updatedAt` defaults with the migration, and verified formatting before the local commit. |
| 4 | Implement Issue #13 Data/reference APIs from the latest `lab2-staging`; keep `PLAN_LAB2.md` private/ignored and do not commit, push, or change GitHub Project status. | Created `feature/lab2-data-reference`, wrote the failing tests first, added the schema/migration/seed/reference routes and safe errors, updated living evidence, and verified Prisma validation, migration, repeated seed, 8 server tests, build, and `git diff --check`. |
| 5 | Proceed with the next Lab 2 issue, warn me about any branch-name conflict, use Issue #14's `feature/7-Lab2RequesterContext` name, and number the future feature branches in the private plan. | Checked the Issue/plan mismatch, updated the ignored plan's numbered branch list, created the new branch from the latest `lab2-staging`, wrote the requester-context tests first, implemented the selection and route shell, and verified the failing baseline followed by 11 passing client tests and a production build. |
| 6 | “Let do next issue (15)” — continue the planned Ticket-creation issue on its numbered branch, with tests first and no commit or push without authorization. | Created the Issue #15 failing server/client tests, implemented strict field/file validation, one multipart create request, annual counter allocation, protected UUID storage, database/filesystem compensation, and the Create Ticket form. Verified the result with focused tests, 19 server regression tests, 17 client regression tests, and both production builds. |
| 7 | Let do Issue 16 (My Tickets) from the approved Lab 2 plan; use its numbered branch, write the failing tests first, and keep the work local until I authorize commit or push. | Created the My Tickets API/UI tests first, implemented owned search/filter/sort/pagination with requester isolation, URL-synchronized controls, responsive table/cards, and safe empty/error states. Corrected pathname/query routing and a regression-test fixture, then verified focused tests, full server/client regressions, and both production builds. |

## Reflection

