import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { createTicketFromMultipart, toApiError } from "./ticket-service.js";
import { listTickets } from "./ticket-list-service.js";
import {
  addTicketAttachment,
  downloadTicketAttachment,
  getTicketAttachments,
  getTicketDetail,
  removeTicketAttachment,
} from "./ticket-detail-service.js";
import {
  AuthError,
  assertAllowedOrigin,
  assertCsrf,
  authenticate,
  changePassword,
  expiredSessionCookie,
  optionalSession,
  requireSession,
  requireUsableSession,
  safeUser,
  sessionCookie,
  revokeFromRequest,
  configuredClientOrigin,
  rotateCsrfToken,
  requireRole,
  requesterIdForContext,
} from "./auth-service.js";
import { validateEmail, validatePassword } from "./auth-validation.js";
import { createPublicComment, indicateResolution, listPublicComments } from "./comment-service.js";
import { listStaffAssignees, listStaffTickets } from "./staff-queue-service.js";

export const app = express();

app.use(cors({ origin: configuredClientOrigin(), credentials: true }));
app.use(express.json());
app.disable("etag");

function markUncached(res: Response) {
  res.set("Cache-Control", "no-store");
}

function sendReferenceError(res: Response, message: string) {
  res.status(500).json({
    error: {
      code: "REFERENCE_DATA_UNAVAILABLE",
      message,
    },
  });
}

function sendAuthError(res: Response, error: unknown) {
  const details = error instanceof AuthError
    ? error
    : new AuthError(500, "AUTHENTICATION_FAILED", "Authentication could not be completed.");
  markUncached(res);
  res.status(details.statusCode).json({
    error: {
      code: details.code,
      message: details.message,
      ...(details.fieldErrors ? { fieldErrors: details.fieldErrors } : {}),
    },
  });
}

function sendTicketError(res: Response, error: unknown) {
  if (error instanceof AuthError) {
    sendAuthError(res, error);
    return;
  }
  const details = toApiError(error);
  markUncached(res);
  res.status(details.statusCode).json({
    error: {
      code: details.code,
      message: details.message,
      ...(details.fieldErrors ? { fieldErrors: details.fieldErrors } : {}),
    },
  });
}

async function requireAuthenticated(req: Request) {
  return requireUsableSession(req);
}

async function requireRequester(req: Request) {
  const context = await requireUsableSession(req);
  requireRole(context, "REQUESTER");
  return { context, requesterId: requesterIdForContext(context) };
}

async function requireStaff(req: Request) {
  const context = await requireUsableSession(req);
  requireRole(context, "IT_STAFF", "ADMINISTRATOR");
  return context;
}

app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    assertAllowedOrigin(req);
    const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
    const emailResult = validateEmail(body.email);
    const fieldErrors: Record<string, string> = {};
    if (!emailResult.ok || typeof emailResult.value !== "string") fieldErrors.email = emailResult.ok ? "Enter a valid email address." : emailResult.message;
    if (typeof body.password !== "string" || body.password.length === 0) fieldErrors.password = "Password is required.";
    if (Object.keys(fieldErrors).length > 0) {
      throw new AuthError(400, "VALIDATION_ERROR", "Check the highlighted fields.", fieldErrors);
    }
    const normalizedEmail = emailResult.ok && typeof emailResult.value === "string" ? emailResult.value : "";
    const result = await authenticate(normalizedEmail, body.password as string, req);
    res.setHeader("Set-Cookie", sessionCookie(result.token));
    markUncached(res);
    res.status(200).json({ user: safeUser(result.user), csrfToken: result.csrfToken });
  } catch (error) {
    sendAuthError(res, error);
  }
});

app.get("/api/auth/me", async (req: Request, res: Response) => {
  try {
    const context = await requireSession(req);
    const csrfToken = await rotateCsrfToken(context);
    markUncached(res);
    res.status(200).json({ user: safeUser(context.user), csrfToken });
  } catch (error) {
    sendAuthError(res, error);
  }
});

app.post("/api/auth/change-password", async (req: Request, res: Response) => {
  try {
    assertAllowedOrigin(req);
    const context = await requireSession(req);
    assertCsrf(context, req);
    const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
    const fieldErrors: Record<string, string> = {};
    if (typeof body.currentPassword !== "string" || body.currentPassword.length === 0) fieldErrors.currentPassword = "Current password is required.";
    const newPasswordResult = validatePassword(body.newPassword);
    if (!newPasswordResult.ok) fieldErrors.newPassword = newPasswordResult.message;
    if (body.confirmPassword !== body.newPassword) fieldErrors.confirmPassword = "Passwords must match.";
    if (Object.keys(fieldErrors).length > 0) {
      throw new AuthError(400, "VALIDATION_ERROR", "Check the highlighted fields.", fieldErrors);
    }
    const result = await changePassword(context, body.currentPassword as string, body.newPassword as string);
    res.setHeader("Set-Cookie", sessionCookie(result.token));
    markUncached(res);
    res.status(200).json({ user: safeUser(result.user), csrfToken: result.csrfToken });
  } catch (error) {
    sendAuthError(res, error);
  }
});

app.post("/api/auth/logout", async (req: Request, res: Response) => {
  try {
    assertAllowedOrigin(req);
    const context = await optionalSession(req);
    if (context) {
      assertCsrf(context, req);
      await revokeFromRequest(req);
    }
    res.setHeader("Set-Cookie", expiredSessionCookie());
    markUncached(res);
    res.status(204).send();
  } catch (error) {
    sendAuthError(res, error);
  }
});

app.get("/api/health", (_req: Request, res: Response) => {
  markUncached(res);
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

app.get("/api/categories", async (req: Request, res: Response) => {
  try {
    await requireAuthenticated(req);
    const categories = await getPrisma().category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    markUncached(res);
    res.status(200).json(categories);
  } catch (error) {
    if (error instanceof AuthError) sendAuthError(res, error);
    else sendReferenceError(res, "Unable to load categories.");
  }
});

app.get("/api/related-systems", async (req: Request, res: Response) => {
  try {
    await requireAuthenticated(req);
    const relatedSystems = await getPrisma().relatedSystem.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ id: "asc" }, { name: "asc" }],
    });

    markUncached(res);
    res.status(200).json(relatedSystems);
  } catch (error) {
    if (error instanceof AuthError) sendAuthError(res, error);
    else sendReferenceError(res, "Unable to load related systems.");
  }
});

app.get("/api/requesters", async (req: Request, res: Response) => {
  try {
    await requireAuthenticated(req);
    const requesters = await getPrisma().requester.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: [{ id: "asc" }, { name: "asc" }],
    });

    markUncached(res);
    res.status(200).json(requesters);
  } catch (error) {
    if (error instanceof AuthError) sendAuthError(res, error);
    else sendReferenceError(res, "Unable to load requesters.");
  }
});

app.get("/api/staff/tickets", async (req: Request, res: Response) => {
  try {
    const context = await requireStaff(req);
    const result = await listStaffTickets(req, context.user.id);
    markUncached(res);
    res.status(200).json(result);
  } catch (error) {
    sendTicketError(res, error);
  }
});

app.get("/api/staff/assignees", async (req: Request, res: Response) => {
  try {
    await requireStaff(req);
    const result = await listStaffAssignees();
    markUncached(res);
    res.status(200).json(result);
  } catch (error) {
    sendTicketError(res, error);
  }
});

app.get("/api/tickets", async (req: Request, res: Response) => {
  try {
    const { requesterId } = await requireRequester(req);
    const result = await listTickets(req, requesterId);
    markUncached(res);
    res.status(200).json(result);
  } catch (error) {
    sendTicketError(res, error);
  }
});

app.post("/api/tickets", async (req: Request, res: Response) => {
  try {
    assertAllowedOrigin(req);
    const { context, requesterId } = await requireRequester(req);
    assertCsrf(context, req);
    const result = await createTicketFromMultipart(req, requesterId);
    markUncached(res);
    res.status(201).json(result);
  } catch (error) {
    sendTicketError(res, error);
  }
});

app.get("/api/tickets/:ticketNumber", async (req: Request, res: Response) => {
  try {
    const { requesterId } = await requireRequester(req);
    const result = await getTicketDetail(req, req.params.ticketNumber, requesterId);
    markUncached(res);
    res.status(200).json(result);
  } catch (error) {
    sendTicketError(res, error);
  }
});

app.get("/api/tickets/:ticketNumber/attachments", async (req: Request, res: Response) => {
  try {
    const { requesterId } = await requireRequester(req);
    const result = await getTicketAttachments(req, req.params.ticketNumber, requesterId);
    markUncached(res);
    res.status(200).json(result);
  } catch (error) {
    sendTicketError(res, error);
  }
});

app.get("/api/tickets/:ticketNumber/comments", async (req: Request, res: Response) => {
  try {
    const { context } = await requireRequester(req);
    const result = await listPublicComments(context, req.params.ticketNumber);
    markUncached(res);
    res.status(200).json(result);
  } catch (error) {
    sendTicketError(res, error);
  }
});

app.post("/api/tickets/:ticketNumber/comments", async (req: Request, res: Response) => {
  try {
    assertAllowedOrigin(req);
    const { context } = await requireRequester(req);
    assertCsrf(context, req);
    const result = await createPublicComment(context, req.params.ticketNumber, req.body);
    markUncached(res);
    res.status(201).json(result);
  } catch (error) {
    sendTicketError(res, error);
  }
});

app.post("/api/tickets/:ticketNumber/resolution-indication", async (req: Request, res: Response) => {
  try {
    assertAllowedOrigin(req);
    const { context } = await requireRequester(req);
    assertCsrf(context, req);
    const result = await indicateResolution(context, req.params.ticketNumber);
    markUncached(res);
    res.status(200).json(result);
  } catch (error) {
    sendTicketError(res, error);
  }
});

app.post("/api/tickets/:ticketNumber/attachments", async (req: Request, res: Response) => {
  try {
    assertAllowedOrigin(req);
    const { context, requesterId } = await requireRequester(req);
    assertCsrf(context, req);
    const result = await addTicketAttachment(req, req.params.ticketNumber, requesterId);
    markUncached(res);
    res.status(201).json(result);
  } catch (error) {
    sendTicketError(res, error);
  }
});

function safeContentDisposition(originalName: string): string {
  const fallback = originalName
    .replace(/[\r\n"\\;]/g, "_")
    .replace(/[^\x20-\x7e]/g, "_")
    .slice(0, 180) || "attachment";
  const encoded = encodeURIComponent(originalName).replace(/['()]/g, escape);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

app.get("/api/tickets/:ticketNumber/attachments/:attachmentId/download", async (req: Request, res: Response) => {
  try {
    const { requesterId } = await requireRequester(req);
    const result = await downloadTicketAttachment(req, req.params.ticketNumber, req.params.attachmentId, requesterId);
    markUncached(res);
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("Content-Disposition", safeContentDisposition(result.originalName));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(result.body);
  } catch (error) {
    sendTicketError(res, error);
  }
});

app.delete("/api/tickets/:ticketNumber/attachments/:attachmentId", async (req: Request, res: Response) => {
  try {
    assertAllowedOrigin(req);
    const { context, requesterId } = await requireRequester(req);
    assertCsrf(context, req);
    const result = await removeTicketAttachment(req, req.params.ticketNumber, req.params.attachmentId, requesterId);
    markUncached(res);
    res.status(200).json(result);
  } catch (error) {
    sendTicketError(res, error);
  }
});

// Express parses JSON before route handlers run. Convert parser/size failures
// into the same structured safe-error contract used by the API routes.
app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  const record = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
  const status = record.status === 413 || record.statusCode === 413 || record.type === "entity.too.large" ? 413 : 400;
  markUncached(res);
  res.status(status).json({
    error: {
      code: status === 413 ? "REQUEST_BODY_TOO_LARGE" : "REQUEST_BODY_INVALID",
      message: status === 413 ? "Request body is too large." : "Request body could not be read.",
    },
  });
});

export default app;
