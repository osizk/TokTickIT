import { execFile, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";

const serverDirectory = process.cwd();
const requireFromServer = createRequire(`${serverDirectory}/package.json`);
const { PrismaClient } = requireFromServer("@prisma/client");
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

process.env.DATABASE_URL = baseDatabaseUrl;
const basePrisma = new PrismaClient();
try {
  await basePrisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
} finally {
  await basePrisma.$disconnect();
  process.env.DATABASE_URL = isolatedDatabaseUrl;
}

const childEnvironment = {
  ...process.env,
  DATABASE_URL: isolatedDatabaseUrl,
};
await execFileAsync(npmExecutable, npmArguments(["run", "prisma:migrate"]), {
  cwd: serverDirectory,
  env: childEnvironment,
  windowsHide: true,
  maxBuffer: 4 * 1024 * 1024,
});
await execFileAsync(npmExecutable, npmArguments(["run", "prisma:seed"]), {
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
