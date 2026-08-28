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

export interface RelatedSystem {
  id: number;
  name: string;
}

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

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

export interface CreatedTicket {
  id: number;
  ticketNumber: string;
  requester: Requester;
  category: Category;
  relatedSystem: RelatedSystem;
  requestedPriority: TicketPriority;
  status: "NEW";
  summary: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  attachments: TicketAttachment[];
}

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

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiClientError";
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
    response = await fetch(`${API_URL}${endpoint}`);
  } catch {
    throw new Error(`Unable to load ${label}.`);
  }

  if (!response.ok) {
    throw new Error(`Unable to load ${label}.`);
  }

  try {
    const body = (await response.json()) as unknown;
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
    response = await fetch(`${API_URL}/api/requesters`);
  } catch {
    throw new Error("Unable to load Development Requesters.");
  }

  if (!response.ok) {
    throw new Error("Unable to load Development Requesters.");
  }

  try {
    const body = (await response.json()) as unknown;
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
    candidate.status === "NEW" &&
    typeof candidate.summary === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string" &&
    Array.isArray(candidate.attachments) &&
    candidate.attachments.every(isTicketAttachment)
  );
}

export async function createTicket(
  requesterId: number,
  input: CreateTicketInput,
): Promise<CreateTicketResponse> {
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
      headers: { "X-Requester-Id": String(requesterId) },
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
