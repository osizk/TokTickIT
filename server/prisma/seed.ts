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

const queueTicketFixtures = [
  { requesterEmail: "amina@example.test", category: "Account and Access", relatedSystem: "Employee Portal", requestedPriority: "LOW", itPriority: "MEDIUM", status: "NEW", ownerEmail: null, summary: "New starter cannot access the employee portal", description: "A new starter needs access to the employee portal before their first day." },
  { requesterEmail: "ben@example.test", category: "Hardware", relatedSystem: "Laptop Fleet", requestedPriority: "MEDIUM", itPriority: "HIGH", status: "OPEN", ownerEmail: "michael.staff@example.test", summary: "Laptop battery drains during meetings", description: "The assigned laptop battery lasts less than one hour during normal meetings." },
  { requesterEmail: "chloe@example.test", category: "Software", relatedSystem: "Email and Calendar", requestedPriority: "HIGH", itPriority: "URGENT", status: "IN_PROGRESS", ownerEmail: "priya.staff@example.test", summary: "Calendar invitations are not arriving", description: "Calendar invitations from external partners do not appear in the requester mailbox." },
  { requesterEmail: "davi@example.test", category: "Network", relatedSystem: "Campus Wi-Fi", requestedPriority: "URGENT", itPriority: "URGENT", status: "WAITING_FOR_REQUESTER", ownerEmail: "jon.staff@example.test", summary: "Wi-Fi disconnects in the west building", description: "The wireless connection disconnects repeatedly near the west-building lecture rooms." },
  { requesterEmail: "amina@example.test", category: "Account and Access", relatedSystem: "VPN Gateway", requestedPriority: "LOW", itPriority: "LOW", status: "RESOLVED", ownerEmail: "michael.staff@example.test", summary: "VPN access was unavailable after a password change", description: "The requester could not connect to the VPN after changing their account password." },
  { requesterEmail: "ben@example.test", category: "Hardware", relatedSystem: "Printing Services", requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "CLOSED", ownerEmail: "priya.staff@example.test", summary: "Printer queue stalled on level two", description: "Documents remained in the level-two printer queue until the queue service was restarted." },
  { requesterEmail: "chloe@example.test", category: "Software", relatedSystem: "File Storage", requestedPriority: "HIGH", itPriority: "HIGH", status: "REOPENED", ownerEmail: "michael.staff@example.test", summary: "Shared folder permissions need another review", description: "Access returned briefly, but the requester still cannot open the shared project folder." },
  { requesterEmail: "davi@example.test", category: "Network", relatedSystem: "Campus Wi-Fi", requestedPriority: "URGENT", itPriority: "HIGH", status: "CANCELLED", ownerEmail: null, summary: "Temporary guest network request", description: "The temporary guest network request is no longer needed for the scheduled event." },
  { requesterEmail: "amina@example.test", category: "Hardware", relatedSystem: "Laptop Fleet", requestedPriority: "MEDIUM", itPriority: "LOW", status: "NEW", ownerEmail: "jon.staff@example.test", summary: "External monitor is not detected", description: "The docking station powers on, but the connected external monitor is not detected." },
  { requesterEmail: "ben@example.test", category: "Software", relatedSystem: "File Storage", requestedPriority: "LOW", itPriority: "MEDIUM", status: "OPEN", ownerEmail: null, summary: "File upload remains pending", description: "A small document upload remains pending in the file-storage web application." },
  { requesterEmail: "chloe@example.test", category: "Account and Access", relatedSystem: "VPN Gateway", requestedPriority: "HIGH", itPriority: "URGENT", status: "IN_PROGRESS", ownerEmail: "priya.staff@example.test", summary: "VPN client asks for credentials repeatedly", description: "The VPN client asks for credentials again after the requester has already signed in." },
  { requesterEmail: "davi@example.test", category: "Network", relatedSystem: "Campus Wi-Fi", requestedPriority: "URGENT", itPriority: "URGENT", status: "WAITING_FOR_REQUESTER", ownerEmail: "michael.staff@example.test", summary: "Wireless signal report requested", description: "The queue owner is waiting for the requester to confirm the affected room and time." },
] as const;

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

  let createdQueueTickets = 0;

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

    const [requesterRows, categoryRows, relatedSystemRows, ownerRows] = await Promise.all([
      tx.requester.findMany({ where: { email: { in: requesters.map(({ email }) => email) } } }),
      tx.category.findMany({ where: { name: { in: categories } } }),
      tx.relatedSystem.findMany({ where: { name: { in: relatedSystems } } }),
      tx.user.findMany({ where: { email: { in: staffUsers.map(({ email }) => email) } }, select: { id: true, email: true } }),
    ]);
    const requesterByEmail = new Map(requesterRows.map((row) => [row.email, row]));
    const categoryByName = new Map(categoryRows.map((row) => [row.name, row]));
    const relatedSystemByName = new Map(relatedSystemRows.map((row) => [row.name, row]));
    const ownerByEmail = new Map(ownerRows.map((row) => [row.email, row]));
    const seedYear = new Date().getUTCFullYear();

    for (const [index, fixture] of queueTicketFixtures.entries()) {
      const ticketNumber = `TKT-${seedYear}-${String(900001 + index).padStart(6, "0")}`;
      const existing = await tx.ticket.findUnique({ where: { ticketNumber }, select: { id: true } });
      if (existing) continue;

      const requester = requesterByEmail.get(fixture.requesterEmail);
      const category = categoryByName.get(fixture.category);
      const relatedSystem = relatedSystemByName.get(fixture.relatedSystem);
      const ticketOwner = fixture.ownerEmail ? ownerByEmail.get(fixture.ownerEmail) : undefined;
      if (!requester || !category || !relatedSystem || (fixture.ownerEmail && !ticketOwner)) {
        throw new Error(`Unable to create queue seed Ticket ${ticketNumber}: required reference data is missing.`);
      }

      const createdAt = new Date(Date.UTC(seedYear, index % 12, 5 + (index % 20), 9 + (index % 8), index % 60));
      const updatedAt = new Date(createdAt.getTime() + (index + 1) * 60 * 60 * 1000);
      await tx.ticket.create({
        data: {
          ticketNumber,
          requesterId: requester.id,
          categoryId: category.id,
          relatedSystemId: relatedSystem.id,
          requestedPriority: fixture.requestedPriority,
          itPriority: fixture.itPriority,
          status: fixture.status,
          summary: fixture.summary,
          description: fixture.description,
          ticketOwnerId: ticketOwner?.id ?? null,
          createdAt,
          updatedAt,
        },
      });
      createdQueueTickets += 1;
    }

    // Keep annual allocation above both the deterministic fixtures and any
    // existing current-year Ticket. This is monotonic and never rewrites a
    // user's Ticket or counter to a lower value.
    const currentYearTickets = await tx.ticket.findMany({
      where: { ticketNumber: { startsWith: `TKT-${seedYear}-` } },
      select: { ticketNumber: true },
    });
    const highestIssued = currentYearTickets.reduce((highest, ticket) => {
      const match = /^TKT-\d{4}-(\d{6})$/.exec(ticket.ticketNumber);
      const issued = match ? Number(match[1]) : 0;
      return Number.isSafeInteger(issued) ? Math.max(highest, issued) : highest;
    }, 0);
    await tx.$executeRaw`
      INSERT INTO "TicketCounter" ("year", "lastIssued", "createdAt", "updatedAt")
      VALUES (${seedYear}, ${highestIssued}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("year") DO UPDATE
      SET "lastIssued" = GREATEST("TicketCounter"."lastIssued", EXCLUDED."lastIssued"),
          "updatedAt" = CURRENT_TIMESTAMP
    `;
  });

  const [totalRequesters, totalTickets] = await Promise.all([
    prisma.requester.count(),
    prisma.ticket.count(),
  ]);
  console.log(
    `Seeded ${categories.length} categories, ${relatedSystems.length} related systems, and ${totalRequesters} requesters; ensured ${totalTickets} Tickets (${createdQueueTickets} created this run); all existing Requesters received idempotent credential backfill.`,
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
