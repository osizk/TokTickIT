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

1. **Lab sheet summary and plan:** Asking the agent to read the actual lab sheet made the answer more accurate because it could organize the work around the four Issues and their acceptance criteria. This gave me a clear order for the implementation instead of starting the code without understanding the full lab.

2. **Issue 2 health check:** Including every acceptance criterion made the prompt better because the agent knew it needed to implement the backend endpoint, frontend API call, error message, and Supertest coverage. I still checked the endpoint and UI myself to confirm that the result matched what the lab required.

3. **HTTP 304 problem:** Giving the exact status code and explaining when it appeared helped the agent focus on browser caching instead of changing unrelated API code. The fix also added a regression test, which taught me that a bug fix should include a test that prevents the same problem from returning.

4. **Issue 3 Prisma category model:** Naming the required fields, category values, migration, and idempotent seed made the prompt specific enough to produce the correct database changes. I learned that using `upsert` allows the seed to run multiple times without creating duplicate categories.

5. **Prisma and PostgreSQL errors:** Copying the full error messages into the prompt was important because authentication failure, a missing database, and a missing `DATABASE_URL` are different problems. I had to work through the local PostgreSQL permissions and credentials rather than accepting every first suggestion from the agent.

6. **Issue 4 category API and UI:** Supplying both backend and frontend acceptance criteria helped the agent connect the Prisma query, Express route, React states, and automated tests. I corrected the loading-state test when a general text query matched `Loading...` in two places and changed it to check the status region specifically.

7. **Category loading error:** Sharing the exact error response and describing that it happened in the running application helped identify the difference between code that passes tests and a server process using the wrong environment. Restarting the backend after adding runtime `.env` loading was necessary before the fix could be verified.

8. **Verification, cleanup, and commits:** Asking the agent to check tests, builds, Git status, generated files, and credentials made the final verification more reliable. I learned to inspect the staged files before committing so generated JavaScript and secret `.env` values are not accidentally included.
