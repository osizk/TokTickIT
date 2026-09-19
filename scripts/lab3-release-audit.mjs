import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const REQUIRED_CONTRACT_FILES = Object.freeze([
  "docs/lab-03/specification.md",
  "docs/lab-03/tests.md",
  "docs/lab-03/ui-spec.md",
  "docs/lab-03/api-spec.md",
  "docs/lab-03/ai-use.md",
  "docs/lab-03/reviewer.md",
]);

export const REQUIRED_TEST_PATHS = Object.freeze([
  "server/tests/lab-03/auth.api.test.ts",
  "server/tests/lab-03/auth-session.api.test.ts",
  "server/tests/lab-03/authorization.api.test.ts",
  "server/tests/lab-03/requester-regression.api.test.ts",
  "server/tests/lab-03/staff-queue.api.test.ts",
  "server/tests/lab-03/staff-ticket-detail.api.test.ts",
  "server/tests/lab-03/comments-notes.api.test.ts",
  "server/tests/lab-03/users-admin.api.test.ts",
  "server/tests/lab-03/migration-seed.api.test.ts",
  "client/tests/lab-03/Login.test.tsx",
  "client/tests/lab-03/ChangePassword.test.tsx",
  "client/tests/lab-03/RequesterRegression.test.tsx",
  "client/tests/lab-03/StaffTicketQueue.test.tsx",
  "client/tests/lab-03/StaffTicketDetail.test.tsx",
  "client/tests/lab-03/UserManagement.test.tsx",
  "e2e/lab-03/authentication.spec.ts",
  "e2e/lab-03/requester-regression.spec.ts",
  "e2e/lab-03/staff-ticket-flow.spec.ts",
  "e2e/lab-03/user-administration.spec.ts",
  "e2e/lab-03/release-evidence-states.spec.ts",
]);

export const REQUIRED_RELEASE_ARTIFACTS = Object.freeze([
  "docs/lab-03/release-evidence/final-main.md",
  "docs/lab-03/release-evidence/repository-history.md",
  "docs/lab-03/release-evidence/project-board.md",
  "docs/lab-03/release-evidence/submission-audit.md",
]);

const SCREENSHOT_GROUPS = Object.freeze([
  "authentication",
  "staff-queue",
  "staff-ticket-detail",
  "user-management",
]);
const RESPONSIVE_PROJECTS = Object.freeze(["desktop", "tablet", "mobile"]);

function exists(root, relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
}

function gitCommit(root, ref) {
  try {
    return execFileSync("git", ["rev-parse", `${ref}^{commit}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function gitIsAncestor(root, ancestor, descendant) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function addMissing(report, relativePath, description = "required file") {
  if (!exists(report.root, relativePath)) report.failures.push(`Missing ${description}: ${relativePath}`);
}

function checkLocalLinks(report, relativePath) {
  const source = read(report.root, relativePath);
  const sourceDirectory = path.dirname(path.join(report.root, relativePath));
  const linkPattern = /\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/g;
  for (const match of source.matchAll(linkPattern)) {
    const target = match[1].trim().replace(/^<|>$/g, "");
    if (!target || /^(?:https?:|mailto:|#)/i.test(target)) continue;
    const targetPath = path.resolve(sourceDirectory, decodeURIComponent(target));
    if (!fs.existsSync(targetPath)) report.failures.push(`Broken local link in ${relativePath}: ${target}`);
  }
}

export function auditReleaseEvidence(root = DEFAULT_ROOT, { ref = "main" } = {}) {
  const report = { root, ref, ok: true, failures: [], warnings: [] };
  for (const relativePath of REQUIRED_CONTRACT_FILES) addMissing(report, relativePath, "contract/evidence document");

  const tests = read(root, "docs/lab-03/tests.md");
  const readme = read(root, "README.md");
  const gitignore = read(root, ".gitignore");
  const reviewer = read(root, "docs/lab-03/reviewer.md");

  checkLocalLinks(report, "README.md");
  checkLocalLinks(report, "docs/lab-03/release-evidence/README.md");

  for (const relativePath of REQUIRED_TEST_PATHS) {
    addMissing(report, relativePath, "planned test path");
    if (tests && !tests.includes(relativePath)) {
      report.failures.push(`Traceability does not mention the actual test path: ${relativePath}`);
    }
  }

  for (const group of SCREENSHOT_GROUPS) {
    for (const project of RESPONSIVE_PROJECTS) {
      const directory = path.join(root, "artifacts", "lab-03", "screenshots", group, project);
      const images = fs.existsSync(directory)
        ? fs.readdirSync(directory).filter((name) => /\.(png|jpe?g)$/i.test(name))
        : [];
      if (images.length === 0) report.failures.push(`Missing responsive screenshot evidence: artifacts/lab-03/screenshots/${group}/${project}`);
    }
  }

  for (const relativePath of REQUIRED_RELEASE_ARTIFACTS) addMissing(report, relativePath, "release evidence artifact");

  if (!readme.includes("Lab 3") || !readme.includes("LAB3_REQUESTER_INITIAL_PASSWORD")) {
    report.failures.push("README.md does not document the Lab 3 setup and local seed-password process.");
  }
  for (const requiredIgnore of ["*.env.test", "server/.test-attachments/", "artifacts/lab-03/playwright-report/"]) {
    if (!gitignore.includes(requiredIgnore)) report.failures.push(`.gitignore is missing required Lab 3 safety rule: ${requiredIgnore}`);
  }
  if (!reviewer.includes("Reviewer verdict") || !reviewer.includes("My review verdict")) {
    report.failures.push("reviewer.md is missing the required verdict sections.");
  }
  if (!reviewer.match(/Formal GitHub \*\*Approve\*\* recorded\s*:/i) && !reviewer.match(/\|\s*Approved\s*\|/i)) {
    report.failures.push("reviewer.md does not record an actual teammate Approve review.");
  }

  const releaseChecklist = tests.slice(tests.indexOf("## 14. Visual and evidence checklist"));
  if (!releaseChecklist || /- \[ \]/.test(releaseChecklist)) {
    report.failures.push("tests.md still has unchecked final release-evidence gates.");
  }
  const releaseTraceabilityRow = tests.split(/\r?\n/).find((line) => line.startsWith("| REL-01 |"));
  if (!releaseTraceabilityRow || !/\bPassed\b/i.test(releaseTraceabilityRow)) {
    report.failures.push("REL-01 is not marked Passed in tests.md.");
  }

  const finalMain = read(root, "docs/lab-03/release-evidence/final-main.md");
  const currentMain = gitCommit(root, ref);
  const finalSha = finalMain.match(/Final main SHA:\s*([0-9a-f]{40})/i)?.[1]?.toLowerCase();
  const releaseBaselineSha = finalMain.match(/Release baseline SHA:\s*`?([0-9a-f]{40})`?/i)?.[1]?.toLowerCase();
  if (!currentMain) {
    report.failures.push(`Git ref '${ref}' is not available for final-main verification.`);
  } else if (finalSha && finalSha !== currentMain.toLowerCase()) {
    report.failures.push(`final-main.md SHA ${finalSha} does not match ${ref} SHA ${currentMain}.`);
  } else if (!finalSha && !releaseBaselineSha) {
    report.failures.push("final-main.md records neither a Final main SHA nor a 40-character Release baseline SHA.");
  } else if (!finalSha && !gitIsAncestor(root, releaseBaselineSha, currentMain)) {
    report.failures.push(`Release baseline SHA ${releaseBaselineSha} is not an ancestor of ${ref} SHA ${currentMain}.`);
  } else if (!finalSha) {
    report.warnings.push("Final main SHA is captured in the student submission PDF; repository audit verified the recorded release baseline is an ancestor of the audited ref.");
  }

  report.ok = report.failures.length === 0;
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const report = auditReleaseEvidence(DEFAULT_ROOT, { ref: process.argv[2] || "HEAD" });
  if (report.ok) {
    console.log(`Lab 3 release audit passed for ${report.ref}.`);
    process.exit(0);
  }
  console.error(`Lab 3 release audit failed for ${report.ref}:`);
  for (const failure of report.failures) console.error(`- ${failure}`);
  process.exit(1);
}
