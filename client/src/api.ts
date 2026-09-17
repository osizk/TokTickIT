const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export interface Category {
  id: number;
  name: string;
}

export interface Requester {
  id: number;
  name: string;
  email: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "REQUESTER" | "IT_STAFF" | "ADMINISTRATOR";
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt?: string;
  updatedAt?: string;
  /** Legacy Lab 2 link used only to render compatibility data, never client ownership. */
  legacyRequesterId?: number | null;
}

export interface AuthResponse {
  user: AuthUser;
  csrfToken: string;
}

let csrfToken: string | null = null;
let sessionExpiredHandler: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

function notifySessionExpired(status: number, code?: string): void {
  if (status !== 401 || code !== "SESSION_REQUIRED") return;
  csrfToken = null;
  sessionExpiredHandler?.();
}

function authenticatedHeaders(includeCsrf = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (includeCsrf && csrfToken) headers["X-CSRF-Token"] = csrfToken;
  return headers;
}

function rememberAuth(body: unknown): AuthResponse {
  const candidate = body as { user?: AuthUser; csrfToken?: unknown } | null;
  if (!candidate?.user || typeof candidate.csrfToken !== "string") {
    throw new ApiClientError("Authentication response was invalid.", 200);
  }
  csrfToken = candidate.csrfToken;
  return { user: candidate.user, csrfToken: candidate.csrfToken };
}

async function parseResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new ApiClientError("Unable to sign in.", 0);
  }
  const body = await parseResponseBody(response);
  if (!response.ok) {
    const details = readApiError(body);
    throw new ApiClientError("Email or password is incorrect.", response.status, details.code, details.fieldErrors);
  }
  return rememberAuth(body);
}

export async function currentUser(options: { notifySessionExpiry?: boolean } = {}): Promise<AuthResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/auth/me`, { credentials: "include" });
  } catch {
    throw new ApiClientError("Unable to verify the session.", 0);
  }
  const body = await parseResponseBody(response);
  if (!response.ok) {
    const details = readApiError(body);
    throw new ApiClientError("Authentication is required.", response.status, details.code, details.fieldErrors, options.notifySessionExpiry ?? true);
  }
  return rememberAuth(body);
}

export async function changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<AuthResponse> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/auth/change-password`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...authenticatedHeaders(true) },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
  } catch {
    throw new ApiClientError("Unable to change password.", 0);
  }
  const body = await parseResponseBody(response);
  if (!response.ok) {
    const details = readApiError(body);
    throw new ApiClientError("Unable to change password.", response.status, details.code, details.fieldErrors);
  }
  return rememberAuth(body);
}

export async function logout(): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: authenticatedHeaders(true),
    });
  } catch {
    throw new ApiClientError("Unable to sign out. Please try again.", 0);
  }

  const body = await parseResponseBody(response);
  if (!response.ok) {
    const details = readApiError(body);
    throw new ApiClientError("Unable to sign out. Please try again.", response.status, details.code, details.fieldErrors, false);
  }
  csrfToken = null;
}

export interface RelatedSystem {
  id: number;
  name: string;
}

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketStatus =
  | "NEW"
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_REQUESTER"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "CANCELLED";

export type TicketListSort =
  | "updatedAt"
  | "createdAt"
  | "ticketNumber"
  | "summary"
  | "requestedPriority";
export type TicketListOrder = "asc" | "desc";
export type TicketListPageSize = 10 | 25 | 50;

export interface TicketAttachment {
  id: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  removedAt: string | null;
  removalReason: string | null;
  removedByRequesterId: number | null;
}

export interface PublicComment {
  id: number;
  content: string;
  author: Pick<AuthUser, "id" | "name" | "email" | "role">;
  createdAt: string;
}

export interface ResolutionIndication {
  indicatedAt: string;
  indicatedBy: Pick<AuthUser, "id" | "name" | "email" | "role">;
}

export interface CreatedTicket {
  id: number;
  ticketNumber: string;
  requester: Requester;
  category: Category;
  relatedSystem: RelatedSystem;
  requestedPriority: TicketPriority;
  itPriority?: TicketPriority;
  status: TicketStatus;
  summary: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  attachments: TicketAttachment[];
}

export type TicketDetail = Omit<CreatedTicket, "attachments"> & { resolutionIndication?: ResolutionIndication | null };

export interface CreateTicketInput {
  categoryId: number;
  relatedSystemId: number;
  requestedPriority: TicketPriority;
  summary: string;
  description: string;
  attachments: File[];
}

export interface CreateTicketResponse {
  ticket: CreatedTicket;
  attachments: TicketAttachment[];
}

export interface TicketListItem {
  id: number;
  ticketNumber: string;
  summary: string;
  category: Category;
  relatedSystem: RelatedSystem;
  requestedPriority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TicketListQuery {
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  priority?: TicketPriority;
  status?: TicketStatus;
  sort: TicketListSort;
  order: TicketListOrder;
  page: number;
  pageSize: TicketListPageSize;
}

export interface TicketListPagination {
  page: number;
  pageSize: TicketListPageSize;
  totalItems: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface TicketListResponse {
  items: TicketListItem[];
  pagination: TicketListPagination;
}

export type StaffTicketSort =
  | "updatedAt"
  | "createdAt"
  | "ticketNumber"
  | "summary"
  | "requestedPriority"
  | "itPriority"
  | "status"
  | "owner";
export type StaffTicketOwner = "me" | "unassigned" | number;

export interface StaffAssignee {
  id: number;
  name: string;
  email: string;
  role: "IT_STAFF" | "ADMINISTRATOR";
}

export interface StaffTicket {
  id: number;
  ticketNumber: string;
  requester: Requester;
  category: Category;
  relatedSystem: RelatedSystem;
  requestedPriority: TicketPriority;
  itPriority: TicketPriority;
  status: TicketStatus;
  summary: string;
  description: string;
  ticketOwner: StaffAssignee | null;
  resolutionIndication: ResolutionIndication | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffTicketQuery {
  search?: string;
  categoryId?: number;
  relatedSystemId?: number;
  requestedPriority?: TicketPriority;
  itPriority?: TicketPriority;
  status?: TicketStatus;
  owner?: StaffTicketOwner;
  sort: StaffTicketSort;
  order: TicketListOrder;
  page: number;
  pageSize: TicketListPageSize;
}

export interface StaffTicketPagination extends TicketListPagination {}

export interface StaffTicketResponse {
  items: StaffTicket[];
  pagination: StaffTicketPagination;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly fieldErrors?: Record<string, string>,
    notifySessionExpiry = true,
  ) {
    super(message);
    this.name = "ApiClientError";
    if (notifySessionExpiry) notifySessionExpired(status, code);
  }
}

export interface SystemStatus {
  online: boolean;
  service: string;
  categories: Category[];
}

export interface HealthStatus {
  status: "ok";
  service: string;
}

function isRequester(value: unknown): value is Requester {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "number" &&
    Number.isSafeInteger(candidate.id) &&
    candidate.id > 0 &&
    typeof candidate.name === "string" &&
    candidate.name.trim().length > 0 &&
    typeof candidate.email === "string" &&
    candidate.email.trim().length > 0
  );
}

function isNamedReference(value: unknown): value is Category | RelatedSystem {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "number" &&
    Number.isSafeInteger(candidate.id) &&
    candidate.id > 0 &&
    typeof candidate.name === "string" &&
    candidate.name.trim().length > 0
  );
}

async function fetchReferenceList<T extends Category | RelatedSystem>(
  endpoint: string,
  label: string,
): Promise<T[]> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${endpoint}`, { credentials: "include" });
  } catch {
    throw new ApiClientError(`Unable to load ${label}.`, 0);
  }

  const body = await parseResponseBody(response);
  if (!response.ok) {
    const details = readApiError(body);
    throw new ApiClientError(`Unable to load ${label}.`, response.status, details.code, details.fieldErrors);
  }

  try {
    if (!Array.isArray(body) || !body.every(isNamedReference)) {
      throw new Error("Invalid reference response.");
    }
    return body as T[];
  } catch {
    throw new Error(`Unable to load ${label}.`);
  }
}

export function fetchCategories(): Promise<Category[]> {
  return fetchReferenceList<Category>("/api/categories", "Categories");
}

export function fetchRelatedSystems(): Promise<RelatedSystem[]> {
  return fetchReferenceList<RelatedSystem>("/api/related-systems", "Related Systems");
}

export async function fetchRequesters(): Promise<Requester[]> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/api/requesters`, { credentials: "include" });
  } catch {
    throw new ApiClientError("Unable to load Development Requesters.", 0);
  }

  const body = await parseResponseBody(response);
  if (!response.ok) {
    const details = readApiError(body);
    throw new ApiClientError("Unable to load Development Requesters.", response.status, details.code, details.fieldErrors);
  }

  try {
    if (!Array.isArray(body) || !body.every(isRequester)) {
      throw new Error("Invalid requester response.");
    }

    return body;
  } catch {
    throw new Error("Unable to load Development Requesters.");
  }
}

function isTicketAttachment(value: unknown): value is TicketAttachment {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "number" &&
    Number.isSafeInteger(candidate.id) &&
    candidate.id > 0 &&
    typeof candidate.originalName === "string" &&
    typeof candidate.mimeType === "string" &&
    typeof candidate.sizeBytes === "number" &&
    Number.isSafeInteger(candidate.sizeBytes) &&
    candidate.sizeBytes >= 0 &&
    typeof candidate.uploadedAt === "string" &&
    (candidate.removedAt === null || typeof candidate.removedAt === "string") &&
    (candidate.removalReason === null || typeof candidate.removalReason === "string") &&
    (candidate.removedByRequesterId === null || typeof candidate.removedByRequesterId === "number")
  );
}

function isCreatedTicket(value: unknown): value is CreatedTicket {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "number" &&
    Number.isSafeInteger(candidate.id) &&
    candidate.id > 0 &&
    typeof candidate.ticketNumber === "string" &&
    /^TKT-\d{4}-\d{6}$/.test(candidate.ticketNumber) &&
    isRequester(candidate.requester) &&
    isNamedReference(candidate.category) &&
    isNamedReference(candidate.relatedSystem) &&
    ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(candidate.requestedPriority as string) &&
    isTicketStatus(candidate.status) &&
    typeof candidate.summary === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string" &&
    Array.isArray(candidate.attachments) &&
    candidate.attachments.every(isTicketAttachment)
  );
}

function isTicketDetail(value: unknown): value is TicketDetail {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "number" &&
    Number.isSafeInteger(candidate.id) &&
    candidate.id > 0 &&
    typeof candidate.ticketNumber === "string" &&
    /^TKT-\d{4}-\d{6}$/.test(candidate.ticketNumber) &&
    isRequester(candidate.requester) &&
    isNamedReference(candidate.category) &&
    isNamedReference(candidate.relatedSystem) &&
    ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(candidate.requestedPriority as string) &&
    isTicketStatus(candidate.status) &&
    typeof candidate.summary === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

function readApiError(body: unknown): { code?: string; fieldErrors?: Record<string, string> } {
  const errorBody = body as { error?: { code?: unknown; fieldErrors?: unknown } } | null;
  const error = errorBody?.error;
  const fieldErrors =
    error && typeof error.fieldErrors === "object" && error.fieldErrors !== null
      ? Object.fromEntries(
          Object.entries(error.fieldErrors).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        )
      : undefined;
  return {
    code: typeof error?.code === "string" ? error.code : undefined,
    fieldErrors,
  };
}

function isTicketListItem(value: unknown): value is TicketListItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "number" &&
    Number.isSafeInteger(candidate.id) &&
    candidate.id > 0 &&
    typeof candidate.ticketNumber === "string" &&
    /^TKT-\d{4}-\d{6}$/.test(candidate.ticketNumber) &&
    typeof candidate.summary === "string" &&
    isNamedReference(candidate.category) &&
    isNamedReference(candidate.relatedSystem) &&
    ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(candidate.requestedPriority as string) &&
    isTicketStatus(candidate.status) &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

function isTicketListPagination(value: unknown): value is TicketListPagination {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.page === "number" &&
    Number.isSafeInteger(candidate.page) &&
    candidate.page > 0 &&
    [10, 25, 50].includes(candidate.pageSize as number) &&
    typeof candidate.totalItems === "number" &&
    Number.isSafeInteger(candidate.totalItems) &&
    candidate.totalItems >= 0 &&
    typeof candidate.totalPages === "number" &&
    Number.isSafeInteger(candidate.totalPages) &&
    candidate.totalPages >= 0 &&
    typeof candidate.hasPreviousPage === "boolean" &&
    typeof candidate.hasNextPage === "boolean"
  );
}

function isTicketListResponse(value: unknown): value is TicketListResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.items) &&
    candidate.items.every(isTicketListItem) &&
    isTicketListPagination(candidate.pagination)
  );
}

function isTicketStatus(value: unknown): value is TicketStatus {
  return ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"].includes(value as string);
}

function isStaffAssignee(value: unknown): value is StaffAssignee {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "number" && Number.isSafeInteger(candidate.id) && candidate.id > 0 &&
    typeof candidate.name === "string" && candidate.name.trim().length > 0 &&
    typeof candidate.email === "string" && candidate.email.trim().length > 0 &&
    (candidate.role === "IT_STAFF" || candidate.role === "ADMINISTRATOR")
  );
}

function isResolutionIndication(value: unknown): value is ResolutionIndication {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.indicatedAt === "string" && isRequester(candidate.indicatedBy);
}

function isStaffTicket(value: unknown): value is StaffTicket {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "number" && Number.isSafeInteger(candidate.id) && candidate.id > 0 &&
    typeof candidate.ticketNumber === "string" && /^TKT-\d{4}-\d{6}$/.test(candidate.ticketNumber) &&
    isRequester(candidate.requester) && isNamedReference(candidate.category) && isNamedReference(candidate.relatedSystem) &&
    ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(candidate.requestedPriority as string) &&
    ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(candidate.itPriority as string) &&
    isTicketStatus(candidate.status) && typeof candidate.summary === "string" && typeof candidate.description === "string" &&
    (candidate.ticketOwner === null || isStaffAssignee(candidate.ticketOwner)) &&
    (candidate.resolutionIndication === null || isResolutionIndication(candidate.resolutionIndication)) &&
    typeof candidate.createdAt === "string" && typeof candidate.updatedAt === "string"
  );
}

function isStaffTicketResponse(value: unknown): value is StaffTicketResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.items) && candidate.items.every(isStaffTicket) && isTicketListPagination(candidate.pagination);
}

export async function fetchStaffTickets(query: StaffTicketQuery): Promise<StaffTicketResponse> {
  const params = new URLSearchParams();
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.categoryId !== undefined) params.set("categoryId", String(query.categoryId));
  if (query.relatedSystemId !== undefined) params.set("relatedSystemId", String(query.relatedSystemId));
  if (query.requestedPriority) params.set("requestedPriority", query.requestedPriority);
  if (query.itPriority) params.set("itPriority", query.itPriority);
  if (query.status) params.set("status", query.status);
  if (query.owner !== undefined) params.set("owner", String(query.owner));
  params.set("sort", query.sort);
  params.set("order", query.order);
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/staff/tickets?${params.toString()}`, {
      credentials: "include",
      headers: authenticatedHeaders(),
    });
  } catch {
    throw new ApiClientError("Unable to load Ticket Queue.", 0);
  }
  const body = await parseResponseBody(response);
  if (!response.ok) {
    const details = readApiError(body);
    throw new ApiClientError("Unable to load Ticket Queue.", response.status, details.code, details.fieldErrors);
  }
  if (!isStaffTicketResponse(body)) throw new ApiClientError("Unable to load Ticket Queue.", response.status);
  return body;
}

export async function fetchStaffTicket(ticketNumber: string): Promise<StaffTicket> {
  if (!ticketNumber) throw new ApiClientError("Unable to load Staff Ticket.", 400);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/staff/tickets/${encodeURIComponent(ticketNumber)}`, {
      credentials: "include",
      headers: authenticatedHeaders(),
    });
  } catch {
    throw new ApiClientError("Unable to load Staff Ticket.", 0);
  }
  const body = await parseResponseBody(response);
  if (!response.ok) {
    const details = readApiError(body);
    throw new ApiClientError("Unable to load Staff Ticket.", response.status, details.code, details.fieldErrors);
  }
  const result = body as { ticket?: unknown } | null;
  if (!result || !isStaffTicket(result.ticket)) {
    throw new ApiClientError("Unable to load Staff Ticket.", response.status);
  }
  return result.ticket;
}

export async function fetchStaffAssignees(): Promise<StaffAssignee[]> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/staff/assignees`, { credentials: "include", headers: authenticatedHeaders() });
  } catch {
    throw new ApiClientError("Unable to load assignees.", 0);
  }
  const body = await parseResponseBody(response);
  if (!response.ok) {
    const details = readApiError(body);
    throw new ApiClientError("Unable to load assignees.", response.status, details.code, details.fieldErrors);
  }
  if (!Array.isArray(body) || !body.every(isStaffAssignee)) throw new ApiClientError("Unable to load assignees.", response.status);
  return body;
}

export async function createTicket(
  requesterOrInput: number | CreateTicketInput,
  optionalInput?: CreateTicketInput,
): Promise<CreateTicketResponse> {
  // The numeric argument remains source-compatible with Lab 2 components but
  // is intentionally ignored. Lab 3 derives ownership from the session.
  const input = typeof requesterOrInput === "number" ? optionalInput : requesterOrInput;
  if (!input) throw new ApiClientError("Unable to create Ticket.", 400);
  const formData = new FormData();
  formData.append("categoryId", String(input.categoryId));
  formData.append("relatedSystemId", String(input.relatedSystemId));
  formData.append("requestedPriority", input.requestedPriority);
  formData.append("summary", input.summary);
  formData.append("description", input.description);
  for (const attachment of input.attachments) {
    formData.append("attachments", attachment, attachment.name);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/tickets`, {
      method: "POST",
      credentials: "include",
      headers: authenticatedHeaders(true),
      body: formData,
    });
  } catch {
    throw new ApiClientError("Unable to create Ticket.", 0);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const errorBody = body as { error?: { code?: unknown; message?: unknown; fieldErrors?: unknown } } | null;
    const error = errorBody?.error;
    const fieldErrors =
      error && typeof error.fieldErrors === "object" && error.fieldErrors !== null
        ? Object.fromEntries(
            Object.entries(error.fieldErrors).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
          )
        : undefined;
    throw new ApiClientError(
      "Unable to create Ticket.",
      response.status,
      typeof error?.code === "string" ? error.code : undefined,
      fieldErrors,
    );
  }

  const result = body as { ticket?: unknown; attachments?: unknown } | null;
  if (
    !result ||
    !isCreatedTicket(result.ticket) ||
    !Array.isArray(result.attachments) ||
    !result.attachments.every(isTicketAttachment)
  ) {
    throw new ApiClientError("Unable to create Ticket.", response.status);
  }

  return {
    ticket: result.ticket,
    attachments: result.attachments,
  };
}

export async function fetchTickets(
  requesterOrQuery: number | TicketListQuery,
  optionalQuery?: TicketListQuery,
): Promise<TicketListResponse> {
  const query = typeof requesterOrQuery === "number" ? optionalQuery : requesterOrQuery;
  if (!query) throw new ApiClientError("Unable to load My Tickets.", 400);
  const params = new URLSearchParams();
  if (query.search?.trim()) params.set("search", query.search.trim());
  if (query.categoryId !== undefined) params.set("categoryId", String(query.categoryId));
  if (query.relatedSystemId !== undefined) params.set("relatedSystemId", String(query.relatedSystemId));
  if (query.priority) params.set("priority", query.priority);
  if (query.status) params.set("status", query.status);
  params.set("sort", query.sort);
  params.set("order", query.order);
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/tickets?${params.toString()}`, {
      credentials: "include",
      headers: authenticatedHeaders(),
    });
  } catch {
    throw new ApiClientError("Unable to load My Tickets.", 0);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const details = readApiError(body);
    throw new ApiClientError("Unable to load My Tickets.", response.status, details.code, details.fieldErrors);
  }
  if (!isTicketListResponse(body)) {
    throw new ApiClientError("Unable to load My Tickets.", response.status);
  }

  return body;
}

export async function fetchTicket(requesterOrTicketNumber: number | string, optionalTicketNumber?: string): Promise<TicketDetail> {
  const ticketNumber = typeof requesterOrTicketNumber === "number" ? optionalTicketNumber : requesterOrTicketNumber;
  if (!ticketNumber) throw new ApiClientError("Unable to load Ticket.", 400);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/tickets/${encodeURIComponent(ticketNumber)}`, {
      credentials: "include",
      headers: authenticatedHeaders(),
    });
  } catch {
    throw new ApiClientError("Unable to load Ticket.", 0);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const details = readApiError(body);
    throw new ApiClientError("Unable to load Ticket.", response.status, details.code, details.fieldErrors);
  }
  const result = body as { ticket?: unknown } | null;
  if (!result || !isTicketDetail(result.ticket)) {
    throw new ApiClientError("Unable to load Ticket.", response.status);
  }
  return result.ticket;
}

export async function fetchTicketAttachments(
  requesterOrTicketNumber: number | string,
  optionalTicketNumber?: string,
): Promise<TicketAttachment[]> {
  const ticketNumber = typeof requesterOrTicketNumber === "number" ? optionalTicketNumber : requesterOrTicketNumber;
  if (!ticketNumber) throw new ApiClientError("Unable to load Attachments.", 400);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/tickets/${encodeURIComponent(ticketNumber)}/attachments`, {
      credentials: "include",
      headers: authenticatedHeaders(),
    });
  } catch {
    throw new ApiClientError("Unable to load Attachments.", 0);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const details = readApiError(body);
    throw new ApiClientError("Unable to load Attachments.", response.status, details.code, details.fieldErrors);
  }
  const result = body as { attachments?: unknown } | null;
  if (!result || !Array.isArray(result.attachments) || !result.attachments.every(isTicketAttachment)) {
    throw new ApiClientError("Unable to load Attachments.", response.status);
  }
  return result.attachments;
}

function isPublicComment(value: unknown): value is PublicComment {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const author = candidate.author as Record<string, unknown> | null;
  return Boolean(
    typeof candidate.id === "number" && Number.isSafeInteger(candidate.id) && candidate.id > 0 &&
    typeof candidate.content === "string" && typeof candidate.createdAt === "string" &&
    author && typeof author.id === "number" && typeof author.name === "string" && typeof author.email === "string" &&
    ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"].includes(author.role as string),
  );
}

export async function fetchTicketComments(requesterOrTicketNumber: number | string, optionalTicketNumber?: string): Promise<PublicComment[]> {
  const ticketNumber = typeof requesterOrTicketNumber === "number" ? optionalTicketNumber : requesterOrTicketNumber;
  if (!ticketNumber) throw new ApiClientError("Unable to load Public Comments.", 400);
  let response: Response;
  try { response = await fetch(`${API_URL}/api/tickets/${encodeURIComponent(ticketNumber)}/comments`, { credentials: "include", headers: authenticatedHeaders() }); }
  catch { throw new ApiClientError("Unable to load Public Comments.", 0); }
  const body = await parseResponseBody(response);
  if (!response.ok) { const details = readApiError(body); throw new ApiClientError("Unable to load Public Comments.", response.status, details.code, details.fieldErrors); }
  const result = body as { comments?: unknown } | null;
  if (!result || !Array.isArray(result.comments) || !result.comments.every(isPublicComment)) throw new ApiClientError("Unable to load Public Comments.", response.status);
  return result.comments;
}

export async function addPublicComment(requesterOrTicketNumber: number | string, ticketNumberOrContent: string, optionalContent?: string): Promise<PublicComment> {
  const ticketNumber = typeof requesterOrTicketNumber === "number" ? ticketNumberOrContent : requesterOrTicketNumber;
  const content = typeof requesterOrTicketNumber === "number" ? optionalContent : ticketNumberOrContent;
  if (!content || !ticketNumber) throw new ApiClientError("Unable to add Public Comment.", 400);
  let response: Response;
  try { response = await fetch(`${API_URL}/api/tickets/${encodeURIComponent(ticketNumber)}/comments`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", ...authenticatedHeaders(true) }, body: JSON.stringify({ content }) }); }
  catch { throw new ApiClientError("Unable to add Public Comment.", 0); }
  const body = await parseResponseBody(response);
  if (!response.ok) { const details = readApiError(body); throw new ApiClientError("Unable to add Public Comment.", response.status, details.code, details.fieldErrors); }
  const result = body as { comment?: unknown } | null;
  if (!result || !isPublicComment(result.comment)) throw new ApiClientError("Unable to add Public Comment.", response.status);
  return result.comment;
}

export async function indicateTicketResolution(requesterOrTicketNumber: number | string, optionalTicketNumber?: string): Promise<ResolutionIndication> {
  const ticketNumber = typeof requesterOrTicketNumber === "number" ? optionalTicketNumber : requesterOrTicketNumber;
  if (!ticketNumber) throw new ApiClientError("Unable to record the resolution indication.", 400);
  let response: Response;
  try { response = await fetch(`${API_URL}/api/tickets/${encodeURIComponent(ticketNumber)}/resolution-indication`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", ...authenticatedHeaders(true) }, body: "{}" }); }
  catch { throw new ApiClientError("Unable to record the resolution indication.", 0); }
  const body = await parseResponseBody(response);
  if (!response.ok) { const details = readApiError(body); throw new ApiClientError("Unable to record the resolution indication.", response.status, details.code, details.fieldErrors); }
  const indication = (body as { resolutionIndication?: unknown } | null)?.resolutionIndication;
  if (typeof indication !== "object" || indication === null || typeof (indication as Record<string, unknown>).indicatedAt !== "string") throw new ApiClientError("Unable to record the resolution indication.", response.status);
  return indication as ResolutionIndication;
}

export async function addTicketAttachment(
  requesterOrTicketNumber: number | string,
  ticketNumberOrFile: string | File,
  optionalFile?: File,
): Promise<TicketAttachment> {
  const ticketNumber = typeof requesterOrTicketNumber === "number" ? ticketNumberOrFile as string : requesterOrTicketNumber;
  const file = typeof requesterOrTicketNumber === "number" ? optionalFile : ticketNumberOrFile as File;
  if (!file || typeof ticketNumber !== "string") throw new ApiClientError("Unable to upload Attachment.", 400);
  const formData = new FormData();
  formData.append("file", file, file.name);
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/tickets/${encodeURIComponent(ticketNumber)}/attachments`, {
      method: "POST",
      credentials: "include",
      headers: authenticatedHeaders(true),
      body: formData,
    });
  } catch {
    throw new ApiClientError("Unable to upload Attachment.", 0);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const details = readApiError(body);
    throw new ApiClientError("Unable to upload Attachment.", response.status, details.code, details.fieldErrors);
  }
  const result = body as { attachment?: unknown } | null;
  if (!result || !isTicketAttachment(result.attachment)) {
    throw new ApiClientError("Unable to upload Attachment.", response.status);
  }
  return result.attachment;
}

export async function downloadTicketAttachment(
  requesterOrTicketNumber: number | string,
  ticketNumberOrAttachmentId: string | number,
  optionalAttachmentId?: number,
): Promise<Blob> {
  const ticketNumber = typeof requesterOrTicketNumber === "number" ? ticketNumberOrAttachmentId as string : requesterOrTicketNumber;
  const attachmentId = typeof requesterOrTicketNumber === "number" ? optionalAttachmentId : ticketNumberOrAttachmentId as number;
  if (typeof ticketNumber !== "string" || typeof attachmentId !== "number") throw new ApiClientError("Unable to download Attachment.", 400);
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/api/tickets/${encodeURIComponent(ticketNumber)}/attachments/${attachmentId}/download`,
      { credentials: "include", headers: authenticatedHeaders() },
    );
  } catch {
    throw new ApiClientError("Unable to download Attachment.", 0);
  }
  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const details = readApiError(body);
    throw new ApiClientError("Unable to download Attachment.", response.status, details.code, details.fieldErrors);
  }
  try {
    return await response.blob();
  } catch {
    throw new ApiClientError("Unable to download Attachment.", response.status);
  }
}

export async function removeTicketAttachment(
  requesterOrTicketNumber: number | string,
  ticketNumberOrAttachmentId: string | number,
  attachmentOrReason: number | string,
  optionalReason?: string,
): Promise<TicketAttachment> {
  const ticketNumber = typeof requesterOrTicketNumber === "number" ? ticketNumberOrAttachmentId as string : requesterOrTicketNumber;
  const attachmentId = typeof requesterOrTicketNumber === "number" ? attachmentOrReason as number : ticketNumberOrAttachmentId as number;
  const removalReason = typeof requesterOrTicketNumber === "number" ? optionalReason : attachmentOrReason as string;
  if (typeof ticketNumber !== "string" || typeof attachmentId !== "number" || typeof removalReason !== "string") throw new ApiClientError("Unable to remove Attachment.", 400);
  let response: Response;
  try {
    response = await fetch(
      `${API_URL}/api/tickets/${encodeURIComponent(ticketNumber)}/attachments/${attachmentId}`,
      {
        method: "DELETE",
        credentials: "include",
        headers: {
          ...authenticatedHeaders(true),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ removalReason }),
      },
    );
  } catch {
    throw new ApiClientError("Unable to remove Attachment.", 0);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const details = readApiError(body);
    throw new ApiClientError("Unable to remove Attachment.", response.status, details.code, details.fieldErrors);
  }
  const result = body as { attachment?: unknown } | null;
  if (!result || !isTicketAttachment(result.attachment)) {
    throw new ApiClientError("Unable to remove Attachment.", response.status);
  }
  return result.attachment;
}

export async function checkHealth(): Promise<HealthStatus> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}/api/health`);
  } catch {
    throw new Error("Unable to connect to TokTickIT API.");
  }

  if (!response.ok) {
    throw new Error("Unable to connect to TokTickIT API.");
  }

  const health = (await response.json()) as Partial<HealthStatus>;
  if (health.status !== "ok" || typeof health.service !== "string") {
    throw new Error("TokTickIT API returned an invalid health response.");
  }

  return { status: health.status, service: health.service };
}

// Issue 2 + Issue 4 — call the backend.
// Steps: fetch `${API_URL}/api/health`; if not ok, throw.
//        then fetch `${API_URL}/api/categories`; if not ok, throw.
//        return { online: true, categories }.
// Throwing on failure lets the UI show a single Offline/error state.
export async function checkSystem(): Promise<SystemStatus> {
  const health = await checkHealth();
  let response: Response;

  try {
    response = await fetch(`${API_URL}/api/categories`);
  } catch {
    throw new Error("Unable to load request categories.");
  }

  if (!response.ok) {
    throw new Error("Unable to load request categories.");
  }

  try {
    const categories = (await response.json()) as unknown;
    if (
      !Array.isArray(categories) ||
      !categories.every((category): category is Category => {
        if (typeof category !== "object" || category === null) {
          return false;
        }

        const candidate = category as Record<string, unknown>;
        return typeof candidate.id === "number" && typeof candidate.name === "string";
      })
    ) {
      throw new Error("Invalid category response.");
    }

    return { online: true, service: health.service, categories };
  } catch {
    throw new Error("Unable to load request categories.");
  }
}
