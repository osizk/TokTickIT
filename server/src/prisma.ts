import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";

// Lazy singleton: the client is created on first use, not at import time.
// This keeps route modules and tests that don't touch the DB (e.g. /api/health)
// free of database side effects.
type QueryLogClient = PrismaClient<Prisma.PrismaClientOptions, "query">;
let client: QueryLogClient | null = null;

export function getPrisma(): QueryLogClient {
  if (!client) {
    client = process.env.NODE_ENV === "test"
      ? new PrismaClient<Prisma.PrismaClientOptions, "query">({ log: [{ emit: "event", level: "query" }] })
      : new PrismaClient<Prisma.PrismaClientOptions, "query">();
  }
  return client;
}
