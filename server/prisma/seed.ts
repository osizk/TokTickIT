import { getPrisma } from "../src/prisma.js";

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
  });

  console.log(
    `Seeded ${categories.length} categories, ${relatedSystems.length} related systems, and ${requesters.length} requesters.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
