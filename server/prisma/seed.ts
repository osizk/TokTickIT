import { getPrisma } from "../src/prisma.js";
import { hashPassword } from "../src/auth-service.js";
import { validatePassword } from "../src/auth-validation.js";
import type { Prisma } from "@prisma/client";

const categories = [
  "Account and Access",
  "Hardware",
  "Software",
  "Network",
];

const relatedSystems = [
  "Campus Wi-Fi",
  "Employee Portal",
  "Email and Calendar",
  "File Storage",
  "Laptop Fleet",
  "Printing Services",
  "VPN Gateway",
];

const requesters = [
  { name: "Amina Rahman", email: "amina@example.test", isActive: true },
  { name: "Ben Carter", email: "ben@example.test", isActive: true },
  { name: "Chloe Nguyen", email: "chloe@example.test", isActive: true },
  { name: "Davi Santos", email: "davi@example.test", isActive: true },
  { name: "Erin Brooks", email: "erin@example.test", isActive: false },
];

async function main() {
  const prisma = getPrisma();
  const requesterPassword = requireSeedPassword("LAB3_REQUESTER_INITIAL_PASSWORD");
  const staffPassword = requireSeedPassword("LAB3_IT_STAFF_INITIAL_PASSWORD");
  const adminPassword = requireSeedPassword("LAB3_ADMIN_INITIAL_PASSWORD");
  const passwordHashes = new Map<string, string>();
  const passwordHashFor = async (password: string) => {
    const cached = passwordHashes.get(password);
    if (cached) return cached;
    const hash = await hashPassword(password);
    passwordHashes.set(password, hash);
    return hash;
  };

  await prisma.$transaction(async (tx) => {
    for (const name of categories) {
      await tx.category.upsert({
        where: { name },
        update: { isActive: true },
        create: { name, isActive: true },
      });
    }

    for (const name of relatedSystems) {
      await tx.relatedSystem.upsert({
        where: { name },
        update: { isActive: true },
        create: { name, isActive: true },
      });
    }

    for (const requester of requesters) {
      await tx.requester.upsert({
        where: { email: requester.email },
        update: { name: requester.name, isActive: requester.isActive },
        create: requester,
      });
    }

    // Credentials are backfilled for every legacy Requester row, not only the
    // five deterministic fixtures above. This keeps Requesters created during
    // Lab 2 usable after the identity migration while ensureUser preserves any
    // existing password hash and completed first-login flag.
    const allRequesters = await tx.requester.findMany({
      select: { id: true, name: true, email: true, isActive: true },
      orderBy: { id: "asc" },
    });
    for (const source of allRequesters) {
      await ensureUser(tx, {
        name: source.name,
        email: source.email,
        role: "REQUESTER",
        isActive: source.isActive,
        legacyRequesterId: source.id,
        passwordHash: await passwordHashFor(requesterPassword),
      });
    }

    // Explicitly preserved legacy IDs can be higher than PostgreSQL's
    // sequence value. Synchronize it before creating role fixtures so an
    // auto-generated staff/admin ID cannot collide with those preserved rows.
    const highestUser = await tx.user.aggregate({ _max: { id: true } });
    await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('"User"', 'id'), COALESCE(${highestUser._max.id ?? 1}, 1), true)`;

    for (const staff of staffUsers) {
      await ensureUser(tx, {
        name: staff.name,
        email: staff.email,
        role: "IT_STAFF",
        isActive: staff.isActive,
        passwordHash: await passwordHashFor(staffPassword),
      });
    }

    await ensureUser(tx, {
      name: "TokTickIT Administrator",
      email: "admin@example.test",
      role: "ADMINISTRATOR",
      isActive: true,
      passwordHash: await passwordHashFor(adminPassword),
    });
  });

  const totalRequesters = await prisma.requester.count();
  console.log(
    `Seeded ${categories.length} categories, ${relatedSystems.length} related systems, and ${totalRequesters} requesters; all existing Requesters received idempotent credential backfill.`,
  );
}

const staffUsers = [
  { name: "Michael Brown", email: "michael.staff@example.test", isActive: true },
  { name: "Priya Shah", email: "priya.staff@example.test", isActive: true },
  { name: "Jon Bell", email: "jon.staff@example.test", isActive: true },
  { name: "Inactive Staff", email: "inactive.staff@example.test", isActive: false },
];

function requireSeedPassword(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set locally before running the Lab 3 seed; never commit the value.`);
  }
  const validation = validatePassword(value);
  if (!validation.ok) {
    throw new Error(`${name} does not meet the Lab 3 password policy: ${validation.message}`);
  }
  return value;
}

type SeedUser = {
  id?: number;
  name: string;
  email: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  isActive: boolean;
  legacyRequesterId?: number;
  passwordHash: string;
};

async function ensureUser(tx: Prisma.TransactionClient, user: SeedUser) {
  // A migrated Requester may later have a User email edited by an
  // Administrator. Prefer the immutable legacy link so a rerun cannot create
  // a second User or overwrite that user-managed email.
  const existing = user.legacyRequesterId
    ? await tx.user.findUnique({ where: { legacyRequesterId: user.legacyRequesterId } })
    : await tx.user.findUnique({ where: { email: user.email } });
  if (!existing) {
    const data = {
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      passwordHash: user.passwordHash,
      mustChangePassword: true,
      ...(user.legacyRequesterId ? { legacyRequesterId: user.legacyRequesterId } : {}),
    };
    // Preserve the legacy integer identity whenever the target User id is
    // free. A later-created Requester can collide with an unrelated User;
    // inspect first instead of provoking a failed INSERT inside the current
    // transaction (PostgreSQL would mark that transaction aborted).
    const occupiedId = user.legacyRequesterId
      ? await tx.user.findUnique({ where: { id: user.legacyRequesterId }, select: { id: true } })
      : null;
    await tx.user.create({ data: { ...(!occupiedId && user.legacyRequesterId ? { id: user.legacyRequesterId } : {}), ...data } });
    return;
  }
  // Only a pending-credential row may receive the configured initial hash.
  // Existing names, roles, activation flags, and changed credentials remain intact.
  if (existing.passwordHash === null) {
    await tx.user.update({
      where: { id: existing.id },
      data: { passwordHash: user.passwordHash, mustChangePassword: true },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
