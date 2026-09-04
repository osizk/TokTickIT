import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testEnvPath = path.join(serverDirectory, ".env.test");
const protectedStorageRoot = path.resolve(serverDirectory, ".test-attachments");
const requireFromServer = createRequire(path.join(serverDirectory, "package.json"));
const {
  assertDisposableDatabaseUrl,
  readEnvFile,
} = requireFromServer("../e2e/lab-02/e2e-environment.cjs");

const command = process.argv[2];
const commandArguments = command === "migrate"
  ? ["migrate", "deploy"]
  : command === "seed"
    ? ["db", "seed"]
    : null;

if (!commandArguments) {
  throw new Error("Use only `migrate` or `seed` with the Lab 2 test Prisma runner.");
}
if (!fs.existsSync(testEnvPath)) {
  throw new Error(`Prisma test commands require ${testEnvPath}. Copy server/.env.test.example first.`);
}

const testEnv = readEnvFile(testEnvPath);
const configuredDatabase = assertDisposableDatabaseUrl(testEnv.DATABASE_URL);
let databaseUrl = configuredDatabase.baseDatabaseUrl;
if (process.env.DATABASE_URL) {
  const requestedDatabase = assertDisposableDatabaseUrl(process.env.DATABASE_URL);
  if (requestedDatabase.databaseName !== configuredDatabase.databaseName) {
    throw new Error("The requested Prisma test database must match the database configured in server/.env.test.");
  }
  databaseUrl = requestedDatabase.baseDatabaseUrl;
}

const requestedStorage = process.env.ATTACHMENT_STORAGE_DIR?.trim() || testEnv.ATTACHMENT_STORAGE_DIR?.trim() || ".test-attachments";
const storageDirectory = path.resolve(serverDirectory, requestedStorage);
if (storageDirectory !== protectedStorageRoot && !storageDirectory.startsWith(`${protectedStorageRoot}${path.sep}`)) {
  throw new Error(`Prisma test ATTACHMENT_STORAGE_DIR must be inside ${protectedStorageRoot}.`);
}

const npmExecutable = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";
const npmArguments = (args) => process.platform === "win32"
  ? ["/d", "/s", "/c", `npm.cmd ${args.join(" ")}`]
  : args;

console.log(`Using server/.env.test for Prisma ${command} against database ${configuredDatabase.databaseName}.`);
const child = spawn(npmExecutable, npmArguments(["exec", "--", "prisma", ...commandArguments]), {
  cwd: serverDirectory,
  env: {
    ...process.env,
    ...testEnv,
    DATABASE_URL: databaseUrl,
    ATTACHMENT_STORAGE_DIR: storageDirectory,
  },
  stdio: "inherit",
  windowsHide: true,
});

child.on("error", (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
