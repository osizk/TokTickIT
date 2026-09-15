# TokTickIT Lab Working Agreement

This file defines how an AI coding agent must work in this repository for every current and future lab. The current lab's labsheet and the student's explicit instructions are authoritative. If this file conflicts with either one, stop, explain the conflict, and follow the labsheet or the student's latest instruction.

In this file:

- `<lab-number>` means the current lab number, such as `3` or `4`.
- `<lab-folder>` means the exact repository folder used by that lab, such as `docs/lab-03`.
- `<lab-staging>` means the approved staging branch for that lab, such as `lab3-staging`.

Determine these values from the labsheet, repository, and student before performing Git or GitHub actions. Do not assume every lab uses the same names or workflow.

## 1. Start by understanding the lab

Before planning or changing anything:

1. Read the entire current labsheet, including the rubric, required evidence, submission format, and appendices.
2. Read every existing file in `<lab-folder>/`.
3. Inspect the repository structure, current branch, `git status`, recent history, existing tests, database schema, and relevant client/server code.
4. Identify the current baseline: what is already merged into `main`, whether `<lab-staging>` exists, and which earlier tests/builds pass.
5. Separate fixed labsheet requirements from decisions the student must make. Do not silently invent unresolved requirements.
6. Report contradictions, missing information, unsafe assumptions, or proposed scope that exceeds the labsheet before implementation.
7. Prepare or revise the current lab plan first. Do not begin product implementation until the engineering contract is approved.

If the student restricts the task to one file, modify only that file. A planning-only task never authorizes product code, GitHub changes, or Git operations.

## 2. Authorization boundaries

Never perform any of these actions unless the student explicitly authorizes that exact action:

- create, rename, or delete a branch;
- stage or commit files;
- push or delete a remote branch;
- create, edit, close, or reopen a GitHub Issue;
- change a GitHub Project card or status;
- open, edit, approve, close, or merge a Pull Request;
- merge into a staging branch or `main`;
- delete or reset database records, uploaded files, migrations, or user work.

Authorization for one action does not imply authorization for another. For example, "commit" does not authorize push or PR creation. Before an authorized commit, show or inspect the exact changed files and exclude unrelated work.

Never develop directly on `main` or `<lab-staging>`. Do not rewrite history, force-push, or use destructive Git commands unless the student explicitly asks and the exact targets have been verified.

## 3. Preserve student work

- Treat every existing modification and untracked file as student-owned unless the agent created it during the current task.
- Never roll back or overwrite the student's version of `ai-use.md`, documentation, screenshots, or code merely because it differs from an earlier agent version.
- If `ai-use.md` changed outside the agent's work, tell the student and preserve it.
- Ignore unrelated dirty-worktree changes and keep the requested diff narrow.
- Use `apply_patch` for repository file edits.
- Do not edit or replace a labsheet PDF.
- Remove only temporary files created by the agent, after verifying their exact paths.

## 4. Engineering contract before implementation

Before product implementation, create and obtain approval for the documents required by the current labsheet. Unless that labsheet specifies different names, use:

- `<lab-folder>/specification.md`
- `<lab-folder>/tests.md`
- `<lab-folder>/ui-spec.md`
- `<lab-folder>/api-spec.md`
- `<lab-folder>/ai-use.md`
- `<lab-folder>/reviewer.md`

The contract must make scope and exclusions explicit and define:

- numbered functional requirements (`FR-*`);
- numbered business rules (`BR-*`);
- numbered acceptance criteria (`AC-*`);
- numbered planned tests (`TEST-*`);
- data models, field types, relations, constraints, indexes, migrations, and at least one design justification;
- API paths, methods, inputs, outputs, status codes, validation, ownership/authorization behavior, and safe errors;
- UI routes, controls, loading/empty/error/success states, validation, accessibility, and responsive behavior;
- a Product Definition of Done and a course-delivery/review Definition of Done;
- an AC-to-Test-ID mapping and the intended test-file path for every automated test.

Do not start an implementation Issue until its contract is approved and its dependencies are integrated.

## 5. Issue and branch planning

Before creating GitHub Issues, show the complete proposed Issue list to the student. Each Issue must have:

- a concise title and bounded scope;
- mapped FR, BR, AC, and Test IDs;
- dependencies and execution order;
- an exact branch name;
- planned failing tests;
- focused and regression verification commands;
- documentation and evidence updates;
- a clear Definition of Done.

Use the branch name written in the approved Issue. The preferred numbered pattern is:

```text
feature/<sequence>-Lab<lab-number><Topic>
```

For a docs-only task without a feature Issue, use the workflow-guide pattern:

```text
docs/lab<lab-number>-<topic>
```

If an Issue name, private plan, labsheet, or proposed branch name conflicts, tell the student before creating the branch. Do not silently normalize spelling or capitalization.

Create every feature branch from the latest approved `<lab-staging>`, never from an older feature branch. Only develop Issues in parallel when the approved dependency plan explicitly permits it. Before integrating a parallel branch, update it from the latest staging branch and rerun integration/regression checks.

## 6. Per-Issue workflow

Follow this workflow for every Issue, subject to exact authorization for each Git/GitHub mutation:

1. Move the Project card from Backlog to Specified.
2. Confirm its mapped FR, BR, AC, and Test IDs.
3. Create the approved branch from the latest `<lab-staging>`.
4. Move the card to Started.
5. Write and run the planned failing tests first. Record why they fail.
6. Implement only the approved Issue scope.
7. Update the relevant living documentation and evidence while the work is fresh.
8. Run focused tests, relevant regressions, builds, and manual checks.
9. Review the diff for unrelated files, secrets, generated files, and accidental evidence changes.
10. Commit only when authorized.
11. Push only when authorized.
12. Open a PR into `<lab-staging>` only when authorized.
13. Move the card to PR Review.
14. Stop and wait for a teammate's actual GitHub **Approve** review unless the current labsheet explicitly permits another form of review.
15. If changes are requested, move the card to Fixing, make the fixes, rerun checks, and request another review.
16. Merge only after approval and explicit student authorization.
17. Move the card to Done only after the approved PR is merged.

Do not begin the next dependent Issue merely because the current PR is open. Wait until the required merge is complete.

## 7. Pull Request conventions

Unless the student specifies another title, use:

```text
Issue #<number>: <approved Issue title>
```

The PR body should include:

- the related Issue number without automatic-closing language;
- scope completed;
- mapped requirements and acceptance criteria;
- tests and builds actually run;
- manual verification performed;
- database/migration or environment notes;
- screenshots/evidence where relevant;
- known limitations or intentionally deferred work.

Do not write `Closes #<number>` or similar automatic-closing text unless the student explicitly requests it. Do not claim an Approve review when there was only a comment.

## 8. Testing rules

- Follow TDD: add the planned failing test, verify the expected failure, implement, then verify it passes.
- Run focused tests first and proportionate regression suites afterward.
- Run server and client builds when relevant.
- Test happy paths, boundaries, invalid inputs, loading, empty, error, retry, duplicate-action prevention, ownership/authorization isolation, responsive layouts, accessibility, and state transitions required by the contract.
- Every automated test must map to at least one acceptance criterion and record its real file path.
- Never check an evidence checkbox unless the check was actually performed and the result was observed.
- Never delete a pending checkbox merely to make the evidence look complete. Complete the check or explain the genuine blocker.
- Do not report a suite as passing when tests were skipped, disabled, flaky, irrelevant, or did not start.
- Preserve complete terminal output required by the labsheet, including the command, tested commit SHA, counts, failures when intentionally demonstrated, and final result.

When explaining manual testing, state exactly where each command belongs:

- PowerShell or terminal commands go in a terminal, not the browser console.
- Browser `fetch(...)`, `sessionStorage`, and DOM checks go in DevTools Console.
- Network request/response evidence comes from DevTools Network.
- Database checks use the documented database client or guarded project script.

## 9. Test database and secret safety

- Use a dedicated, disposable test database. Never run automated integration/E2E cleanup against the development or production database.
- Test configuration must fail closed if the local test environment file is missing or unsafe; never fall back to the development `.env`.
- If the current engineering contract adopts this safety convention, require the test database name to end in `_test` and allow only explicitly approved E2E schemas.
- Use a temporary, protected attachment/storage directory for tests and clean only the test-owned paths.
- Use idempotent seed data and verify repeated seed runs do not create duplicates.
- Commit only a sanitized example environment file such as `.env.test.example` when required.
- Never commit the real `.env.test`, `.env`, database credentials, passwords, secrets, uploaded files, local storage, Playwright reports, or transient test output.
- Before any destructive database or filesystem operation, resolve and show the exact target and obtain explicit authorization when real development data is involved.

## 10. Living evidence documents

Use the most recent accepted lab evidence documents as the formatting template unless the current labsheet provides a new template or the student specifies another one.

### `tests.md`

- Preserve the planned-test table, Issue evidence, AC traceability, actual paths, commands, final results, screenshots, and visual checklist.
- Update it during each Issue, not by reconstructing everything at release time.
- Keep historical failing-test evidence distinguishable from the final passing output.
- Mark items complete only after verification.

### `ai-use.md`

- Never delete old genuine records without explicit instruction.
- Append real prompts while working; do not invent prompts later.
- Keep the number and fields required by the current labsheet.
- If a real prompt is too short, clarify it slightly while preserving its meaning. Do not expand it into a prompt that was never given.
- Record the AI/LLM and coding agent, purpose, suggestion, what the student accepted/rejected/corrected, and how it was verified.
- Do not write the student's personal reflection until the student asks. Human judgment and corrections must be genuine.

### `reviewer.md`

- Follow the Lab 1 layout and include only useful evidence.
- Record reviewer identity, actual PR links, comments given and received, responses from both the student and friend, requested changes, and actual approvals.
- Put `Reviewer verdict` and `My review verdict` beneath the appropriate table in the same pattern as Lab 1.
- Link only the partner's PRs relevant to the current lab; never assume their PR numbers match this repository.
- Distinguish formal GitHub **Approve** reviews from comment-only feedback.

## 11. Evidence and screenshots

Capture evidence throughout the sprint rather than recreating it at the end. Every image must have a short caption that says:

1. what the image shows; and
2. which requirement or claim it proves.

Screenshots must remain readable without extreme zoom and must not expose passwords, connection strings, secrets, personal data, internal storage names, or unsafe paths. Prefer focused screenshots over large uncropped screens.

When required, preserve evidence of:

- final `main` commit history and branch/merge graph;
- the engineering contract existing before implementation PRs;
- Issue/PR/Project workflow and final Kanban state;
- reviewer identity, comments, responses, and approvals;
- complete server/client test and build output;
- E2E/Playwright output with no skipped required tests;
- migration and repeated idempotent seed output;
- database/API ownership or authorization behavior;
- responsive desktop, tablet, and mobile states;
- safe error, loading, empty, validation, and boundary states;
- AC-to-Test-ID traceability and the completed visual checklist.

## 12. Release and final submission

Before the release PR, audit the exact release-candidate commit. Do not change the candidate after testing without rerunning affected checks. Complete every labsheet release gate before the final merge if the course workflow does not allow a later documentation correction.

After the authorized release merge, verify the final `main` SHA and rerun any checks the labsheet explicitly requires from `main`. If evidence must be updated afterward, follow the student's approved staging-first branch flow; do not edit `main` directly.

For the submission document:

- follow the exact heading names and order required by the current labsheet;
- submit exactly the requested number and format of files;
- include working repository, Issue, branch, PR, Project, and document hyperlinks when required;
- use a formal white background, black text, consistent spacing, readable screenshots, and captions;
- keep claims accurate: distinguish database-backed reference data from fixed application enums;
- render and inspect every page before declaring the document ready;
- treat final `main` as the source of truth;
- do not mention local draft DOCX files in repository documentation if the student intends to keep them uncommitted.

## 13. Communication with the student

- Lead with the outcome and explain blockers plainly.
- Warn before acting when the branch name, Issue scope, plan, or labsheet conflicts.
- When implementation is ready, give concise manual test steps and state what remains for later Issues.
- If something cannot be tested locally, explain exactly why and what the student must configure or run. Do not mark it complete.
- Before a requested commit/PR, report readiness, changed files, tests run, and any remaining risks.
- Do not pressure the student to follow unnecessary process. Explain which items are mandatory for the rubric, strongly recommended, or optional.

## 14. Current lab startup checklist

Whenever the student provides a new labsheet, begin with this checklist:

- [ ] Confirm the current lab number, exact labsheet, `<lab-folder>`, and files in scope.
- [ ] Read the labsheet completely.
- [ ] Inspect repository, branch, status, history, schema, tests, and existing documentation.
- [ ] Identify fixed requirements, ambiguities, exclusions, evidence, and grading criteria.
- [ ] Confirm the exact `<lab-staging>` branch name, and create it only after authorization.
- [ ] Draft the engineering contract and AC/Test traceability.
- [ ] Show the proposed Issue list, dependencies, branch names, and PR titles before GitHub creation.
- [ ] Obtain approval for the plan and contract.
- [ ] Execute one authorized Issue at a time using failing tests first.
- [ ] Update `tests.md`, `ai-use.md`, and `reviewer.md` continuously.
- [ ] Obtain teammate approval and student merge authorization for each PR.
- [ ] Run the release-candidate and final-main evidence gates required by the current lab.
- [ ] Produce and visually audit the final submission exactly against the current lab's rubric.
