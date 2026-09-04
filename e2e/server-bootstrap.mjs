import { execFile, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { assertAllowedE2ESchema, assertSafeE2EEnvironment } from "./lab-02/e2e-environment.cjs";

const serverDirectory = process.cwd();
const requireFromServer = createRequire(`${serverDirectory}/package.json`);
const { PrismaClient, Prisma } = requireFromServer("@prisma/client");
const execFileAsync = promisify(execFile);
const npmExecutable = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";
const npmArguments = (args) => process.platform === "win32"
  ? ["/d", "/s", "/c", `npm.cmd ${args.join(" ")}`]
  : args;
const baseDatabaseUrl = process.env.PLAYWRIGHT_BASE_DATABASE_URL;
const isolatedDatabaseUrl = process.env.DATABASE_URL;
const schema = process.env.PLAYWRIGHT_SCHEMA;

if (!baseDatabaseUrl || !isolatedDatabaseUrl || !schema) {
  throw new Error("Playwright isolated database environment is incomplete.");
}
const validatedBaseEnvironment = assertSafeE2EEnvironment({ baseDatabaseUrl, schemaName: schema });
const validatedIsolatedEnvironment = assertSafeE2EEnvironment({ baseDatabaseUrl: isolatedDatabaseUrl, schemaName: schema });
if (validatedBaseEnvironment.databaseName !== validatedIsolatedEnvironment.databaseName) {
  throw new Error("Playwright base and isolated DATABASE_URL values must use the same disposable database.");
}
const safeIsolatedDatabaseUrl = new URL(validatedIsolatedEnvironment.baseDatabaseUrl);
safeIsolatedDatabaseUrl.searchParams.set("schema", validatedBaseEnvironment.schemaName);

function schemaIdentifierSql(schemaValue) {
  switch (assertAllowedE2ESchema(schemaValue)) {
    case "toktickit_e2e":
      return Prisma.sql`"toktickit_e2e"`;
    case "toktickit_release_e2e":
      return Prisma.sql`"toktickit_release_e2e"`;
    case "toktickit_release_final":
      return Prisma.sql`"toktickit_release_final"`;
    default:
      throw new Error("Playwright schema is not mapped to a static SQL identifier.");
  }
}

process.env.DATABASE_URL = validatedBaseEnvironment.baseDatabaseUrl;
const basePrisma = new PrismaClient();
try {
  await basePrisma.$executeRaw(
    Prisma.sql`CREATE SCHEMA IF NOT EXISTS ${schemaIdentifierSql(validatedBaseEnvironment.schemaName)}`,
  );
} finally {
  await basePrisma.$disconnect();
  process.env.DATABASE_URL = safeIsolatedDatabaseUrl.toString();
}

const childEnvironment = {
  ...process.env,
  DATABASE_URL: safeIsolatedDatabaseUrl.toString(),
};
await execFileAsync(npmExecutable, npmArguments(["run", "prisma:test:migrate"]), {
  cwd: serverDirectory,
  env: childEnvironment,
  windowsHide: true,
  maxBuffer: 4 * 1024 * 1024,
});
await execFileAsync(npmExecutable, npmArguments(["run", "prisma:test:seed"]), {
  cwd: serverDirectory,
  env: childEnvironment,
  windowsHide: true,
  maxBuffer: 4 * 1024 * 1024,
});

const server = spawn(npmExecutable, npmArguments(["run", "dev"]), {
  cwd: serverDirectory,
  env: childEnvironment,
  windowsHide: true,
});
server.stdout?.pipe(process.stdout);
server.stderr?.pipe(process.stderr);

const stopServer = () => {
  if (!server.killed) {
    server.kill();
  }
};
process.on("SIGINT", stopServer);
process.on("SIGTERM", stopServer);
process.on("exit", stopServer);

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.once("exit", (code, signal) => {
    if (code === 0 || signal === "SIGINT" || signal === "SIGTERM") {
      resolve(undefined);
      return;
    }
    reject(new Error(`TokTickIT API exited with code ${code ?? signal ?? "unknown"}.`));
  });
});
