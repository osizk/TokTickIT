# TokTickIT 

TokTickIT is an IT service desk application. This project is built using:
- **Frontend**: React + TypeScript + Vite + Bootstrap
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + Prisma

## Setup Instructions

### Prerequisites
- Node.js (v18+)
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
to `server/.env.test` and point it at a disposable PostgreSQL database. Set a
disposable `ATTACHMENT_STORAGE_DIR` when running server integration tests. Real
`.env.test` files, credentials, secrets, uploaded files, and local attachment
storage are ignored and must never be committed.

The Playwright configuration also creates the isolated `toktickit_e2e` schema and
temporary attachment directory automatically when no separate test database URL
is supplied. It always starts the API with that isolated environment instead of
reusing an existing developer server.

### Lab 2 test commands

```bash
cd server
npm test
npm run build
npm run prisma:migrate
npm run prisma:seed

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
