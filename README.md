# TokTickIT 

TokTickIT is an IT service desk application. This project is built using:
- **Frontend**: React + TypeScript + Vite + Bootstrap
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + Prisma

## Setup Instructions

### Prerequisites
- Node.js (v20+; required by Playwright 1.62)
- PostgreSQL installed and running locally.

### 1. Database Setup
Ensure PostgreSQL is running. Configure your environment variables for the backend:
```bash
cd server
cp .env.example .env
```
Update `server/.env` with your local PostgreSQL connection string and these three local-only seed values:

```text
LAB3_REQUESTER_INITIAL_PASSWORD=<choose a local password>
LAB3_IT_STAFF_INITIAL_PASSWORD=<choose a local password>
LAB3_ADMIN_INITIAL_PASSWORD=<choose a local password>
```

Each must contain 12–128 characters, uppercase, lowercase, a number and a symbol, with no surrounding whitespace. The `LAB3_` names remain in use for Lab 4. Never commit the values. Seed initializes missing credentials only; rerunning it will not reset an account whose password was changed. Use that account's current password or the Administrator reset flow.

### 2. Install Dependencies
Install dependencies for both client and server:
Start this block at repository root (return there if the previous block left you in `server/`).
```bash
# In the client directory
cd client
npm install

# In the server directory
cd ../server
npm install
```

### 3. Initialize Prisma & Database
In the `server` directory, run:
```bash
npm run prisma:migrate
npm run prisma:seed
```

`prisma:migrate` deploys committed additive migrations. Back up a real development database and its protected attachment directory before an upgrade. Do not use `migrate reset` to upgrade existing data. Seed creates missing reference data and reserved sample Ticket graphs without overwriting existing graphs, edited identities or changed credentials.

### 4. Running the Application
You need two terminal windows.

**Terminal 1 (Backend):**
```bash
cd server
npm run dev
```

**Terminal 2 (Frontend):**
```bash
cd client
npm run dev
```

Open `http://localhost:5173/login`; API health is `http://localhost:3000/api/health`. Seeded demo identities are `amina@example.test` (Requester), `michael.staff@example.test` (IT Staff), and `admin@example.test` (Administrator). Initial passwords come from the corresponding local environment variable; first login requires a change. The role landing pages are `/dashboard` and `/staff/dashboard`; Administrator also has `/admin/users`.

### 5. Running Tests
- **Frontend**: run `npm test` from `client/`.
- **Backend**: configure `server/.env.test` and migrate/seed the isolated test database first, then run `npm test` from `server/`. See the current Lab 4 commands below.

## Lab 2 Verification and Evidence

Historically, Lab 2 used a temporary Development Requester selector and spoofable
`X-Requester-Id` header. Lab 3 replaced them with authenticated sessions. The
current Lab 4 application uses the session for identity/ownership and does not
restore that selector/header flow. A Ticket body must never select its Requester.

### Isolated test configuration

For database-backed checks, copy [`server/.env.test.example`](server/.env.test.example)
to `server/.env.test` and point it at a disposable PostgreSQL database whose name
ends with `_test`. Real `.env.test` files, credentials, secrets, uploaded files,
and local attachment storage are ignored and must never be committed.

Server Vitest and Playwright refuse to run when `server/.env.test` is missing,
never fall back to `server/.env`, and require the database name to end with
`_test`. Playwright additionally accepts only the allowlisted E2E schemas
`toktickit_e2e`, `toktickit_release_e2e`, and `toktickit_release_final`. It creates
the selected schema and a temporary protected attachment directory automatically,
and always starts the API with that isolated environment instead of reusing an
existing developer server.

### Lab 2 test commands

```bash
cd server
npm test
npm run build
npm run prisma:test:migrate
npm run prisma:test:seed

cd ../client
npm test
npm run build
npx playwright test
```

Playwright is configured in `client/playwright.config.ts`, loads tests from
`../e2e`, and runs desktop, tablet, and mobile projects. Responsive screenshot
evidence and captions are stored under
[`artifacts/lab-02/screenshots`](artifacts/lab-02/screenshots).

### Lab 2 contract and evidence documents

- [Engineering specification](docs/lab-02/specification.md)
- [API specification](docs/lab-02/api-spec.md)
- [UI specification](docs/lab-02/ui-spec.md)
- [Test plan and evidence](docs/lab-02/tests.md)
- [AI-use record](docs/lab-02/ai-use.md)
- [Peer-review record](docs/lab-02/reviewer.md)

## Lab 3 Verification and Evidence

Lab 3 replaces the temporary Development Requester selector with authenticated
Requester, IT Staff, and Administrator workflows. The backend owns identity,
role authorization, Ticket ownership, session expiry, CSRF checks, and safe
errors. Initial seed passwords are local-only values; never commit them.

### Lab 3 local test environment

Copy `server/.env.test.example` to `server/.env.test` and use a disposable
PostgreSQL database whose name ends in `_test`. Set these three variables only
in the local environment when running the Lab 3 seed or authenticated tests:

```text
LAB3_REQUESTER_INITIAL_PASSWORD=<local value>
LAB3_IT_STAFF_INITIAL_PASSWORD=<local value>
LAB3_ADMIN_INITIAL_PASSWORD=<local value>
```

The guarded Prisma and Vitest configuration refuses to fall back to
`server/.env`, and Playwright accepts only its allowlisted test schemas. Real
`.env.test` files, passwords, credentials, uploaded files, and test storage
remain ignored and must not be committed.

### Lab 3 verification commands

```bash
cd server
npm test -- --run
npm run build
npm run prisma:test:migrate
npm run prisma:test:seed
npm run prisma:test:seed

cd ../client
npm test -- --run
npm run build
npx playwright test

cd ..
node --test scripts/lab3-release-audit.test.mjs
node scripts/lab3-release-audit.mjs HEAD
```

The `HEAD` audit verifies the prepared release candidate before its PR is
merged. After the authorized promotion, `node scripts/lab3-release-audit.mjs
main` verifies that the recorded Lab 3 release baseline is present in final
`main`. The exact post-promotion SHA and graph are retained in the submission
PDF because this course workflow finalizes repository Markdown before the
promotion. Do not claim a Project-board state, teammate approval, screenshot,
test result, or PDF audit that was not actually observed or student-confirmed.

### Lab 3 contract and evidence documents

- [Engineering specification](docs/lab-03/specification.md)
- [API specification](docs/lab-03/api-spec.md)
- [UI specification](docs/lab-03/ui-spec.md)
- [Test plan and traceability](docs/lab-03/tests.md)
- [AI-use record](docs/lab-03/ai-use.md)
- [Peer-review record](docs/lab-03/reviewer.md)
- [Release-evidence index](docs/lab-03/release-evidence/README.md)
- [Responsive screenshots](artifacts/lab-03/screenshots)

## Lab 4: Actions, dashboards, and release verification

Lab 4 adds public Actions Taken and immutable revisions on Tickets, a backend
resolution gate and workflow history, and Requester/Staff dashboards. The Ticket
Owner, Action assignee, creator and completion performer are distinct identities.
Requesters read all Actions on their owned Tickets; Staff/Admin manage Actions.
Private staff communication remains in Internal Notes.

### Isolated verification (VS Code PowerShell)

Create a separate disposable PostgreSQL database, for example `toktickit_test`,
owned by the login in its connection string. In pgAdmin, use Databases → Create →
Database, enter that name, choose the matching Owner, and save. Do not substitute
the development database. From repository root:

```powershell
if (-not (Test-Path server/.env.test)) {
  Copy-Item server/.env.test.example server/.env.test
}
```

Edit the local copy with its test connection string and all three valid seed
passwords. Do not overwrite an existing configured copy. API manual testing
normally uses `server/.env`; automated checks require `server/.env.test` and
never fall back to development configuration.

For a manual demo against the disposable test data, start the API from `server/`
with `node --env-file=.env.test --import tsx src/index.ts` instead of
`npm run dev`. Use that database's current account passwords; a healthy API alone
does not prove you selected the intended database. Run only one API on port 3000.

Run the following commands in order, stopping at a failure:

```powershell
# Repository root: record the candidate being tested
git rev-parse HEAD
git status --short

cd server
npm.cmd run prisma:test:migrate
npm.cmd run prisma:test:seed
npm.cmd run prisma:test:seed
npm.cmd test -- --run
npm.cmd run build
npm.cmd run prisma:test:recovery

cd ../client
npm.cmd test -- --run
npm.cmd run build
npx.cmd playwright install chromium
npx.cmd playwright test
```

The recovery command requires `pg_dump` and `pg_restore` on PATH, matching the
PostgreSQL server version. On Windows, add your installation's `bin` folder to
the current terminal PATH, for example:

```powershell
$env:Path = 'C:\Program Files\PostgreSQL\18\bin;' + $env:Path
```

The recovery command uses only `server/.env.test`, validates the `_test` suffix,
creates a generated `toktickit_lab4_recovery_test_<pid>_<timestamp>` schema, and
applies real migrations/seed there. It backs up that schema and a test-owned
attachment file, simulates damage, restores, compares every table's fingerprints
and sequences plus file bytes, then removes its own schema/backup/storage. It
does not back up or restore a real development database. For an actual upgrade,
back up the database and protected storage together during a maintenance window;
an application rollback should retain additive Lab 4 tables and post-upgrade
work rather than drop them.

Before Playwright, stop your manually started API/Vite with Ctrl+C in their own
terminals; the runner starts isolated servers and refuses occupied URLs. It runs
all current Lab 3/4 specs across desktop/tablet/mobile. The historical Lab 2
selector suites are replaced by authenticated flows mapped in
[tests.md](docs/lab-04/tests.md). To inspect the generated local report:

```powershell
# From client/
npx.cmd playwright show-report ../artifacts/lab-04/playwright-report
```

Expected totals depend on the tested candidate; use observed output in the test
record rather than assuming historical counts. Existing screenshot evidence is
preserved by the capture helpers; transient reports are ignored. View current
UI in a real browser instead of treating old screenshots as fresh data.

### Short manual demonstration

1. Requester: sign in, complete first-password change if required, open Dashboard,
   drill into owned My Tickets, create a Ticket with an attachment, and verify
   another Requester cannot read it.
2. Staff: open Dashboard, follow a current-user Action link, assign the Ticket
   Owner, create two Actions, reassign/edit one, complete it with a Result, and
   cancel the other with a reason. Check read-only Requester visibility and the
   unchanged Internal Notes restrictions.
3. Staff: show a failed resolution gate, satisfy it, resolve/close/reopen using
   confirmation, and inspect retained history. A Requester's indication alone
   must not change status.
4. Administrator: verify role navigation, User filters, duplicate email and
   assignment/self/last-Administrator safety. Check logout and blocked direct
   access afterward.
5. Check desktop/tablet/mobile, keyboard/focus, required/optional validation,
   loading/empty/failure/Retry, and safe direct API denials. Follow the remaining
   human evidence checklist in the test document; passing automation is not a
   substitute for an unperformed manual check.

Sessions and CSRF/Origin checks are authoritative. The spoofable Requester header
is obsolete. Attachments retain PostgreSQL metadata and non-public local bytes;
soft-removed files remain protected and cannot be downloaded. Never expose
environment files, cookie/CSRF values, hashes, database credentials or protected
storage paths in evidence.

### Lab 4 contracts and evidence

- [Specification](docs/lab-04/specification.md)
- [API contract](docs/lab-04/api-spec.md)
- [UI contract and screenshot captions](docs/lab-04/ui-spec.md)
- [Tests, traceability and actual release gates](docs/lab-04/tests.md)
- [AI-use log](docs/lab-04/ai-use.md)
- [Peer-review record](docs/lab-04/reviewer.md)
- [Real responsive screenshots](artifacts/lab-04/screenshots)
- [Lab 4 Issues](https://github.com/osizk/TokTickIT/issues?q=is%3Aissue+%22%5BLab+4%5D%22)

Feature branches integrate into `lab4-staging`, then a separately authorized
release PR promotes staging into `main`. After that merge, record the actual
main SHA and rerun the verification commands there for submission. Pending
reviews, board completion and final-main/PDF checks remain pending until they
happen; do not mark them complete in anticipation of a merge.
