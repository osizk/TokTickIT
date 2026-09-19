-- Lab 3 authentication foundation. This migration is additive so Lab 2
-- Requester/Ticket/Attachment foreign keys keep working while the later
-- ownership migration moves them to User.
CREATE TYPE "UserRole" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'REQUESTER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "legacyRequesterId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "csrfTokenHash" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idleExpiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoginAttemptBucket" (
    "id" SERIAL NOT NULL,
    "keyHash" TEXT NOT NULL,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "blockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttemptBucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_legacyRequesterId_key" ON "User"("legacyRequesterId");
CREATE INDEX "User_isActive_role_name_idx" ON "User"("isActive", "role", "name");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");
CREATE INDEX "Session_idleExpiresAt_idx" ON "Session"("idleExpiresAt");
CREATE UNIQUE INDEX "LoginAttemptBucket_keyHash_key" ON "LoginAttemptBucket"("keyHash");
CREATE INDEX "LoginAttemptBucket_blockedUntil_idx" ON "LoginAttemptBucket"("blockedUntil");

ALTER TABLE "User" ADD CONSTRAINT "User_legacyRequesterId_fkey"
  FOREIGN KEY ("legacyRequesterId") REFERENCES "Requester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve every existing Requester identity and ID. The SELECT deliberately
-- includes every legacy Requester, including rows that are not seed fixtures.
-- Credentials are supplied later by the idempotent seed; ON CONFLICT keeps a
-- rerun from replacing a password hash or first-login flag.
INSERT INTO "User" ("id", "name", "email", "role", "isActive", "mustChangePassword", "legacyRequesterId", "createdAt", "updatedAt")
SELECT "id", "name", lower(trim("email")), 'REQUESTER', "isActive", true, "id", "createdAt", "updatedAt"
FROM "Requester"
ON CONFLICT ("id") DO NOTHING;

SELECT setval(pg_get_serial_sequence('"User"', 'id'), COALESCE((SELECT MAX("id") FROM "User"), 1), true);
