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