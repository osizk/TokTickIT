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
Update `.env` with your actual PostgreSQL connection string.

### 2. Install Dependencies
Install dependencies for both client and server:
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
npx prisma migrate dev
npx prisma db seed
```

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

### 5. Running Tests
- **Frontend**: `cd client && npm test`
- **Backend**: `cd server && npm test`

## Lab 2 Verification and Evidence

Lab 2 uses the temporary Development Requester selector as a testing context. The
`X-Requester-Id` header is intentionally spoofable for this lab and is not
authentication. Requester-owned APIs must always be exercised with the selected
context; a Ticket request body must never contain `requesterId`.

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
