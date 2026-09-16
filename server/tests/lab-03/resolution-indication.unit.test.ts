import { describe, expect, it } from "vitest";
import { canIndicateResolution } from "../../src/comment-service.js";

describe("Requester resolution indication status guard", () => {
  it("allows active and RESOLVED Tickets but rejects CLOSED and CANCELLED Tickets", () => {
    expect(canIndicateResolution("NEW")).toBe(true);
    expect(canIndicateResolution("RESOLVED")).toBe(true);
    expect(canIndicateResolution("CLOSED")).toBe(false);
    expect(canIndicateResolution("CANCELLED")).toBe(false);
  });
});
