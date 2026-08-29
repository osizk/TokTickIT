import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TicketDetail from "../../src/TicketDetail.js";
import * as api from "../../src/api.js";

const requester: api.Requester = { id: 1, name: "Amina Rahman", email: "amina@example.test" };
const ticket: api.TicketDetail = {
  id: 100,
  ticketNumber: "TKT-2026-000001",
  requester,
  category: { id: 10, name: "Hardware" },
  relatedSystem: { id: 20, name: "Network" },
  requestedPriority: "HIGH",
  status: "NEW",
  summary: "VPN access fails",
  description: "The VPN connection fails after entering valid credentials.",
  createdAt: "2026-08-27T08:30:00.000Z",
  updatedAt: "2026-08-27T09:30:00.000Z",
};
const activeAttachment: api.TicketAttachment = {
  id: 11,
  originalName: "evidence.pdf",
  mimeType: "application/pdf",
  sizeBytes: 24,
  uploadedAt: "2026-08-27T08:31:00.000Z",
  removedAt: null,
  removalReason: null,
  removedByRequesterId: null,
};
const removedAttachment: api.TicketAttachment = {
  id: 12,
  originalName: "old-evidence.pdf",
  mimeType: "application/pdf",
  sizeBytes: 18,
  uploadedAt: "2026-08-27T08:32:00.000Z",
  removedAt: "2026-08-27T10:00:00.000Z",
  removalReason: "No longer needed.",
  removedByRequesterId: requester.id,
};

describe("Ticket Detail", () => {
  beforeEach(() => {
    vi.spyOn(api, "fetchTicket").mockResolvedValue(ticket);
    vi.spyOn(api, "fetchTicketAttachments").mockResolvedValue([activeAttachment, removedAttachment]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows owned read-only fields and excludes staff workflow fields", async () => {
    render(<TicketDetail requester={requester} ticketNumber={ticket.ticketNumber} navigate={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Ticket Detail" })).toBeInTheDocument();
    expect(screen.getByLabelText("Ticket Number")).toHaveValue(ticket.ticketNumber);
    expect(screen.getByLabelText("Requester")).toHaveValue("Amina Rahman (amina@example.test)");
    expect(screen.getByLabelText("Category")).toHaveValue("Hardware");
    expect(screen.getByLabelText("Related System")).toHaveValue("Network");
    expect(screen.getByLabelText("Requested Priority")).toHaveValue("HIGH");
    expect(screen.getByLabelText("Current Status")).toHaveValue("NEW");
    expect(screen.getByLabelText("Summary")).toHaveValue("VPN access fails");
    expect(screen.getByLabelText("Description")).toHaveValue(ticket.description);
    for (const field of ["Ticket Number", "Ticket Date", "Requester", "Category", "Related System", "Requested Priority", "Current Status", "Summary", "Description"]) {
      expect(screen.getByLabelText(field)).toHaveAttribute("readonly");
    }
    expect(screen.queryByText(/Actions Taken|Resolution|Internal Notes|Comments/)).not.toBeInTheDocument();
  });

  it("keeps Ticket and Attachment loading states independent and offers safe retry", async () => {
    vi.mocked(api.fetchTicket).mockRejectedValueOnce(new Error("private database detail"));
    vi.mocked(api.fetchTicketAttachments).mockRejectedValueOnce(new Error("private attachment detail"));
    const user = userEvent.setup();
    render(<TicketDetail requester={requester} ticketNumber={ticket.ticketNumber} navigate={vi.fn()} />);

    expect(await screen.findByRole("alert", { name: "Ticket detail loading error" })).toHaveTextContent("Unable to load Ticket.");
    expect(screen.getByRole("alert", { name: "Attachment loading error" })).toHaveTextContent("Unable to load Attachments.");
    expect(screen.queryByText(/private database detail|private attachment detail/)).not.toBeInTheDocument();

    vi.mocked(api.fetchTicket).mockResolvedValue(ticket);
    vi.mocked(api.fetchTicketAttachments).mockResolvedValue([activeAttachment]);
    await user.click(screen.getByRole("alert", { name: "Ticket detail loading error" }).querySelector("button")!);
    await user.click(screen.getByRole("alert", { name: "Attachment loading error" }).querySelector("button")!);
    expect(await screen.findByDisplayValue(ticket.ticketNumber)).toBeInTheDocument();
    expect(await screen.findByText("evidence.pdf")).toBeInTheDocument();
  });
});
