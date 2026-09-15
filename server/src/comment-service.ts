import type { AuthContext } from "./auth-service.js";
import { requesterIdForContext } from "./auth-service.js";
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

type CommentWithAuthor = Prisma.PublicCommentGetPayload<{
  include: { author: true };
}>;

function serializeComment(comment: CommentWithAuthor) {
  return {
    id: comment.id,
    content: comment.content,
    author: {
      id: comment.author.id,
      name: comment.author.name,
      email: comment.author.email,
      role: comment.author.role,
    },
    createdAt: comment.createdAt,
  };
}

async function findOwnedTicket(context: AuthContext, ticketNumber: string) {
  const requesterId = requesterIdForContext(context);
  const ticket = await getPrisma().ticket.findFirst({
    where: { ticketNumber: requireTicketNumber(ticketNumber), requesterId },
    select: { id: true, status: true, resolutionIndicatedAt: true, resolutionIndicatedBy: true },
  });
  if (!ticket) throw apiError(404, "TICKET_NOT_FOUND", "Ticket was not found.");
  return { requesterId, ticket };
}

function readCommentBody(body: unknown): string {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw apiError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { content: "Comment is required." });
  }
  const record = body as Record<string, unknown>;
  const unsupported = Object.keys(record).find((key) => key !== "content");
  if (unsupported) throw apiError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { [unsupported]: "This field is not supported." });
  const content = typeof record.content === "string" ? record.content.trim() : "";
  if (content.length < 1 || content.length > 2000) {
    throw apiError(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", { content: "Comment must be 1–2,000 characters after trimming." });
  }
  return content;
}

export async function listPublicComments(context: AuthContext, ticketNumber: string) {
  const { ticket } = await findOwnedTicket(context, ticketNumber);
  try {
    const comments = await getPrisma().publicComment.findMany({
      where: { ticketId: ticket.id },
      include: { author: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return { comments: comments.map(serializeComment) };
  } catch {
    throw apiError(500, "COMMENT_LIST_FAILED", "Comments could not be loaded.");
  }
}

export async function createPublicComment(context: AuthContext, ticketNumber: string, body: unknown) {
  const { ticket } = await findOwnedTicket(context, ticketNumber);
  const content = readCommentBody(body);
  try {
    const comment = await getPrisma().publicComment.create({
      data: { ticketId: ticket.id, authorId: context.user.id, content },
      include: { author: true },
    });
    return { comment: serializeComment(comment) };
  } catch {
    throw apiError(500, "COMMENT_CREATE_FAILED", "Comment could not be created.");
  }
}

export async function indicateResolution(context: AuthContext, ticketNumber: string) {
  const { ticket } = await findOwnedTicket(context, ticketNumber);
  if (["RESOLVED", "CLOSED"].includes(ticket.status)) {
    throw apiError(400, "RESOLUTION_INDICATION_NOT_ALLOWED", "This Ticket cannot receive a resolution indication.");
  }
  try {
    const updated = await getPrisma().$transaction(async (tx) => {
      const current = await tx.ticket.findUniqueOrThrow({ where: { id: ticket.id }, select: { resolutionIndicatedAt: true, resolutionIndicatedBy: true } });
      if (current.resolutionIndicatedAt && current.resolutionIndicatedBy) return current;
      return tx.ticket.update({
        where: { id: ticket.id },
        data: { resolutionIndicatedAt: new Date(), resolutionIndicatedByUserId: context.user.id },
        select: { resolutionIndicatedAt: true, resolutionIndicatedBy: true },
      });
    });
    if (!updated.resolutionIndicatedAt || !updated.resolutionIndicatedBy) throw new Error("missing indication");
    return {
      resolutionIndication: {
        indicatedAt: updated.resolutionIndicatedAt,
        indicatedBy: {
          id: updated.resolutionIndicatedBy.id,
          name: updated.resolutionIndicatedBy.name,
          email: updated.resolutionIndicatedBy.email,
          role: updated.resolutionIndicatedBy.role,
        },
      },
    };
  } catch (error) {
    if (error instanceof TicketApiError) throw error;
    throw apiError(500, "RESOLUTION_INDICATION_FAILED", "Resolution indication could not be recorded.");
  }
}
