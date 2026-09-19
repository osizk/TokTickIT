import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

/**
 * Adapt inherited Lab 2 integration tests to the Lab 3 authenticated session
 * contract. The password is supplied only by the disposable test environment;
 * it is never committed or written into a test file.
 */
export async function loginRequesterByLegacyId(legacyRequesterId: number) {
  const requester = await getPrisma().requester.findUnique({
    where: { id: legacyRequesterId },
    include: { legacyUser: true },
  });
  const password = process.env.LAB3_REQUESTER_INITIAL_PASSWORD;
  if (!requester?.legacyUser || !password) {
    throw new Error("A migrated Requester and LAB3_REQUESTER_INITIAL_PASSWORD are required for authenticated regression tests.");
  }
  // These inherited Lab 2 suites exercise the already-usable Ticket and
  // Attachment screens. The dedicated Lab 3 auth tests cover the first-login
  // gate; mark this disposable fixture as having completed that gate so the
  // continuity assertions reach the protected resource handlers.
  if (requester.legacyUser.mustChangePassword) {
    await getPrisma().user.update({ where: { id: requester.legacyUser.id }, data: { mustChangePassword: false } });
  }
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/login").send({ email: requester.legacyUser.email, password });
  if (response.status !== 200) {
    throw new Error(`Unable to authenticate inherited Requester test fixture (HTTP ${response.status}).`);
  }
  return { agent, csrfToken: response.body.csrfToken as string, user: requester.legacyUser };
}

export async function loginSeedRequester() {
  const requester = await getPrisma().requester.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
  return loginRequesterByLegacyId(requester.id);
}

export async function restoreRequesterFirstLogin(legacyRequesterId: number): Promise<void> {
  const requester = await getPrisma().requester.findUnique({ where: { id: legacyRequesterId }, include: { legacyUser: true } });
  if (requester?.legacyUser) {
    await getPrisma().user.update({ where: { id: requester.legacyUser.id }, data: { mustChangePassword: true } });
  }
}
