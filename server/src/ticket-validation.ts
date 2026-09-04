import type { TicketPriority } from "@prisma/client";

export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

const TICKET_FIELD_NAMES = new Set([
  "categoryId",
  "relatedSystemId",
  "requestedPriority",
  "summary",
  "description",
  "requesterId",
]);

export interface ValidatedTicketFields {
  categoryId: number;
  relatedSystemId: number;
  requestedPriority: TicketPriority;
  summary: string;
  description: string;
}

export type TicketValidationResult =
  | { ok: true; value: ValidatedTicketFields }
  | { ok: false; fieldErrors: Record<string, string> };

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function readText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function validateTicketFields(input: Record<string, unknown>): TicketValidationResult {
  const fieldErrors: Record<string, string> = {};

  for (const fieldName of Object.keys(input)) {
    if (!TICKET_FIELD_NAMES.has(fieldName)) {
      fieldErrors[fieldName] = "This field is not supported.";
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "requesterId")) {
    fieldErrors.requesterId = "Requester context must be supplied by X-Requester-Id, not the body.";
  }

  const categoryId = parsePositiveInteger(input.categoryId);
  if (categoryId === null) {
    fieldErrors.categoryId = "Category is required and must be a positive integer.";
  }

  const relatedSystemId = parsePositiveInteger(input.relatedSystemId);
  if (relatedSystemId === null) {
    fieldErrors.relatedSystemId = "Related System is required and must be a positive integer.";
  }

  const requestedPriority = readText(input.requestedPriority);
  if (!requestedPriority || !TICKET_PRIORITIES.includes(requestedPriority as (typeof TICKET_PRIORITIES)[number])) {
    fieldErrors.requestedPriority = "Requested Priority must be LOW, MEDIUM, HIGH, or URGENT.";
  }

  const summary = readText(input.summary)?.trim() ?? "";
  if (summary.length < 5 || summary.length > 120) {
    fieldErrors.summary = "Summary must be 5–120 characters after trimming.";
  }

  const description = readText(input.description)?.trim() ?? "";
  if (description.length < 10 || description.length > 5000) {
    fieldErrors.description = "Description must be 10–5000 characters after trimming.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return {
    ok: true,
    value: {
      categoryId: categoryId as number,
      relatedSystemId: relatedSystemId as number,
      requestedPriority: requestedPriority as TicketPriority,
      summary,
      description,
    },
  };
}
