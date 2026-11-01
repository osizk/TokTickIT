-- Lab 4 Issue #56: additive Actions Taken foundation.
ALTER TABLE "Ticket"
  ADD COLUMN "workflowVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "ActionTaken" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "assigneeUserId" INTEGER NOT NULL,
  "createdByUserId" INTEGER NOT NULL,
  "performedByUserId" INTEGER,
  "description" TEXT NOT NULL,
  "result" TEXT,
  "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
  "followUpNote" TEXT,
  "attachmentNotes" TEXT,
  "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 0,
  "clientRequestId" UUID NOT NULL,
  "requestFingerprint" CHAR(64) NOT NULL,

  CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActionTakenRevision" (
  "id" SERIAL NOT NULL,
  "actionId" INTEGER NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "actorUserId" INTEGER NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "snapshot" JSONB NOT NULL,

  CONSTRAINT "ActionTakenRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActionTaken_createdByUserId_clientRequestId_key"
  ON "ActionTaken"("createdByUserId", "clientRequestId");
CREATE INDEX "ActionTaken_ticketId_createdAt_id_idx"
  ON "ActionTaken"("ticketId", "createdAt", "id");
CREATE INDEX "ActionTaken_assigneeUserId_status_updatedAt_id_idx"
  ON "ActionTaken"("assigneeUserId", "status", "updatedAt", "id");
CREATE UNIQUE INDEX "ActionTakenRevision_actionId_revisionNumber_key"
  ON "ActionTakenRevision"("actionId", "revisionNumber");

ALTER TABLE "ActionTaken"
  ADD CONSTRAINT "ActionTaken_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken"
  ADD CONSTRAINT "ActionTaken_assigneeUserId_fkey"
  FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken"
  ADD CONSTRAINT "ActionTaken_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken"
  ADD CONSTRAINT "ActionTaken_performedByUserId_fkey"
  FOREIGN KEY ("performedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTakenRevision"
  ADD CONSTRAINT "ActionTakenRevision_actionId_fkey"
  FOREIGN KEY ("actionId") REFERENCES "ActionTaken"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTakenRevision"
  ADD CONSTRAINT "ActionTakenRevision_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
