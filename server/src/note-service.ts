import type { AuthContext } from "./auth-service.js";
import type { Prisma } from "@prisma/client";
import { getPrisma } from "./prisma.js";
import { TicketApiError } from "./ticket-service.js";

const TICKET_NUMBER_PATTERN = /^TKT-\d{4}-\d{6}$/;

function apiError(statusCode: 400 | 404 | 500, code: string, message: string, fieldErrors?: Record<string, string>) {
  return new TicketApiError({ statusCode, code, message, ...(fieldErrors ? { fieldErrors } : {}) });
}

function requireTicketNumber(value: string): string {
  if (!TICKET_NUMBER_PATTERN.test(value)) throw apiError(404, "TICKET_NOT_FOUND", "Ticket was not found.");
  return value;
}

type NoteWithAuthor = Prisma.InternalNoteGetPayload<{ include: { author: true } }>;

function serializeNote(note: NoteWithAuthor) {
  return {
    id: note.id,
    content: note.content,
    author: {
      id: note.author.id,
      name: note.author.name,
      email: note.author.email,
      role: note.author.role,
    },
    createdAt: note.createdAt,
  };
}

async function findTicket(ticketNumber: string) {
  const ticket = await getPrisma().ticket.findUnique({ where: { ticketNumber: requireTicketNumber(ticketNumber) }, select: { id: true } });
  if (!ticket) throw apiError(404, "TICKET_NOT_FOUND", "Ticket was not found.");
  return ticket;
}

function readContent(body: unknown): string {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw apiError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { content: "Note is required." });
  }
  const record = body as Record<string, unknown>;
  const unsupported = Object.keys(record).find((key) => key !== "content");
  if (unsupported) throw apiError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { [unsupported]: "This field is not supported." });
  const content = typeof record.content === "string" ? record.content.trim() : "";
  if (content.length < 1 || content.length > 2000) {
    throw apiError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { content: "Note must be 1–2,000 characters after trimming." });
  }
  return content;
}

export async function listInternalNotes(_context: AuthContext, ticketNumber: string) {
  const ticket = await findTicket(ticketNumber);
  try {
    const notes = await getPrisma().internalNote.findMany({
      where: { ticketId: ticket.id },
      include: { author: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return { notes: notes.map(serializeNote) };
  } catch {
    throw apiError(500, "NOTE_LIST_FAILED", "Internal Notes could not be loaded.");
  }
}

export async function createInternalNote(context: AuthContext, ticketNumber: string, body: unknown) {
  const ticket = await findTicket(ticketNumber);
  const content = readContent(body);
  try {
    const note = await getPrisma().internalNote.create({
      data: { ticketId: ticket.id, authorId: context.user.id, content },
      include: { author: true },
    });
    return { note: serializeNote(note) };
  } catch {
    throw apiError(500, "NOTE_CREATE_FAILED", "Internal Note could not be created.");
  }
}
