import { cleanupE2eData, ensureIsolatedDatabase, seedReferenceData } from "./lab-02/e2e-data.js";

export default async function globalSetup(): Promise<void> {
  await ensureIsolatedDatabase();
  await seedReferenceData();
  await cleanupE2eData();
}
