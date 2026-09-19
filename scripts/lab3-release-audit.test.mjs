import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { auditReleaseEvidence } from "./lab3-release-audit.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Lab 3 pre-merge release audit passes for the prepared candidate", () => {
  const report = auditReleaseEvidence(repositoryRoot, { ref: "HEAD" });

  assert.equal(report.ok, true, report.failures.join("\n"));
  assert.deepEqual(report.failures, []);
});
