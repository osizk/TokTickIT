import type { ActionStatus } from "@prisma/client";

const ACTION_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const satisfies readonly ActionStatus[];
const CREATE_FIELDS = new Set([
  "clientRequestId",
  "expectedTicketVersion",
  "description",
  "assigneeUserId",
  "result",
  "followUpRequired",
  "followUpNote",
  "attachmentNotes",
]);
const PATCH_FIELDS = new Set([
  "expectedTicketVersion",
  "expectedActionVersion",
  "description",
  "assigneeUserId",
  "result",
  "followUpRequired",
  "followUpNote",
  "attachmentNotes",
  "status",
  "cancellationReason",
]);

export interface ValidatedCreateAction {
  clientRequestId: string;
  expectedTicketVersion: number;
  description: string;
  assigneeUserId?: number;
  result: string | null;
  followUpRequired: boolean;
  followUpNote: string | null;
  attachmentNotes: string | null;
}

export interface ValidatedPatchAction {
  expectedTicketVersion: number;
  expectedActionVersion: number;
  description?: string;
  assigneeUserId?: number;
  result?: string | null;
  followUpRequired?: boolean;
  followUpNote?: string | null;
  attachmentNotes?: string | null;
  status?: ActionStatus;
  cancellationReason?: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; fieldErrors: Record<string, string> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function version(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function text(value: unknown, field: string, min: number, max: number, required: boolean, errors: Record<string, string>): string | null {
  if (value === undefined && !required) return null;
  if (value === null && !required) return null;
  if (typeof value !== "string") {
    errors[field] = required ? "This field is required." : "Enter text or leave this field empty.";
    return null;
  }
  const normalized = value.trim();
  if (normalized.length === 0 && !required) return null;
  if (normalized.length < min || normalized.length > max) {
    errors[field] = `Must be ${min}–${max} characters after trimming.`;
    return null;
  }
  return normalized;
}

function collectUnknown(input: Record<string, unknown>, allowed: Set<string>, errors: Record<string, string>) {
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) errors[key] = "This field is not supported.";
  }
}

export function validateCreateAction(input: unknown): ValidationResult<ValidatedCreateAction> {
  if (!isRecord(input)) return { ok: false, fieldErrors: { body: "A JSON object is required." } };
  const errors: Record<string, string> = {};
  collectUnknown(input, CREATE_FIELDS, errors);

  const clientRequestId = typeof input.clientRequestId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.clientRequestId)
    ? input.clientRequestId.toLowerCase()
    : null;
  if (!clientRequestId) errors.clientRequestId = "A valid UUID is required.";

  const expectedTicketVersion = version(input.expectedTicketVersion);
  if (expectedTicketVersion === null) errors.expectedTicketVersion = "Expected Ticket version must be a non-negative integer.";

  const description = text(input.description, "description", 5, 2000, true, errors);
  const result = text(input.result, "result", 5, 2000, false, errors);
  const followUpNote = text(input.followUpNote, "followUpNote", 5, 2000, false, errors);
  const attachmentNotes = text(input.attachmentNotes, "attachmentNotes", 1, 1000, false, errors);

  let assigneeUserId: number | undefined;
  if (input.assigneeUserId !== undefined) {
    const parsed = positiveInteger(input.assigneeUserId);
    if (parsed === null) errors.assigneeUserId = "Choose an eligible User.";
    else assigneeUserId = parsed;
  }

  if (typeof input.followUpRequired !== "boolean") errors.followUpRequired = "Choose whether follow-up is required.";
  if (input.followUpRequired === true && !followUpNote) errors.followUpNote = "Enter a note when follow-up is required.";

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return {
    ok: true,
    value: {
      clientRequestId: clientRequestId as string,
      expectedTicketVersion: expectedTicketVersion as number,
      description: description as string,
      ...(assigneeUserId !== undefined ? { assigneeUserId } : {}),
      result,
      followUpRequired: input.followUpRequired as boolean,
      followUpNote,
      attachmentNotes,
    },
  };
}

export function validatePatchAction(input: unknown): ValidationResult<ValidatedPatchAction> {
  if (!isRecord(input)) return { ok: false, fieldErrors: { body: "A JSON object is required." } };
  const errors: Record<string, string> = {};
  collectUnknown(input, PATCH_FIELDS, errors);

  const expectedTicketVersion = version(input.expectedTicketVersion);
  if (expectedTicketVersion === null) errors.expectedTicketVersion = "Expected Ticket version must be a non-negative integer.";
  const expectedActionVersion = version(input.expectedActionVersion);
  if (expectedActionVersion === null) errors.expectedActionVersion = "Expected Action version must be a non-negative integer.";

  const value: ValidatedPatchAction = {
    expectedTicketVersion: expectedTicketVersion ?? -1,
    expectedActionVersion: expectedActionVersion ?? -1,
  };
  let businessFieldCount = 0;

  if ("description" in input) {
    value.description = text(input.description, "description", 5, 2000, true, errors) ?? undefined;
    businessFieldCount += 1;
  }
  if ("assigneeUserId" in input) {
    const parsed = positiveInteger(input.assigneeUserId);
    if (parsed === null) errors.assigneeUserId = "Choose an eligible User.";
    else value.assigneeUserId = parsed;
    businessFieldCount += 1;
  }
  if ("result" in input) {
    value.result = text(input.result, "result", 5, 2000, false, errors);
    businessFieldCount += 1;
  }
  if ("followUpRequired" in input) {
    if (typeof input.followUpRequired !== "boolean") errors.followUpRequired = "Choose whether follow-up is required.";
    else value.followUpRequired = input.followUpRequired;
    businessFieldCount += 1;
  }
  if ("followUpNote" in input) {
    value.followUpNote = text(input.followUpNote, "followUpNote", 5, 2000, false, errors);
    businessFieldCount += 1;
  }
  if ("attachmentNotes" in input) {
    value.attachmentNotes = text(input.attachmentNotes, "attachmentNotes", 1, 1000, false, errors);
    businessFieldCount += 1;
  }
  if ("status" in input) {
    if (typeof input.status !== "string" || !ACTION_STATUSES.includes(input.status as ActionStatus)) errors.status = "Choose a valid Action status.";
    else value.status = input.status as ActionStatus;
    businessFieldCount += 1;
  }
  if ("cancellationReason" in input) {
    const reason = text(input.cancellationReason, "cancellationReason", 5, 250, true, errors);
    if (reason !== null) value.cancellationReason = reason;
    businessFieldCount += 1;
  }
  if (businessFieldCount === 0) errors.body = "At least one Action field must be changed.";

  if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };
  return { ok: true, value };
}
