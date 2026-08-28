import express, { Request, Response } from "express";
import cors from "cors";
import { getPrisma } from "./prisma.js";
import { createTicketFromMultipart, toApiError } from "./ticket-service.js";

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

export default app;
