import { Prisma, type User, type UserRole } from "@prisma/client";
import { hashPassword, safeUser, type SafeUser } from "./auth-service.js";
import { validateEmail, validatePassword, validateUserName } from "./auth-validation.js";
import { getPrisma } from "./prisma.js";

const ROLES = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const satisfies readonly UserRole[];
type ManagedRole = (typeof ROLES)[number];

export class UserManagementError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;

  constructor(statusCode: number, code: string, message: string, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "UserManagementError";
    this.statusCode = statusCode;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export interface AdminUserListQuery {
  search?: unknown;
  role?: unknown;
}

export interface CreateAdminUserInput {
  name?: unknown;
  email?: unknown;
  role?: unknown;
  isActive?: unknown;
  initialPassword?: unknown;
}

export interface UpdateAdminUserInput {
  name?: unknown;
  email?: unknown;
  role?: unknown;
  isActive?: unknown;
}

export interface ResetAdminUserPasswordInput {
  initialPassword?: unknown;
}

const CREATE_KEYS = new Set(["name", "email", "role", "isActive", "initialPassword"]);
const UPDATE_KEYS = new Set(["name", "email", "role", "isActive"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fieldError(message: string, field: string): never {
  throw new UserManagementError(400, "VALIDATION_ERROR", "Check the highlighted fields.", { [field]: message });
}

function assertKeys(value: unknown, allowed: Set<string>): asserts value is Record<string, unknown> {
  if (!isRecord(value)) throw new UserManagementError(400, "VALIDATION_ERROR", "Check the highlighted fields.");
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length > 0) throw new UserManagementError(400, "VALIDATION_ERROR", "Check the highlighted fields.", { [unknown[0]]: "This field is not supported." });
}

function parseRole(value: unknown, field = "role"): ManagedRole {
  if (typeof value !== "string" || !ROLES.includes(value as ManagedRole)) fieldError("Choose a valid User role.", field);
  return value as ManagedRole;
}

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") fieldError("Choose active or inactive.", field);
  return value;
}

function parseUserId(value: string): number {
  if (!/^\d+$/.test(value)) throw new UserManagementError(404, "USER_NOT_FOUND", "User was not found.");
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new UserManagementError(404, "USER_NOT_FOUND", "User was not found.");
  return id;
}

function isUniqueConstraint(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

function unavailable(code: string, message: string): UserManagementError {
  return new UserManagementError(500, code, message);
}

function safeManagedUser(user: User): SafeUser {
  return safeUser(user);
}

function parseSearch(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new UserManagementError(400, "VALIDATION_ERROR", "Check the query parameters.");
  const search = value.trim();
  if (search.length > 100) throw new UserManagementError(400, "VALIDATION_ERROR", "Check the query parameters.", { search: "Search must be at most 100 characters." });
  return search || undefined;
}

function parseOptionalRole(value: unknown): ManagedRole | undefined {
  if (value === undefined || value === "") return undefined;
  return parseRole(value, "role");
}

export async function listAdminUsers(query: AdminUserListQuery): Promise<{ users: SafeUser[] }> {
  try {
    const search = parseSearch(query.search);
    const role = parseOptionalRole(query.role);
    const where: Prisma.UserWhereInput = {
      ...(role ? { role } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    };
    const users = await getPrisma().user.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }] });
    return { users: users.map(safeManagedUser) };
  } catch (error) {
    if (error instanceof UserManagementError) throw error;
    throw unavailable("USER_LIST_FAILED", "Unable to load Users.");
  }
}

function parseCreateInput(input: CreateAdminUserInput): { name: string; email: string; role: ManagedRole; isActive: boolean; initialPassword: string } {
  assertKeys(input, CREATE_KEYS);
  const errors: Record<string, string> = {};
  const name = validateUserName(input.name);
  if (!name.ok || typeof name.value !== "string") errors.name = name.ok ? "Name is required." : name.message;
  const email = validateEmail(input.email);
  if (!email.ok || typeof email.value !== "string") errors.email = email.ok ? "Enter a valid email address." : email.message;
  if (typeof input.role !== "string" || !ROLES.includes(input.role as ManagedRole)) errors.role = "Choose a valid User role.";
  if (typeof input.isActive !== "boolean") errors.isActive = "Choose active or inactive.";
  const password = validatePassword(input.initialPassword);
  if (!password.ok) errors.initialPassword = password.message;
  if (Object.keys(errors).length > 0) throw new UserManagementError(400, "VALIDATION_ERROR", "Check the highlighted fields.", errors);
  const nameValue = name.ok ? name.value : undefined;
  const emailValue = email.ok ? email.value : undefined;
  return { name: nameValue as string, email: emailValue as string, role: input.role as ManagedRole, isActive: input.isActive as boolean, initialPassword: input.initialPassword as string };
}

export async function createAdminUser(input: CreateAdminUserInput): Promise<{ user: SafeUser }> {
  const parsed = parseCreateInput(input);
  try {
    const user = await getPrisma().$transaction(async (tx) => {
      const legacyRequester = parsed.role === "REQUESTER"
        ? await tx.requester.upsert({
            where: { email: parsed.email },
            update: { name: parsed.name, isActive: parsed.isActive },
            create: { name: parsed.name, email: parsed.email, isActive: parsed.isActive },
          })
        : null;
      return tx.user.create({
        data: {
          name: parsed.name,
          email: parsed.email,
          role: parsed.role,
          isActive: parsed.isActive,
          passwordHash: await hashPassword(parsed.initialPassword),
          mustChangePassword: true,
          ...(legacyRequester ? { legacyRequester: { connect: { id: legacyRequester.id } } } : {}),
        },
      });
    });
    return { user: safeManagedUser(user) };
  } catch (error) {
    if (isUniqueConstraint(error)) throw new UserManagementError(409, "DUPLICATE_EMAIL", "A User with this email already exists.", { email: "This email is already in use." });
    throw unavailable("USER_CREATE_FAILED", "Unable to create User.");
  }
}

function parseUpdateInput(input: UpdateAdminUserInput): { name?: string; email?: string; role?: ManagedRole; isActive?: boolean } {
  assertKeys(input, UPDATE_KEYS);
  if (Object.keys(input).length === 0) throw new UserManagementError(400, "VALIDATION_ERROR", "At least one User field must be changed.");
  const errors: Record<string, string> = {};
  let name: string | undefined;
  let email: string | undefined;
  let role: ManagedRole | undefined;
  let isActive: boolean | undefined;
  if ("name" in input) {
    const result = validateUserName(input.name);
    if (!result.ok || typeof result.value !== "string") errors.name = result.ok ? "Name is required." : result.message;
    else name = result.value;
  }
  if ("email" in input) {
    const result = validateEmail(input.email);
    if (!result.ok || typeof result.value !== "string") errors.email = result.ok ? "Enter a valid email address." : result.message;
    else email = result.value;
  }
  if ("role" in input) {
    if (typeof input.role !== "string" || !ROLES.includes(input.role as ManagedRole)) errors.role = "Choose a valid User role.";
    else role = input.role as ManagedRole;
  }
  if ("isActive" in input) {
    if (typeof input.isActive !== "boolean") errors.isActive = "Choose active or inactive.";
    else isActive = input.isActive;
  }
  if (Object.keys(errors).length > 0) throw new UserManagementError(400, "VALIDATION_ERROR", "Check the highlighted fields.", errors);
  return { ...(name !== undefined ? { name } : {}), ...(email !== undefined ? { email } : {}), ...(role !== undefined ? { role } : {}), ...(isActive !== undefined ? { isActive } : {}) };
}

export async function updateAdminUser(actorId: number, rawUserId: string, input: UpdateAdminUserInput): Promise<{ user: SafeUser }> {
  const userId = parseUserId(rawUserId);
  const changes = parseUpdateInput(input);
  try {
    const result = await getPrisma().$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: userId } });
      if (!target) throw new UserManagementError(404, "USER_NOT_FOUND", "User was not found.");
      const nextRole = changes.role ?? target.role;
      const nextActive = changes.isActive ?? target.isActive;
      const removingAdmin = target.role === "ADMINISTRATOR" && target.isActive && (nextRole !== "ADMINISTRATOR" || !nextActive);
      if (target.id === actorId && target.role === "ADMINISTRATOR" && (nextRole !== "ADMINISTRATOR" || !nextActive)) {
        throw new UserManagementError(409, "ADMINISTRATOR_SAFETY_VIOLATION", "You cannot deactivate or demote your own Administrator account.");
      }
      if (removingAdmin) {
        const activeAdministrators = await tx.user.count({ where: { role: "ADMINISTRATOR", isActive: true } });
        if (activeAdministrators <= 1) throw new UserManagementError(409, "ADMINISTRATOR_SAFETY_VIOLATION", "At least one active Administrator must remain.");
      }
      const makesOwnerIneligible = nextRole === "REQUESTER" || !nextActive;
      if (makesOwnerIneligible) {
        const ownedTickets = await tx.ticket.count({ where: { ticketOwnerId: userId } });
        if (ownedTickets > 0) throw new UserManagementError(409, "USER_OWNS_TICKETS", "This User owns Tickets and cannot be made ineligible.");
      }
      const data: Prisma.UserUpdateInput = {
        ...(changes.name !== undefined ? { name: changes.name } : {}),
        ...(changes.email !== undefined ? { email: changes.email } : {}),
        ...(changes.role !== undefined ? { role: changes.role } : {}),
        ...(changes.isActive !== undefined ? { isActive: changes.isActive } : {}),
      };
      let requesterLinkId = target.legacyRequesterId;
      if (nextRole === "REQUESTER" && requesterLinkId === null) {
        const requester = await tx.requester.upsert({
          where: { email: changes.email ?? target.email },
          update: { name: changes.name ?? target.name, isActive: nextActive },
          create: { name: changes.name ?? target.name, email: changes.email ?? target.email, isActive: nextActive },
        });
        requesterLinkId = requester.id;
        data.legacyRequester = { connect: { id: requester.id } };
      } else if (nextRole === "REQUESTER" && requesterLinkId !== null && (changes.name !== undefined || changes.email !== undefined || changes.isActive !== undefined)) {
        await tx.requester.update({
          where: { id: requesterLinkId },
          data: {
            ...(changes.name !== undefined ? { name: changes.name } : {}),
            ...(changes.email !== undefined ? { email: changes.email } : {}),
            ...(changes.isActive !== undefined ? { isActive: changes.isActive } : {}),
          },
        });
      }
      const updated = await tx.user.update({ where: { id: userId }, data });
      if (target.role !== updated.role || target.isActive !== updated.isActive) {
        await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { user: safeManagedUser(result) };
  } catch (error) {
    if (error instanceof UserManagementError) throw error;
    if (isUniqueConstraint(error)) throw new UserManagementError(409, "DUPLICATE_EMAIL", "A User with this email already exists.", { email: "This email is already in use." });
    throw unavailable("USER_UPDATE_FAILED", "Unable to update User.");
  }
}

export async function resetAdminUserPassword(rawUserId: string, input: ResetAdminUserPasswordInput): Promise<{ user: SafeUser }> {
  const userId = parseUserId(rawUserId);
  assertKeys(input, new Set(["initialPassword"]));
  const password = validatePassword(input.initialPassword);
  if (!password.ok) throw new UserManagementError(400, "VALIDATION_ERROR", "Check the highlighted fields.", { initialPassword: password.message });
  try {
    const result = await getPrisma().$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: userId } });
      if (!target) throw new UserManagementError(404, "USER_NOT_FOUND", "User was not found.");
      const updated = await tx.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(input.initialPassword as string), mustChangePassword: true } });
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      return updated;
    });
    return { user: safeManagedUser(result) };
  } catch (error) {
    if (error instanceof UserManagementError) throw error;
    throw unavailable("PASSWORD_RESET_FAILED", "Unable to reset the initial password.");
  }
}
