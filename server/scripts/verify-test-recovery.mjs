import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { assertDisposableDatabaseUrl, readEnvFile } = require("../../e2e/lab-02/e2e-environment.cjs");
const testEnv = readEnvFile(path.join(serverDirectory, ".env.test"));
const { baseDatabaseUrl, databaseName } = assertDisposableDatabaseUrl(testEnv.DATABASE_URL);
const databaseUrl = new URL(baseDatabaseUrl);
databaseUrl.searchParams.set("schema", "public");
const schemaName = `toktickit_lab4_recovery_test_${process.pid}_${Date.now()}`;
assert.match(schemaName, /^toktickit_lab4_recovery_test_\d+_\d+$/);
const scratchUrl = new URL(databaseUrl);
scratchUrl.searchParams.set("schema", schemaName);
const childEnv = { ...process.env, ...testEnv, DATABASE_URL: scratchUrl.toString() };
const pgEnv = {
  ...process.env,
  PGHOST: databaseUrl.hostname,
  PGPORT: databaseUrl.port || "5432",
  PGDATABASE: databaseName,
  PGUSER: decodeURIComponent(databaseUrl.username),
  PGPASSWORD: decodeURIComponent(databaseUrl.password),
};
const execute = promisify(execFile);
const run = (command, args, env) => execute(command, args, {
  cwd: serverDirectory, env, windowsHide: true, maxBuffer: 10 * 1024 * 1024,
});

// Check PostgreSQL tooling before creating any disposable data.
await run("pg_dump", ["--version"], pgEnv);
await run("pg_restore", ["--version"], pgEnv);
const admin = new PrismaClient({ datasources: { db: { url: databaseUrl.toString() } } });
let scratch = new PrismaClient({ datasources: { db: { url: scratchUrl.toString() } } });
let temporaryDirectory;
let storageDirectory;
let schemaCreated = false;

async function snapshot() {
  const tables = await scratch.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = ${schemaName} AND table_type = 'BASE TABLE' ORDER BY table_name
  `;
  const rows = [];
  for (const { table_name: table } of tables) {
    assert.match(table, /^[A-Za-z_][A-Za-z0-9_]*$/);
    const [fingerprint] = await scratch.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS count, md5(coalesce(string_agg(row_to_json(t)::text, '' ORDER BY row_to_json(t)::text), '')) AS digest FROM "${schemaName}"."${table}" t`,
    );
    rows.push({ table, ...fingerprint });
  }
  const sequences = await scratch.$queryRaw`
    SELECT sequencename, last_value::text FROM pg_sequences WHERE schemaname = ${schemaName} ORDER BY sequencename
  `;
  return { rows, sequences };
}

try {
  console.log(`Recovery target: disposable schema ${schemaName} in ${databaseName}; existing schemas are untouched.`);
  temporaryDirectory = await mkdtemp(path.join(tmpdir(), "toktickit-recovery-"));
  const protectedStorage = path.join(serverDirectory, ".test-attachments");
  await mkdir(protectedStorage, { recursive: true });
  storageDirectory = await mkdtemp(path.join(protectedStorage, "recovery-"));
  childEnv.ATTACHMENT_STORAGE_DIR = storageDirectory;
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
  schemaCreated = true;
  await run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], childEnv);
  await run(process.execPath, ["--import", "tsx", "prisma/seed.ts"], childEnv);
  const year = new Date().getUTCFullYear();
  const fixtureNumber = `TKT-${year}-910002`;
  const fixture = await scratch.ticket.findUniqueOrThrow({ where: { ticketNumber: fixtureNumber } });
  await scratch.ticket.update({ where: { id: fixture.id }, data: { summary: "Locally edited seed-collision fixture" } });
  const graphBefore = await scratch.ticket.findUniqueOrThrow({ where: { id: fixture.id }, include: { actionsTaken: { include: { revisions: true } } } });
  const counter = await scratch.ticketCounter.findUniqueOrThrow({ where: { year } });
  const higherCounter = counter.lastIssued + 17;
  await scratch.ticketCounter.update({ where: { year }, data: { lastIssued: higherCounter } });
  await run(process.execPath, ["--import", "tsx", "prisma/seed.ts"], childEnv);
  assert.deepEqual(await scratch.ticket.findUniqueOrThrow({ where: { id: fixture.id }, include: { actionsTaken: { include: { revisions: true } } } }), graphBefore);
  assert.equal((await scratch.ticketCounter.findUniqueOrThrow({ where: { year } })).lastIssued, higherCounter);
  console.log("PASS: repeated seed preserves an edited reserved-number graph and never lowers a counter above the highest Ticket.");
  const ticket = await scratch.ticket.findFirstOrThrow({ orderBy: { id: "asc" } });
  const bytes = Buffer.from("%PDF-1.7\nDisposable recovery evidence\n");
  const storedFilename = randomUUID();
  const filePath = path.join(storageDirectory, storedFilename);
  const backupFile = path.join(temporaryDirectory, "attachment-backup.pdf");
  await writeFile(filePath, bytes);
  await scratch.attachment.create({ data: {
    ticketId: ticket.id, originalName: "recovery-evidence.pdf", storedFilename,
    mimeType: "application/pdf", sizeBytes: bytes.length,
  } });
  const before = await snapshot();
  const dumpPath = path.join(temporaryDirectory, "schema.dump");
  await run("pg_dump", ["--format=custom", `--schema=${schemaName}`, "--no-owner", "--no-privileges", `--file=${dumpPath}`], pgEnv);
  await copyFile(filePath, backupFile);
  await scratch.ticket.update({ where: { id: ticket.id }, data: { summary: "Disposable failure rehearsal" } });
  await writeFile(filePath, "simulated damaged file");
  assert.notDeepEqual(await snapshot(), before);
  await scratch.$disconnect();
  await admin.$executeRawUnsafe(`DROP SCHEMA "${schemaName}" CASCADE`);
  await run("pg_restore", ["--exit-on-error", "--no-owner", "--no-privileges", `--dbname=${databaseName}`, dumpPath], pgEnv);
  await copyFile(backupFile, filePath);
  scratch = new PrismaClient({ datasources: { db: { url: scratchUrl.toString() } } });
  assert.deepEqual(await snapshot(), before);
  assert.deepEqual(await readFile(filePath), bytes);
  console.log(`PASS: restored all ${before.rows.length} tables, row fingerprints, IDs, credential flags/hashes, audit rows, counters, and sequences.`);
  console.log("PASS: restored protected attachment bytes match the backed-up metadata/file.");
} finally {
  await scratch.$disconnect();
  try {
    if (schemaCreated) await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  } finally {
    await admin.$disconnect();
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
    if (storageDirectory) await rm(storageDirectory, { recursive: true, force: true });
  }
}
console.log("PASS: disposable recovery schema, backup, and test storage cleaned.");
