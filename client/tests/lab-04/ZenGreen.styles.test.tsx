import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

describe("Lab 4 Actions Taken responsive styles", () => {
  it("styles Action records and editors using the existing Zen Green tokens", () => {
    for (const className of ["actions-taken", "action-taken-card", "action-taken-editor", "action-taken-meta"]) {
      expect(styles).toMatch(new RegExp(`\\.${className}\\b`));
    }
    expect(styles).toContain("var(--zen-border)");
    expect(styles).toContain("button:focus-visible");
  });

  it("stacks Action card controls at the approved mobile breakpoint", () => {
    expect(styles).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.action-taken-card[\s\S]*?flex-direction:\s*column/);
    expect(styles).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.action-taken-actions[\s\S]*?width:\s*100%/);
  });

  it("shows required-field markers in the established error color", () => {
    expect(styles).toMatch(/\.action-required-label::after,[\s\S]*?\.action-required-symbol\s*\{[^}]*color:\s*var\(--zen-error\)/);
    expect(styles).toContain('content: " *";');
  });
});
