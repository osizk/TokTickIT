import { describe, expect, it } from "vitest";
import { isAllowedActionTransition } from "../../src/workflow-rules.js";

describe("Lab 4 Action lifecycle rules", () => {
  it.each([
    ["OPEN", "IN_PROGRESS", true],
    ["OPEN", "COMPLETED", true],
    ["IN_PROGRESS", "COMPLETED", true],
    ["IN_PROGRESS", "CANCELLED", true],
    ["OPEN", "CANCELLED", true],
    ["COMPLETED", "IN_PROGRESS", false],
    ["COMPLETED", "CANCELLED", false],
    ["CANCELLED", "OPEN", false],
    ["CANCELLED", "COMPLETED", false],
    ["IN_PROGRESS", "OPEN", false],
  ] as const)("transition %s → %s is allowed: %s", (from, to, allowed) => {
    expect(isAllowedActionTransition(from, to)).toBe(allowed);
  });
});
