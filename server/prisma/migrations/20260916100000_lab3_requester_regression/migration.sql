-- Lab 3 authenticated Requester continuity: resolution indication metadata
-- and append-only Public Comments. Existing Lab 2 Ticket/Attachment rows are
-- preserved; all new relations use Restrict to protect audit history.
ALTER TABLE "Ticket"
  ADD COLUMN "resolutionIndicatedAt" TIMESTAMP(3),
  ADD COLUMN "resolutionIndicatedByUserId" INTEGER;

CREATE TABLE "PublicComment" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Ticket_resolutionIndicatedByUserId_idx"
  ON "Ticket"("resolutionIndicatedByUserId");
CREATE INDEX "PublicComment_ticketId_createdAt_id_idx"
  ON "PublicComment"("ticketId", "createdAt", "id");

ALTER TABLE "Ticket"
  ADD CONSTRAINT "Ticket_resolutionIndicatedByUserId_fkey"
  FOREIGN KEY ("resolutionIndicatedByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PublicComment"
  ADD CONSTRAINT "PublicComment_ticketId_fkey"
  FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PublicComment"
  ADD CONSTRAINT "PublicComment_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
