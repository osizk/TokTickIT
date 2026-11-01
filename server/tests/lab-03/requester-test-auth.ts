import request from "supertest";
import { app } from "../../src/app.js";
import { createSession, sessionCookie } from "../../src/auth-service.js";
import { getPrisma } from "../../src/prisma.js";

const fixtureSessionIds = new Map<number, number[]>();
const originalPasswordGates = new Map<number, boolean>();

/** Adapt inherited Lab 2 integration tests to the Lab 3 authenticated session contract. */
export async function loginRequesterByLegacyId(legacyRequesterId: number) {
  const requester = await getPrisma().requester.findUnique({
    where: { id: legacyRequesterId },
    include: { legacyUser: true },
  });
  if (!requester?.legacyUser) {
    throw new Error("A migrated Requester is required for authenticated regression tests.");
  }
  // These inherited Lab 2 suites exercise the already-usable Ticket and
  // Attachment screens. Create their session directly so prior manual password
  // changes in the disposable database cannot break unrelated continuity tests.
  if (!originalPasswordGates.has(legacyRequesterId)) {
    originalPasswordGates.set(legacyRequesterId, requester.legacyUser.mustChangePassword);
  }
  if (requester.legacyUser.mustChangePassword) {
    await getPrisma().user.update({ where: { id: requester.legacyUser.id }, data: { mustChangePassword: false } });
  }
  const { token, csrfToken, session } = await createSession(requester.legacyUser.id);
  const agent = request.agent(app);
  agent.jar.setCookie(sessionCookie(token), "127.0.0.1", "/");
  fixtureSessionIds.set(legacyRequesterId, [...(fixtureSessionIds.get(legacyRequesterId) ?? []), session.id]);
  return { agent, csrfToken, user: requester.legacyUser };
}

export async function loginSeedRequester() {
  const requester = await getPrisma().requester.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: "asc" } });
  return loginRequesterByLegacyId(requester.id);
}

export async function restoreRequesterFirstLogin(legacyRequesterId: number): Promise<void> {
  const requester = await getPrisma().requester.findUnique({ where: { id: legacyRequesterId }, include: { legacyUser: true } });
  if (requester?.legacyUser) {
    const sessionIds = fixtureSessionIds.get(legacyRequesterId) ?? [];
    if (sessionIds.length) {
      await getPrisma().session.deleteMany({ where: { id: { in: sessionIds } } });
      fixtureSessionIds.delete(legacyRequesterId);
    }
    if (originalPasswordGates.has(legacyRequesterId)) {
      await getPrisma().user.update({
        where: { id: requester.legacyUser.id },
        data: { mustChangePassword: originalPasswordGates.get(legacyRequesterId) },
      });
      originalPasswordGates.delete(legacyRequesterId);
    }
  }
}
