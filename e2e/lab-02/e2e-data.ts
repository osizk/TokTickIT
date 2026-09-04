import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  assertAllowedE2ESchema,
  assertSafeE2EEnvironment,
} from "./e2e-environment.cjs";

const repositoryDirectory = path.resolve(process.cwd(), "..");
const serverDirectory = path.join(repositoryDirectory, "server");
const requireFromServer = createRequire(path.join(serverDirectory, "package.json"));
const { PrismaClient, Prisma } = requireFromServer("@prisma/client") as {
  PrismaClient: new () => {
    requester: {
      upsert: (args: unknown) => Promise<unknown>;
    };
    category: {
      upsert: (args: unknown) => Promise<unknown>;
    };
    relatedSystem: {
      upsert: (args: unknown) => Promise<unknown>;
    };
    ticket: {
      findMany: (args: unknown) => Promise<Array<{ id: number; attachments: Array<{ storedFilename: string }> }>>;
    };
    attachment: {
      deleteMany: (args: unknown) => Promise<unknown>;
    };
    $transaction: <T>(callback: (transaction: {
      attachment: { deleteMany: (args: unknown) => Promise<{ count: number }> };
      ticket: { deleteMany: (args: unknown) => Promise<{ count: number }> };
    }) => Promise<T>) => Promise<T>;
    $executeRaw: (query: unknown) => Promise<unknown>;
    $disconnect: () => Promise<void>;
  };
  Prisma: {
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => unknown;
  };
};

export const E2E_SUMMARY_PREFIX = "E2E-18-";

const execFileAsync = promisify(execFile);
const npmExecutable = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";
const npmArguments = (args: string[]) => process.platform === "win32"
  ? ["/d", "/s", "/c", `npm.cmd ${args.join(" ")}`]
  : args;

function isolatedDatabaseUrl(): string {
  const currentUrl = process.env.DATABASE_URL;
  const schema = assertAllowedE2ESchema(process.env.PLAYWRIGHT_SCHEMA);
  if (!currentUrl) {
    throw new Error("Playwright isolated database environment is incomplete.");
  }
  const currentEnvironment = assertSafeE2EEnvironment({ baseDatabaseUrl: currentUrl, schemaName: schema });
  const configuredEnvironment = isolatedEnvironment();
  if (currentEnvironment.databaseName !== configuredEnvironment.databaseName) {
    throw new Error("Playwright base and isolated DATABASE_URL values must use the same disposable database.");
  }
  const url = new URL(currentUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}

function isolatedEnvironment(): { baseUrl: string; databaseName: string; schema: string } {
  const baseUrl = process.env.PLAYWRIGHT_BASE_DATABASE_URL;
  const schema = assertAllowedE2ESchema(process.env.PLAYWRIGHT_SCHEMA);
  if (!baseUrl) {
    throw new Error("Playwright isolated database environment is incomplete.");
  }
  const validated = assertSafeE2EEnvironment({ baseDatabaseUrl: baseUrl, schemaName: schema });
  return {
    baseUrl: validated.baseDatabaseUrl,
    databaseName: validated.databaseName,
    schema: validated.schemaName,
  };
}

function schemaIdentifierSql(schema: string): unknown {
  switch (assertAllowedE2ESchema(schema)) {
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

async function createSchema(): Promise<void> {
  const { baseUrl, schema } = isolatedEnvironment();
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = baseUrl;
  const prisma = prismaClient();
  try {
    await prisma.$executeRaw(
      Prisma.sql`CREATE SCHEMA IF NOT EXISTS ${schemaIdentifierSql(schema)}`,
    );
  } finally {
    await prisma.$disconnect();
    process.env.DATABASE_URL = previousUrl;
  }
}

async function runPrismaCommand(command: "prisma:test:migrate" | "prisma:test:seed"): Promise<void> {
  const environment = {
    ...process.env,
    DATABASE_URL: isolatedDatabaseUrl(),
    ATTACHMENT_STORAGE_DIR: storageRoot(),
  } as NodeJS.ProcessEnv;
  await execFileAsync(npmExecutable, npmArguments(["run", command]), {
    cwd: serverDirectory,
    env: environment,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  });
}

export async function ensureIsolatedDatabase(): Promise<void> {
  await createSchema();
  await runPrismaCommand("prisma:test:migrate");
  await runPrismaCommand("prisma:test:seed");
}

export function storageRoot(): string {
  const schema = assertAllowedE2ESchema(process.env.PLAYWRIGHT_SCHEMA);
  return path.resolve(serverDirectory, ".test-attachments", schema);
}

function prismaClient() {
  const currentUrl = process.env.DATABASE_URL;
  const schema = assertAllowedE2ESchema(process.env.PLAYWRIGHT_SCHEMA);
  if (!currentUrl) {
    throw new Error("Playwright isolated database environment is incomplete.");
  }
  const currentEnvironment = assertSafeE2EEnvironment({ baseDatabaseUrl: currentUrl, schemaName: schema });
  const configuredBaseUrl = process.env.PLAYWRIGHT_BASE_DATABASE_URL;
  if (configuredBaseUrl) {
    const configuredEnvironment = assertSafeE2EEnvironment({ baseDatabaseUrl: configuredBaseUrl, schemaName: schema });
    if (currentEnvironment.databaseName !== configuredEnvironment.databaseName) {
      throw new Error("Playwright base and current DATABASE_URL values must use the same disposable database.");
    }
  }
  return new PrismaClient();
}

export async function seedReferenceData(): Promise<void> {
  const prisma = prismaClient();
  try {
    for (const name of ["Account and Access", "Hardware", "Software", "Network"]) {
      await prisma.category.upsert({
        where: { name },
        update: { isActive: true },
        create: { name, isActive: true },
      });
    }
    for (const name of [
      "Campus Wi-Fi",
      "Employee Portal",
      "Email and Calendar",
      "File Storage",
      "Laptop Fleet",
      "Printing Services",
      "VPN Gateway",
    ]) {
      await prisma.relatedSystem.upsert({
        where: { name },
        update: { isActive: true },
        create: { name, isActive: true },
      });
    }
    for (const requester of [
      { name: "Amina Rahman", email: "amina@example.test", isActive: true },
      { name: "Ben Carter", email: "ben@example.test", isActive: true },
      { name: "Chloe Nguyen", email: "chloe@example.test", isActive: true },
      { name: "Davi Santos", email: "davi@example.test", isActive: true },
      { name: "Erin Brooks", email: "erin@example.test", isActive: false },
    ]) {
      await prisma.requester.upsert({
        where: { email: requester.email },
        update: { name: requester.name, isActive: requester.isActive },
        create: requester,
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

export async function cleanupE2eData(): Promise<void> {
  const prisma = prismaClient();
  try {
    const tickets = await prisma.ticket.findMany({
      where: { summary: { startsWith: E2E_SUMMARY_PREFIX } },
      select: { id: true, attachments: { select: { storedFilename: true } } },
    });
    const ticketIds = tickets.map((ticket) => ticket.id);
    const storedFilenames = tickets.flatMap((ticket) => ticket.attachments.map((attachment) => attachment.storedFilename));

    if (ticketIds.length > 0) {
      await prisma.$transaction(async (transaction) => {
        await transaction.attachment.deleteMany({ where: { ticketId: { in: ticketIds } } });
        await transaction.ticket.deleteMany({ where: { id: { in: ticketIds } } });
      });
    }

    const root = storageRoot();
    await mkdir(root, { recursive: true });
    for (const filename of storedFilenames) {
      const resolved = path.resolve(root, filename);
      if (path.dirname(resolved) === root && path.basename(resolved) === filename) {
        await rm(resolved, { force: true });
      }
    }
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name.startsWith(".ticket-")) {
        await rm(path.join(root, entry.name), { recursive: true, force: true });
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

export async function dropIsolatedDatabase(): Promise<void> {
  const baseUrl = process.env.PLAYWRIGHT_BASE_DATABASE_URL;
  const rawSchema = process.env.PLAYWRIGHT_SCHEMA;
  if (!baseUrl && !rawSchema) {
    return;
  }
  const schema = assertAllowedE2ESchema(rawSchema);
  const validated = assertSafeE2EEnvironment({ baseDatabaseUrl: baseUrl, schemaName: schema });
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = validated.baseDatabaseUrl;
  const prisma = prismaClient();
  try {
    await prisma.$executeRaw(
      Prisma.sql`DROP SCHEMA IF EXISTS ${schemaIdentifierSql(schema)} CASCADE`,
    );
  } finally {
    await prisma.$disconnect();
    process.env.DATABASE_URL = previousUrl;
  }
  await rm(storageRoot(), { recursive: true, force: true });
}
