import { describe, expect, it } from "vitest";
import { validateTicketFields } from "../../src/ticket-validation.js";

describe("Ticket field validation", () => {
  it("trims valid fields and accepts the exact supported priority values", () => {
    const result = validateTicketFields({
      categoryId: "4",
      relatedSystemId: "2",
      requestedPriority: "HIGH",
      summary: "  Campus Wi-Fi disconnects  ",
      description: "  The connection drops several times during the workday.  ",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        categoryId: 4,
        relatedSystemId: 2,
        requestedPriority: "HIGH",
        summary: "Campus Wi-Fi disconnects",
        description: "The connection drops several times during the workday.",
      });
    }
  });

  it("enforces required values and inclusive trimmed boundaries", () => {
    const minimum = validateTicketFields({
      categoryId: "1",
      relatedSystemId: "1",
      requestedPriority: "LOW",
      summary: "1234",
      description: "123456789",
    });
    expect(minimum.ok).toBe(false);
    if (!minimum.ok) {
      expect(minimum.fieldErrors.summary).toBeDefined();
      expect(minimum.fieldErrors.description).toBeDefined();
    }

    const maximum = validateTicketFields({
      categoryId: "1",
      relatedSystemId: "1",
      requestedPriority: "URGENT",
      summary: "a".repeat(121),
      description: "b".repeat(5001),
    });
    expect(maximum.ok).toBe(false);
    if (!maximum.ok) {
      expect(maximum.fieldErrors.summary).toBeDefined();
      expect(maximum.fieldErrors.description).toBeDefined();
    }
  });

  it("rejects malformed references, unsupported priorities, and requesterId input", () => {
    const result = validateTicketFields({
      categoryId: "0",
      relatedSystemId: "not-an-id",
      requestedPriority: "CATASTROPHIC",
      summary: "Valid summary",
      description: "A sufficiently descriptive ticket body.",
      requesterId: "1",
      unexpected: "not accepted",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fieldErrors.categoryId).toBeDefined();
      expect(result.fieldErrors.relatedSystemId).toBeDefined();
      expect(result.fieldErrors.requestedPriority).toBeDefined();
      expect(result.fieldErrors.requesterId).toBeDefined();
      expect(result.fieldErrors.unexpected).toBeDefined();
    }
  });
});
