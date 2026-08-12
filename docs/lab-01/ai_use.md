# Lab 1 - AI Use and Reflection

**LLM/agent used:** OpenAI Codex, based on GPT-5.

## Selected key prompts

The prompts below are concise summaries of prompts used during this work.

| # | Prompt (summarised) | What I did with the result |
|---|---------------------|----------------------------|
| 1 | Read `Lab1_Labsheet.pdf` and summarize the requirements and implementation plan. | Reviewed the Lab 1 goal, four Issues, acceptance criteria, workflow, and submission evidence. |
| 2 | Implement Issue 2 using the supplied health-check acceptance criteria. | Implemented the health endpoint, frontend health request, UI states, and automated tests; then reviewed the diff and build output. |
| 3 | Investigate why the health endpoint returned HTTP 304. | Added no-cache behavior and a regression test proving conditional health requests still return HTTP 200. |
| 4 | Implement Issue 3: Prisma `Category`, migration, and idempotent seed. | Added the model, migration, and `upsert` seed; ran validation, migration checks, and the seed twice. |
| 5 | Diagnose Prisma authentication, database, and environment-variable errors. | Corrected the local database configuration workflow, changed migration usage to `migrate deploy`, and fixed the seed script so Prisma loads `.env`. |
| 6 | Implement Issue 4 using the category API and UI acceptance criteria. | Added the Prisma-backed endpoint, React category rendering, loading/error handling, Supertest coverage, and Vitest coverage. |
| 7 | Diagnose the frontend's `Unable to load request categories` response. | Identified that the running server was an old process without runtime `.env` loading, added `dotenv`, restarted a fresh server, and verified HTTP 200 with four categories. |
| 8 | Verify each Issue, clean generated artifacts, and commit only intended files. | Ran tests/builds, added `noEmit`, checked Git status, and created focused commits without committing credentials or generated files. |

## Reflection

Prompts were better when I included the exact acceptance criteria, named the files and constraints, and asked the agent to run tests and verify the result instead of only asking it to "do issue x". I had to correct the first loading-state test because `getByText("Loading...")` matched both the button and the status paragraph, so I changed it to target the element with `role="status"`. This showed me that AI can implement quickly, but I still need to inspect the rendered UI and understand the test failures myself.
