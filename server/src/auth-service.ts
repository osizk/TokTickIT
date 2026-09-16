import argon2 from "argon2";
import crypto from "node:crypto";
import type { Request } from "express";
import type { Session, User } from "@prisma/client";
import { getPrisma } from "./prisma.js";

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export const AUTH_COOKIE_NAME = "toktickit_session";
export const IDLE_SESSION_MS = 30 * 60 * 1000;
export const ABSOLUTE_SESSION_MS = 8 * 60 * 60 * 1000;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_BLOCK_MS = 15 * 60 * 1000;
export const LOGIN_FAILURE_LIMIT = 5;

export type SafeUser = Pick<User, "id" | "name" | "email" | "role" | "isActive" | "mustChangePassword">;

export class AuthError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;

  constructor(statusCode: number, code: string, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export interface AuthContext {
  session: Session;
  user: User;
  token: string;
}

export function safeUser(user: User): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
  };
}

export function hashToken(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function createOpaqueToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string | null | undefined, password: string): Promise<boolean> {
  if (!hash) return false;
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

let dummyHashPromise: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword("TokTickIT-invalid-login-dummy-2026!");
  return dummyHashPromise;
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").flatMap((part) => {
      const separator = part.indexOf("=");
      if (separator < 0) return [];
      const key = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      if (!key) return [];
      try {
        return [[key, decodeURIComponent(value)] as const];
      } catch {
        return [];
      }
    }),
  );
}

export function getSessionToken(req: Request): string | undefined {
  return parseCookies(req.headers.cookie)[AUTH_COOKIE_NAME];
}

export function sessionCookie(token: string, maxAgeSeconds = Math.floor(ABSOLUTE_SESSION_MS / 1000)): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax; Path=/${secure}`;
}

export function expiredSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${AUTH_COOKIE_NAME}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax; Path=/${secure}`;
}

function sourceAddress(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function loginAttemptKey(email: string, source: string): string {
  return hashToken(`${email}\u0000${source}`);
}

async function getRateBucket(keyHash: string) {
  return getPrisma().loginAttemptBucket.findUnique({ where: { keyHash } });
}

export async function assertLoginNotBlocked(email: string, req: Request): Promise<void> {
  const bucket = await getRateBucket(loginAttemptKey(email, sourceAddress(req)));
  if (bucket?.blockedUntil && bucket.blockedUntil.getTime() > Date.now()) {
    throw new AuthError(429, "LOGIN_RATE_LIMITED", "Too many failed login attempts. Try again later.");
  }
}

export async function recordLoginFailure(email: string, req: Request): Promise<void> {
  const prisma = getPrisma();
  const keyHash = loginAttemptKey(email, sourceAddress(req));
  const now = new Date();
  const current = await prisma.loginAttemptBucket.findUnique({ where: { keyHash } });
  const withinWindow = current && now.getTime() - current.windowStartedAt.getTime() < LOGIN_WINDOW_MS;
  const failureCount = withinWindow ? current.failureCount + 1 : 1;
  await prisma.loginAttemptBucket.upsert({
    where: { keyHash },
    update: {
      failureCount,
      windowStartedAt: withinWindow ? current.windowStartedAt : now,
      blockedUntil: failureCount >= LOGIN_FAILURE_LIMIT ? new Date(now.getTime() + LOGIN_BLOCK_MS) : null,
    },
    create: {
      keyHash,
      failureCount,
      windowStartedAt: now,
      blockedUntil: failureCount >= LOGIN_FAILURE_LIMIT ? new Date(now.getTime() + LOGIN_BLOCK_MS) : null,
    },
  });
}

export async function clearLoginFailures(email: string, req: Request): Promise<void> {
  await getPrisma().loginAttemptBucket.deleteMany({ where: { keyHash: loginAttemptKey(email, sourceAddress(req)) } });
}

export async function createSession(userId: number): Promise<{ token: string; csrfToken: string; session: Session }> {
  const token = createOpaqueToken();
  const csrfToken = createOpaqueToken();
  const now = new Date();
  const session = await getPrisma().session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      csrfTokenHash: hashToken(csrfToken),
      createdAt: now,
      lastSeenAt: now,
      idleExpiresAt: new Date(now.getTime() + IDLE_SESSION_MS),
      absoluteExpiresAt: new Date(now.getTime() + ABSOLUTE_SESSION_MS),
    },
  });
  return { token, csrfToken, session };
}

export async function rotateCsrfToken(context: AuthContext): Promise<string> {
  const csrfToken = createOpaqueToken();
  await getPrisma().session.update({
    where: { id: context.session.id },
    data: { csrfTokenHash: hashToken(csrfToken) },
  });
  return csrfToken;
}

async function findContext(req: Request): Promise<AuthContext | null> {
  const token = getSessionToken(req);
  if (!token) return null;
  const session = await getPrisma().session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session) return null;
  const now = Date.now();
  if (
    session.revokedAt ||
    session.idleExpiresAt.getTime() <= now ||
    session.absoluteExpiresAt.getTime() <= now ||
    !session.user.isActive
  ) {
    if (!session.revokedAt) {
      await getPrisma().session.update({ where: { id: session.id }, data: { revokedAt: new Date() } }).catch(() => undefined);
    }
    return null;
  }
  const nextIdle = new Date(Math.min(session.absoluteExpiresAt.getTime(), now + IDLE_SESSION_MS));
  const updated = await getPrisma().session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date(now), idleExpiresAt: nextIdle },
    include: { user: true },
  });
  return { session: updated, user: updated.user, token };
}

export async function requireSession(req: Request): Promise<AuthContext> {
  const context = await findContext(req);
  if (!context) throw new AuthError(401, "SESSION_REQUIRED", "Authentication is required.");
  return context;
}

export async function optionalSession(req: Request): Promise<AuthContext | null> {
  return findContext(req);
}

export async function requireUsableSession(req: Request): Promise<AuthContext> {
  const context = await requireSession(req);
  if (context.user.mustChangePassword) {
    throw new AuthError(403, "PASSWORD_CHANGE_REQUIRED", "Password change is required before using this resource.");
  }
  return context;
}

/**
 * Lab 3 Requester ownership is derived from the authenticated User's legacy
 * identity link. The client may still send the old Lab 2 header, but it is
 * deliberately ignored by every authenticated route.
 */
export function requesterIdForContext(context: AuthContext): number {
  if (context.user.role !== "REQUESTER" || context.user.legacyRequesterId === null) {
    throw new AuthError(403, "FORBIDDEN", "You do not have permission to perform this action.");
  }
  return context.user.legacyRequesterId;
}

export function requireRole(context: AuthContext, ...roles: User["role"][]): void {
  if (!roles.includes(context.user.role)) {
    throw new AuthError(403, "FORBIDDEN", "You do not have permission to perform this action.");
  }
}

export function assertCsrf(context: AuthContext, req: Request): void {
  const supplied = req.header("X-CSRF-Token");
  if (!supplied || !crypto.timingSafeEqual(Buffer.from(hashToken(supplied)), Buffer.from(context.session.csrfTokenHash))) {
    throw new AuthError(403, "CSRF_INVALID", "The request could not be verified.");
  }
}

export function configuredClientOrigin(): string {
  return (process.env.CLIENT_ORIGIN || "http://localhost:5173").trim();
}

export function assertAllowedOrigin(req: Request): void {
  const origin = req.header("Origin");
  if (origin && origin !== configuredClientOrigin()) {
    throw new AuthError(403, "ORIGIN_NOT_ALLOWED", "The request origin is not allowed.");
  }
}

export async function authenticate(email: string, password: string, req: Request): Promise<{ user: User; token: string; csrfToken: string }> {
  await assertLoginNotBlocked(email, req);
  const user = await getPrisma().user.findUnique({ where: { email } });
  const passwordMatches = await verifyPassword(user?.passwordHash, password);
  if (!passwordMatches) await verifyPassword(await getDummyHash(), password);
  if (!user || !user.isActive || !passwordMatches) {
    await recordLoginFailure(email, req);
    const bucket = await getRateBucket(loginAttemptKey(email, sourceAddress(req)));
    if (bucket?.blockedUntil && bucket.blockedUntil.getTime() > Date.now()) {
      throw new AuthError(429, "LOGIN_RATE_LIMITED", "Too many failed login attempts. Try again later.");
    }
    throw new AuthError(401, "AUTHENTICATION_FAILED", "Email or password is incorrect.");
  }
  await clearLoginFailures(email, req);
  const session = await createSession(user.id);
  return { user, token: session.token, csrfToken: session.csrfToken };
}

export async function changePassword(
  context: AuthContext,
  currentPassword: string,
  newPassword: string,
): Promise<{ user: User; token: string; csrfToken: string }> {
  if (!await verifyPassword(context.user.passwordHash, currentPassword)) {
    throw new AuthError(401, "CURRENT_PASSWORD_INVALID", "Current password is incorrect.");
  }
  if (await verifyPassword(context.user.passwordHash, newPassword)) {
    throw new AuthError(400, "VALIDATION_ERROR", "New password must differ from the current password.", { newPassword: "Choose a different password." });
  }
  const passwordHash = await hashPassword(newPassword);
  const token = createOpaqueToken();
  const csrfToken = createOpaqueToken();
  const now = new Date();
  const user = await getPrisma().$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: context.user.id }, data: { passwordHash, mustChangePassword: false } });
    await tx.session.updateMany({ where: { userId: context.user.id }, data: { revokedAt: now } });
    await tx.session.create({
      data: {
        userId: context.user.id,
        tokenHash: hashToken(token),
        csrfTokenHash: hashToken(csrfToken),
        createdAt: now,
        lastSeenAt: now,
        idleExpiresAt: new Date(now.getTime() + IDLE_SESSION_MS),
        absoluteExpiresAt: new Date(now.getTime() + ABSOLUTE_SESSION_MS),
      },
    });
    return updated;
  });
  return { user, token, csrfToken };
}

export async function revokeFromRequest(req: Request): Promise<AuthContext | null> {
  const context = await findContext(req);
  if (!context) return null;
  await getPrisma().session.update({ where: { id: context.session.id }, data: { revokedAt: new Date() } });
  return context;
}

export async function revokeAllSessions(userId: number): Promise<void> {
  await getPrisma().session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}
