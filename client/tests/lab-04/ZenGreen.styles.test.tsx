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

  it("styles dashboards with Zen Green tokens, visible focus, and approved responsive columns", () => {
    for (const className of ["dashboard-card", "dashboard-metric-grid", "dashboard-panel-grid", "dashboard-ticket-list", "dashboard-summary-list"]) {
      expect(styles).toMatch(new RegExp(`\\.${className}\\b`));
    }
    expect(styles).toMatch(/\.dashboard-metric\s*\{[^}]*background:\s*var\(--zen-pale\)/);
    expect(styles).toMatch(/\.dashboard-metric:focus-visible,[\s\S]*?outline:\s*3px solid var\(--zen-focus\)/);
    expect(styles).toMatch(/\.dashboard-metric-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width: 991px\)[\s\S]*?\.dashboard-metric-grid\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width: 767px\)[\s\S]*?\.dashboard-panel-grid,[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(styles).toContain("overflow-wrap: anywhere");
  });
});
