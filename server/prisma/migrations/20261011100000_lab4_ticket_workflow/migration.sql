-- Lab 4 Issue #58: immutable Ticket status transition history.
CREATE TABLE "TicketWorkflowEvent" (
  "id" SERIAL NOT NULL,
  "ticketId" INTEGER NOT NULL,
  "actorUserId" INTEGER NOT NULL,
  "fromStatus" "TicketStatus" NOT NULL,
  "toStatus" "TicketStatus" NOT NULL,
  "reason" TEXT,
  "workflowVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TicketWorkflowEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TicketWorkflowEvent_ticketId_workflowVersion_key"
  ON "TicketWorkflowEvent"("ticketId", "workflowVersion");
CREATE INDEX "TicketWorkflowEvent_ticketId_createdAt_id_idx"
  ON "TicketWorkflowEvent"("ticketId", "createdAt", "id");

ALTER TABLE "TicketWorkflowEvent"
  ADD CONSTRAINT "TicketWorkflowEvent_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketWorkflowEvent"
  ADD CONSTRAINT "TicketWorkflowEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
