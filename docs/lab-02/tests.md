# Lab 2 - Test Plan and Evidence  (fill this in)

All Lab 2 test files live under `server/tests/lab-02/`, `client/tests/lab-02/`, and `e2e/lab-02/`. Tests are planned before product implementation and must be updated with their real result and evidence in the feature branch that implements them.

## Summary Test Table

| # | Tool | Test | Result |
|---|------|------|--------|
| 1 | Vitest | Ticket Number, field, query, and Attachment validation/unit boundaries | Planned |
| 2 | Supertest/Vitest | Reference APIs, requester context, Ticket creation, ownership, list, detail, and Attachment APIs | Planned |
| 3 | Vitest + Testing Library | Requester selection, Create Ticket, My Tickets, Detail, Attachment states, and duplicate-submit behavior | Issue #14 requester-context tests pass locally; remaining UI flows planned |
| 4 | Vitest/DOM assertions | Zen Green classes, labels, errors, focus, badges, responsive classes, and non-color indicators | Planned |
| 5 | Playwright | Complete requester Ticket/Attachment lifecycle and cross-requester isolation | Planned |
| 6 | Playwright screenshots | Desktop, tablet, and mobile Create Ticket, My Tickets, and Ticket Detail evidence | Planned |
| 7 | npm/Vitest/Prisma | Final server/client regressions, builds, migration, and repeated idempotent seed | Issue #13 migration/seed verified locally; final regression pending |

Pass/fail output and screenshots will be added below as the Issues are implemented. Issue #13 now has reference-data API coverage; the remaining Lab 2 product tests are pending.

### Issue #13 evidence (2026-08-26)

- [x] Planned failing baseline run recorded: missing `/api/related-systems` and `/api/requesters` returned `404`, and the existing category failure returned an unstructured error string.
- [x] `server/tests/lab-02/reference-data.test.ts` passes 5 tests; Lab 1 health/category regression tests also pass (8 server tests total).
- [x] `npm run build` passes on the Issue #13 branch.
- [x] `npx prisma migrate deploy` applies `20260826100000_lab2_data_reference` successfully.
- [x] `npm run prisma:seed` ran twice without duplicate conflicts; active endpoint counts remain 4 categories, 7 related systems, and 4 requesters, with one inactive requester retained in the database.
- [ ] Repeat the same checks using a student-created isolated `server/.env.test` database and temporary `ATTACHMENT_STORAGE_DIR`; only `.env.test.example` is tracked.

### Issue #14 evidence (2026-08-27)

- [x] Planned failing baseline recorded before implementation: `client/tests/lab-02/RequesterSelection.test.tsx` failed because the requester API helper and Lab 2 route/context UI were not yet implemented; the four existing Lab 1 client tests passed.
- [x] `client/tests/lab-02/RequesterSelection.test.tsx` passes 7 tests covering loading, active options, disabled Continue, safe failure/Retry, empty state, startup storage validation, malformed/inactive stored IDs, protected-route guarding, and Change Requester.
- [x] Combined client regression run (`npm.cmd test -- --run` from `client/`) passes 2 test files and 11 tests: 7 Issue #14 tests plus 4 Lab 1 tests.
- [x] Client production build (`npm.cmd run build` from `client/`) passes after the requester-context implementation.
- [x] Relevant server regression run (`npm.cmd test -- --run` from `server/`) passes 3 test files and 8 tests, and the server TypeScript build passes.
- [ ] API-backed manual verification, responsive screenshots, and full E2E coverage remain planned for the later Issues.

### Test screenshots

1. Create Ticket evidence: `artifacts/lab-02/screenshots/create-ticket/` (planned)
2. My Tickets evidence: `artifacts/lab-02/screenshots/my-tickets/` (planned)
3. Ticket Detail and Attachment evidence: `artifacts/lab-02/screenshots/ticket-detail/` (planned)

Each final screenshot must include a short caption stating what it shows and which requirement it proves.

## Detailed Planned-Test Table

| Test ID | Tool/level | Requirement / AC | Test and expected result | Automated test path | Result |
|---|---|---|---|---|---|
| UNIT-01 | Vitest unit | BR-01, AC-06 | Ticket Number formatter produces `TKT-YYYY-######`. | `server/tests/lab-02/ticket-number.unit.test.ts` | Planned |
| UNIT-02 | Vitest unit | BR-08/09, AC-07 | Trimmed field limits, blank values, and priority enum validation are exact. | `server/tests/lab-02/validation.unit.test.ts` | Planned |
| UNIT-03 | Vitest unit | BR-12, AC-08 | Extension/MIME/signature, 5 MiB boundary, filename, and count rules are exact. | `server/tests/lab-02/attachment-validation.unit.test.ts` | Planned |
| API-01 | Supertest | FR-01, AC-01/02/23 | Active requester/reference endpoints return active records only and safe failures. | `server/tests/lab-02/reference-data.test.ts` | Passed locally (5 tests) |
| API-02 | Supertest | FR-07, AC-05/06 | Valid multipart create returns `201`, one Ticket, official number, `NEW`, `createdAt`, and metadata. | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-03 | Supertest | BR-05/08/09, AC-07/19 | Missing context, body requesterId, invalid fields, inactive references, and invalid priority return documented errors. | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-04 | Supertest | BR-13/14, AC-08/09 | Invalid file, storage failure, and transaction failure leave no Ticket, metadata, or request-created file. | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-05 | Supertest | BR-01, AC-06 | Concurrent creates produce unique correctly formatted numbers. | `server/tests/lab-02/create-ticket.api.test.ts` | Planned |
| API-06 | Supertest | FR-09/10, AC-10/11/12 | Owned list returns search, filters, sorts, stable order, page sizes, and metadata. | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-07 | Supertest | BR-17/19, AC-11 | Invalid query parameters return `400`; beyond-last valid pages return empty items. | `server/tests/lab-02/my-tickets.api.test.ts` | Planned |
| API-08 | Supertest | FR-11/15, AC-13/14 | Owned detail succeeds; missing and cross-owner detail both return safe `404`. | `server/tests/lab-02/ticket-detail.api.test.ts` | Planned |
| API-09 | Supertest | FR-12/13/14, AC-15/16/17/18 | Metadata, add, active download, capacity, removal, retained metadata, and blocked removed download work. | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-10 | Supertest | BR-12/14, AC-08/17 | Attachment validation and filesystem/database compensation leave safe state. | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| API-11 | Supertest | FR-15, AC-14/19 | Cross-owner detail, metadata, download, add, and remove are safe `404`s. | `server/tests/lab-02/attachments.api.test.ts` | Planned |
| UI-01 | Vitest/Testing Library | FR-01/02, AC-01/02 | Selector loading, empty, Retry, active options, disabled Continue, labels, and focus. | `client/tests/lab-02/RequesterSelection.test.tsx` | Passed locally (7 Issue #14 tests) |
| UI-02 | Vitest/Testing Library | FR-03/04, AC-03/04 | Valid/invalid sessionStorage and Change Requester clear/reload context. | `client/tests/lab-02/RequesterSelection.test.tsx` | Passed locally (7 Issue #14 tests) |
| UI-03 | Vitest/Testing Library | FR-05/06/17, AC-05/07/09/20 | Create references, validation, file errors, preserved failure values, and duplicate-submit guard. | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-04 | Vitest/Testing Library | FR-07/08, AC-05/06 | Success displays backend Ticket Number/date/status and next action. | `client/tests/lab-02/CreateTicket.test.tsx` | Planned |
| UI-05 | Vitest/Testing Library | FR-09/10, AC-10/11/12 | My Tickets query controls, table/cards, loading, empty/no-results/failure, pagination. | `client/tests/lab-02/MyTickets.test.tsx` | Planned |
| UI-06 | Vitest/Testing Library | FR-11/12/13/14, AC-13/15/16/17/18 | Detail read-only fields, Attachment states, upload/download, confirmation/reason, removed state. | `client/tests/lab-02/RequesterTicketDetail.test.tsx` | Planned |
| UI-07 | Vitest/Testing Library | AC-17/18 | Removed rows have no download action; invalid/busy actions are disabled. | `client/tests/lab-02/AttachmentSection.test.tsx` | Planned |
| STYLE-01 | Vitest/DOM | FR-16, AC-21/22 | Required labels, asterisks, errors, focus, buttons, badges, responsive classes, and non-color indicators. | `client/tests/lab-02/ZenGreen.styles.test.tsx` | Planned |
| E2E-01 | Playwright | AC-01/05/06/10/13/15/16/17 | Requester A selects, creates with file, finds, opens, downloads, adds, and removes. | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-02 | Playwright | AC-14 | Requester B cannot see or directly access Requester A resources. | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| E2E-03 | Playwright | AC-21/22 | Required screens remain usable at desktop/tablet/mobile sizes. | `e2e/lab-02/requester-ticket-flow.spec.ts` | Planned |
| VIS-01 | Playwright/screenshots | FR-16, AC-21 | Screenshots show Zen Green tokens, field states, table/cards, and no clipping/overlap/scroll. | `artifacts/lab-02/screenshots/{create-ticket,my-tickets,ticket-detail}/` | Planned |
| REG-01 | npm/Vitest/Prisma | AC-24 | Lab 1 tests/builds, Lab 2 tests/builds, migrations, and repeated seed pass from final `main`. | `server/tests/lab-01/*`, `client/tests/lab-01/*`, documented commands | Planned |

## Acceptance-Criterion Traceability

| AC | Planned Test IDs |
|---|---|
| AC-01 | API-01, UI-01, E2E-01 |
| AC-02 | API-01, UI-01 |
| AC-03 | UI-02 |
| AC-04 | UI-02, E2E-02 |
| AC-05 | API-02, UI-03, UI-04, E2E-01 |
| AC-06 | UNIT-01, API-02, API-05, UI-04, E2E-01 |
| AC-07 | UNIT-02, API-03, UI-03 |
| AC-08 | UNIT-03, API-04, API-10, UI-03 |
| AC-09 | API-04, UI-03 |
| AC-10 | API-06, UI-05, E2E-01/02 |
| AC-11 | API-06/07, UI-05 |
| AC-12 | API-06, UI-05 |
| AC-13 | API-08, UI-06, E2E-01 |
| AC-14 | API-08/11, E2E-02 |
| AC-15 | API-09/10, UI-06/07, E2E-01 |
| AC-16 | API-09/11, UI-06/07, E2E-01/02 |
| AC-17 | API-09/10, UI-06/07, E2E-01 |
| AC-18 | API-09, UI-07 |
| AC-19 | API-03/11, UI-01 |
| AC-20 | UI-03, STYLE-01 |
| AC-21 | STYLE-01, E2E-03, VIS-01 |
| AC-22 | STYLE-01, E2E-03 |
| AC-23 | API-01, REG-01 |
| AC-24 | REG-01, E2E-01/02/03, VIS-01 |

## Responsive and Visual Checklist

- [ ] Desktop, tablet, and mobile screenshots exist for Create Ticket, My Tickets, and Ticket Detail.
- [ ] Zen Green colors, readable text, surfaces, and button hierarchy match `ui-spec.md`.
- [ ] Editable/read-only fields, required markers, and field-level messages are clear.
- [ ] Focus indicators and non-color status meaning are visible.
- [ ] Table/card conversion, filters, pagination, Attachment names, and dialogs remain usable.
- [ ] No clipping, overlap, hidden actions, or horizontal page scrolling.

## Test Commands

```bash
cd server
npm test
npm run build

cd ../client
npm test
npm run build
npx playwright test
```

Run migrations and the seed against the isolated documented database; run the seed repeatedly and verify no duplicate reference records.

## Results and Evidence

Paste passing terminal output and screenshots below as each Issue is completed. Every final image must include a caption describing what it proves.

| Area | Result | Evidence |
|---|---|---|
| Unit | Planned | Add command/output |
| API/integration | Planned | Add command/output |
| UI/style/accessibility | Planned | Add command/output |
| Responsive/visual | Planned | Add checklist and screenshot paths |
| E2E | Planned | Add Playwright output and screenshots |
| Final `main` regression | Planned | Add after release merge |

## Known Limitations or Deferred Tests

- Real authentication and shared/object storage are deferred to later labs.
- In-app Attachment preview is not required; active download and removed-download blocking are required.
- Issue 1 contains the contract and test plan only; product test results remain pending until feature branches.
