const fs = require("node:fs");

const E2E_SCHEMA_ALLOWLIST = Object.freeze([
  "toktickit_e2e",
  "toktickit_release_e2e",
  "toktickit_release_final",
]);

const allowedSchemas = new Set(E2E_SCHEMA_ALLOWLIST);

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};
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

function assertAllowedE2ESchema(schemaValue) {
  const schema = String(schemaValue ?? "").trim();
  if (!allowedSchemas.has(schema)) {
    throw new Error(
      `Playwright schema must be one of: ${E2E_SCHEMA_ALLOWLIST.join(", ")}. Received: ${schema || "<empty>"}.`,
    );
  }
  return schema;
}

function assertDisposableDatabaseUrl(baseDatabaseUrl) {
  if (!baseDatabaseUrl) {
    throw new Error("Database-backed tests require DATABASE_URL in server/.env.test.");
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(baseDatabaseUrl);
  } catch {
    throw new Error("Playwright DATABASE_URL is not a valid PostgreSQL URL.");
  }

  if (databaseUrl.protocol !== "postgres:" && databaseUrl.protocol !== "postgresql:") {
    throw new Error("Playwright DATABASE_URL must use the postgres:// or postgresql:// protocol.");
  }

  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\/+/, ""));
  if (!databaseName || databaseName.includes("/") || !/_test$/i.test(databaseName)) {
    throw new Error(
      `Database-backed tests require a disposable PostgreSQL database whose name ends with _test. Received: ${databaseName || "<empty>"}.`,
    );
  }

  return { baseDatabaseUrl: databaseUrl.toString(), databaseName };
}

function assertSafeE2EEnvironment({ baseDatabaseUrl, schemaName }) {
  const disposableDatabase = assertDisposableDatabaseUrl(baseDatabaseUrl);

  const schema = assertAllowedE2ESchema(schemaName);
  return {
    baseDatabaseUrl: disposableDatabase.baseDatabaseUrl,
    databaseName: disposableDatabase.databaseName,
    schemaName: schema,
  };
}

module.exports = {
  E2E_SCHEMA_ALLOWLIST,
  readEnvFile,
  assertAllowedE2ESchema,
  assertDisposableDatabaseUrl,
  assertSafeE2EEnvironment,
};
