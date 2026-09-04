import { cleanupE2eData, dropIsolatedDatabase } from "./lab-02/e2e-data.js";

export default async function globalTeardown(): Promise<void> {
  await cleanupE2eData();
  await dropIsolatedDatabase();
}
