-- Lab 3 staff queue ownership and operational priority fields.
-- Existing Lab 2 tickets remain owned by their Requester; IT Priority is
-- initialized from immutable Requested Priority and no ticket is assigned.

ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'OPEN';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'IN_PROGRESS';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_REQUESTER';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'RESOLVED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'CLOSED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'REOPENED';
ALTER TYPE "TicketStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "Ticket"
  ADD COLUMN "itPriority" "TicketPriority";

UPDATE "Ticket"
SET "itPriority" = "requestedPriority"
WHERE "itPriority" IS NULL;

ALTER TABLE "Ticket"
  ALTER COLUMN "itPriority" SET NOT NULL,
  ALTER COLUMN "itPriority" SET DEFAULT 'LOW',
  ADD COLUMN "ticketOwnerId" INTEGER;

CREATE INDEX "Ticket_status_itPriority_ticketOwnerId_updatedAt_id_idx"
  ON "Ticket"("status", "itPriority", "ticketOwnerId", "updatedAt", "id");
CREATE INDEX "Ticket_ticketOwnerId_updatedAt_id_idx"
  ON "Ticket"("ticketOwnerId", "updatedAt", "id");
CREATE INDEX "Ticket_categoryId_relatedSystemId_requestedPriority_status_updatedAt_id_idx"
  ON "Ticket"("categoryId", "relatedSystemId", "requestedPriority", "status", "updatedAt", "id");

ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_ticketOwnerId_fkey"
  FOREIGN KEY ("ticketOwnerId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
