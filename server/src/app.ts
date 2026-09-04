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

export const app = express();

app.use(cors());
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

app.get("/api/health", (_req: Request, res: Response) => {
  markUncached(res);
  res.status(200).json({ status: "ok", service: "TokTickIT API" });
});

app.get("/api/categories", async (_req: Request, res: Response) => {
  try {
    const categories = await getPrisma().category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });

    markUncached(res);
    res.status(200).json(categories);
  } catch {
    sendReferenceError(res, "Unable to load categories.");
  }
});

app.get("/api/related-systems", async (_req: Request, res: Response) => {
  try {
    const relatedSystems = await getPrisma().relatedSystem.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ id: "asc" }, { name: "asc" }],
    });

    markUncached(res);
    res.status(200).json(relatedSystems);
  } catch {
    sendReferenceError(res, "Unable to load related systems.");
  }
});

app.get("/api/requesters", async (_req: Request, res: Response) => {
  try {
    const requesters = await getPrisma().requester.findMany({
      where: { isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: [{ id: "asc" }, { name: "asc" }],
    });

    markUncached(res);
    res.status(200).json(requesters);
  } catch {
    sendReferenceError(res, "Unable to load requesters.");
  }
});

app.get("/api/tickets", async (req: Request, res: Response) => {
  try {
    const result = await listTickets(req);
    markUncached(res);
    res.status(200).json(result);
  } catch (error) {
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
});

app.post("/api/tickets", async (req: Request, res: Response) => {
  try {
    const result = await createTicketFromMultipart(req);
    markUncached(res);
    res.status(201).json(result);
  } catch (error) {
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
});

app.get("/api/tickets/:ticketNumber", async (req: Request, res: Response) => {
  try {
    const result = await getTicketDetail(req, req.params.ticketNumber);
    markUncached(res);
    res.status(200).json(result);
  } catch (error) {
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
});

app.get("/api/tickets/:ticketNumber/attachments", async (req: Request, res: Response) => {
  try {
    const result = await getTicketAttachments(req, req.params.ticketNumber);
    markUncached(res);
    res.status(200).json(result);
  } catch (error) {
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
});

app.post("/api/tickets/:ticketNumber/attachments", async (req: Request, res: Response) => {
  try {
    const result = await addTicketAttachment(req, req.params.ticketNumber);
    markUncached(res);
    res.status(201).json(result);
  } catch (error) {
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
    const result = await downloadTicketAttachment(req, req.params.ticketNumber, req.params.attachmentId);
    markUncached(res);
    res.setHeader("Content-Type", result.mimeType);
    res.setHeader("Content-Disposition", safeContentDisposition(result.originalName));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(result.body);
  } catch (error) {
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
});

app.delete("/api/tickets/:ticketNumber/attachments/:attachmentId", async (req: Request, res: Response) => {
  try {
    const result = await removeTicketAttachment(req, req.params.ticketNumber, req.params.attachmentId);
    markUncached(res);
    res.status(200).json(result);
  } catch (error) {
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
