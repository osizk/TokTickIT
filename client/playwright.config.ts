import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clientDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryDir = path.resolve(clientDir, "..");
const serverDir = path.join(repositoryDir, "server");

// Playwright loads specs from the repository-level e2e directory. Add the
// client dependency directory to Node's lookup paths so specs can use the
// normal package imports even though the repository has no root package.json.
process.env.NODE_PATH = path.join(clientDir, "node_modules");
(Module as typeof Module & { _initPaths?: () => void })._initPaths?.();

function readEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator < 1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

const fileEnv = {
  ...readEnvFile(path.join(serverDir, ".env")),
  ...readEnvFile(path.join(serverDir, ".env.test")),
};
const baseDatabaseUrl = process.env.PLAYWRIGHT_DATABASE_URL ?? fileEnv.DATABASE_URL;
if (!baseDatabaseUrl) {
  throw new Error("Playwright requires DATABASE_URL in server/.env.test, server/.env, or PLAYWRIGHT_DATABASE_URL.");
}
// Playwright loads this config in the runner, global-setup, web-server, and
// worker processes. Use one stable isolated schema unless the caller supplies
// a schema explicitly, so every process points at the same migrated database.
const schemaName = process.env.PLAYWRIGHT_SCHEMA ?? "toktickit_e2e";
const isolatedDatabaseUrl = new URL(baseDatabaseUrl);
isolatedDatabaseUrl.searchParams.set("schema", schemaName);
const e2eStorageDir = path.resolve(serverDir, ".test-attachments", schemaName);
const serverEnv: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  ),
  ...fileEnv,
  DATABASE_URL: isolatedDatabaseUrl.toString(),
  PLAYWRIGHT_BASE_DATABASE_URL: baseDatabaseUrl,
  PLAYWRIGHT_SCHEMA: schemaName,
  PORT: process.env.PLAYWRIGHT_API_PORT ?? "3000",
  ATTACHMENT_STORAGE_DIR: e2eStorageDir,
};

// Make the same resolved values available to global setup/teardown and tests.
Object.assign(process.env, serverEnv, {
  PLAYWRIGHT_API_URL: process.env.PLAYWRIGHT_API_URL ?? `http://127.0.0.1:${serverEnv.PORT}`,
  PLAYWRIGHT_RUN_TAG: process.env.PLAYWRIGHT_RUN_TAG ?? `E2E-18-${Date.now()}`,
});

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "../e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", {
      outputFolder: path.resolve(repositoryDir, "artifacts/lab-02/playwright-report"),
      open: "never",
    }],
  ],
  globalSetup: path.resolve(repositoryDir, "e2e/global-setup.ts"),
  globalTeardown: path.resolve(repositoryDir, "e2e/global-teardown.ts"),
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 900, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
      },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : [
        {
          command: "npm.cmd run dev -- --host 127.0.0.1",
          cwd: clientDir,
          url: "http://127.0.0.1:5173",
          // Always start the server with the isolated E2E environment. Reusing
          // a developer server can silently send test data to the real schema.
          reuseExistingServer: false,
          env: {
            ...serverEnv,
            VITE_API_URL: process.env.PLAYWRIGHT_API_URL ?? `http://127.0.0.1:${serverEnv.PORT}`,
          },
        },
        {
          command: "node ../e2e/server-bootstrap.mjs",
          cwd: serverDir,
          url: `${process.env.PLAYWRIGHT_API_URL ?? `http://127.0.0.1:${serverEnv.PORT}`}/api/health`,
          reuseExistingServer: false,
          env: serverEnv,
        },
      ],
});
