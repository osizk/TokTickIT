import { describe, expect, it } from "vitest";
import { validateCreateAction, validatePatchAction } from "../../src/action-validation.js";

const validCreate = {
  clientRequestId: "32b8e4dd-b826-4a94-b459-4abb2e6e9d88",
  expectedTicketVersion: 0,
  description: "Replace the failed network cable.",
  followUpRequired: false,
};

describe("Lab 4 Action request validation", () => {
  it("trims valid fields and accepts documented boundaries", () => {
    const result = validateCreateAction({
      ...validCreate,
      description: ` ${"d".repeat(5)} `,
      attachmentNotes: " ",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        ...validCreate,
        description: "ddddd",
        followUpRequired: false,
        result: null,
        followUpNote: null,
        attachmentNotes: null,
      },
    });
  });

  it("rejects injected actor/date fields, unknown keys and invalid types", () => {
    const result = validateCreateAction({
      ...validCreate,
      requesterId: 7,
      createdByUserId: 8,
      createdAt: "2026-01-01T00:00:00.000Z",
      followUpRequired: "false",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toMatchObject({
      requesterId: expect.any(String),
      createdByUserId: expect.any(String),
      createdAt: expect.any(String),
      followUpRequired: expect.any(String),
    });
  });

  it("requires a follow-up note when follow-up is enabled", () => {
    const missingFollowUp = validateCreateAction({ ...validCreate, followUpRequired: true });
    expect(missingFollowUp.ok).toBe(false);
    if (!missingFollowUp.ok) expect(missingFollowUp.fieldErrors.followUpNote).toBeTruthy();

    const malformedPatch = validatePatchAction({
      expectedTicketVersion: 0,
      expectedActionVersion: 0,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(malformedPatch.ok).toBe(false);
    if (!malformedPatch.ok) expect(malformedPatch.fieldErrors.updatedAt).toBeTruthy();
  });

  it("rejects malformed idempotency keys, negative versions and out-of-range text", () => {
    const result = validateCreateAction({
      ...validCreate,
      clientRequestId: "not-a-uuid",
      expectedTicketVersion: -1,
      description: "x".repeat(2001),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors).toMatchObject({
      clientRequestId: expect.any(String),
      expectedTicketVersion: expect.any(String),
      description: expect.any(String),
    });
  });

  it("accepts the documented maximum fields and trims optional text", () => {
    const result = validateCreateAction({
      ...validCreate,
      description: ` ${"d".repeat(2000)} `,
      result: ` ${"r".repeat(2000)} `,
      followUpRequired: true,
      followUpNote: ` ${"f".repeat(2000)} `,
      attachmentNotes: ` ${"n".repeat(1000)} `,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.description).toHaveLength(2000);
    expect(result.value.result).toHaveLength(2000);
    expect(result.value.followUpNote).toHaveLength(2000);
    expect(result.value.attachmentNotes).toHaveLength(1000);
  });
});
