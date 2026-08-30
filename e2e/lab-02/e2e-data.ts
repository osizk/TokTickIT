import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const repositoryDirectory = path.resolve(process.cwd(), "..");
const serverDirectory = path.join(repositoryDirectory, "server");
const requireFromServer = createRequire(path.join(serverDirectory, "package.json"));
const { PrismaClient } = requireFromServer("@prisma/client") as {
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
    $executeRawUnsafe: (query: string) => Promise<unknown>;
    $disconnect: () => Promise<void>;
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
  const schema = process.env.PLAYWRIGHT_SCHEMA;
  if (!currentUrl || !schema) {
    throw new Error("Playwright isolated database environment is incomplete.");
  }
  const url = new URL(currentUrl);
  url.searchParams.set("schema", schema);
  return url.toString();
}

async function createSchema(): Promise<void> {
  const baseUrl = process.env.PLAYWRIGHT_BASE_DATABASE_URL;
  const schema = process.env.PLAYWRIGHT_SCHEMA;
  if (!baseUrl || !schema) {
    throw new Error("Playwright isolated database environment is incomplete.");
  }
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = baseUrl;
  const prisma = prismaClient();
  try {
    await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  } finally {
    await prisma.$disconnect();
    process.env.DATABASE_URL = previousUrl;
  }
}

async function runPrismaCommand(command: "prisma:migrate" | "prisma:seed"): Promise<void> {
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
  await runPrismaCommand("prisma:migrate");
  await runPrismaCommand("prisma:seed");
}

export function storageRoot(): string {
  return path.resolve(
    serverDirectory,
    process.env.ATTACHMENT_STORAGE_DIR?.trim() || ".test-attachments",
  );
}

function prismaClient() {
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
  const schema = process.env.PLAYWRIGHT_SCHEMA;
  if (!baseUrl || !schema) {
    return;
  }
  const previousUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = baseUrl;
  const prisma = prismaClient();
  try {
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await prisma.$disconnect();
    process.env.DATABASE_URL = previousUrl;
  }
  await rm(storageRoot(), { recursive: true, force: true });
}
