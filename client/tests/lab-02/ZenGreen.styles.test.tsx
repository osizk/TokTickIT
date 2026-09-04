import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const styles = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

describe("Zen Green style contract", () => {
  it("defines the approved semantic colors and visible focus treatment", () => {
    expect(styles).toContain("--zen-primary: #006b3c");
    expect(styles).toContain("--zen-focus: #f1b641");
    expect(styles).toContain("button:focus-visible");
    expect(styles).toContain("a:focus-visible");
    expect(styles).toContain("textarea:focus-visible");
  });

  it("keeps required field, state, button, badge, and layout classes in the stylesheet", () => {
    for (const className of [
      "zen-card",
      "zen-field",
      "zen-required",
      "zen-field-error",
      "zen-button-primary",
      "zen-button-secondary",
      "zen-status-badge",
      "zen-priority-badge",
      "zen-ticket-table",
      "zen-ticket-cards",
    ]) {
      expect(styles).toMatch(new RegExp(`\\.${className}\\b`));
    }
  });

  it("defines the approved tablet and mobile responsive boundaries", () => {
    expect(styles).toContain("@media (max-width: 991px)");
    expect(styles).toContain("@media (max-width: 767px)");
    expect(styles).toContain(".zen-ticket-table-wrap");
    expect(styles).toContain(".zen-ticket-cards");
  });
});
