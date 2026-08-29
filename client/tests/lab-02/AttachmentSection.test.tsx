import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TicketDetail from "../../src/TicketDetail.js";
import * as api from "../../src/api.js";

const requester: api.Requester = { id: 1, name: "Amina Rahman", email: "amina@example.test" };
const ticket: api.TicketDetail = {
  id: 101,
  ticketNumber: "TKT-2026-000002",
  requester,
  category: { id: 10, name: "Hardware" },
  relatedSystem: { id: 20, name: "Network" },
  requestedPriority: "MEDIUM",
  status: "NEW",
  summary: "Attachment UI test",
  description: "A sufficiently long description for the attachment UI test.",
  createdAt: "2026-08-27T08:30:00.000Z",
  updatedAt: "2026-08-27T09:30:00.000Z",
};
const active: api.TicketAttachment = {
  id: 21,
  originalName: "evidence.pdf",
  mimeType: "application/pdf",
  sizeBytes: 13,
  uploadedAt: "2026-08-27T08:31:00.000Z",
  removedAt: null,
  removalReason: null,
  removedByRequesterId: null,
};
const removed: api.TicketAttachment = {
  id: 22,
  originalName: "removed.pdf",
  mimeType: "application/pdf",
  sizeBytes: 13,
  uploadedAt: "2026-08-27T08:32:00.000Z",
  removedAt: "2026-08-27T09:00:00.000Z",
  removalReason: "Duplicate evidence.",
  removedByRequesterId: requester.id,
};

function renderDetail() {
  return render(<TicketDetail requester={requester} ticketNumber={ticket.ticketNumber} navigate={vi.fn()} />);
}

describe("Ticket Detail Attachments", () => {
  beforeEach(() => {
    vi.spyOn(api, "fetchTicket").mockResolvedValue(ticket);
    vi.spyOn(api, "fetchTicketAttachments").mockResolvedValue([active, removed]);
    vi.spyOn(api, "addTicketAttachment").mockResolvedValue({
      ...active,
      id: 23,
      originalName: "new.pdf",
    });
    vi.spyOn(api, "removeTicketAttachment").mockResolvedValue({
      ...active,
      removedAt: "2026-08-27T10:00:00.000Z",
      removalReason: "No longer needed.",
      removedByRequesterId: requester.id,
    });
    vi.spyOn(api, "downloadTicketAttachment").mockResolvedValue(new Blob(["pdf"]));
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    if (typeof URL.createObjectURL !== "function") {
      Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:test"), configurable: true });
    } else {
      vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    }
    if (typeof URL.revokeObjectURL !== "function") {
      Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
    } else {
      vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validates a signature, uploads one file, and exposes active download", async () => {
    const user = userEvent.setup();
    renderDetail();
    expect(await screen.findByText("evidence.pdf")).toBeInTheDocument();

    const file = new File(["%PDF-1.7\nnew"], "new.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Add Attachment"), { target: { files: [file] } });
    expect(await screen.findByText("Ready to upload: new.pdf")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Upload Attachment" }));
    await waitFor(() => expect(api.addTicketAttachment).toHaveBeenCalledWith(1, ticket.ticketNumber, file));
    expect(await screen.findByText("Attachment uploaded successfully.")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Download" })[0]);
    await waitFor(() => expect(api.downloadTicketAttachment).toHaveBeenCalledWith(1, ticket.ticketNumber, 21));
  });

  it("requires a removal reason and renders a removed attachment without Download or Preview", async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText("evidence.pdf");
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm Removal" })).toBeDisabled();
    await user.type(screen.getByLabelText("Removal reason"), "No longer needed.");
    await user.click(screen.getByRole("button", { name: "Confirm Removal" }));
    await waitFor(() => expect(api.removeTicketAttachment).toHaveBeenCalledWith(1, ticket.ticketNumber, 21, "No longer needed."));
    expect(screen.getByText(/Reason: No longer needed\./)).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: "Download" })).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Preview" })).not.toBeInTheDocument();
  });

  it("rejects a metadata-invalid file before upload", async () => {
    renderDetail();
    await screen.findByText("evidence.pdf");
    const file = new File(["not allowed"], "notes.txt", { type: "text/plain" });
    fireEvent.change(screen.getByLabelText("Add Attachment"), { target: { files: [file] } });
    expect(await screen.findByText(/supported extension and matching MIME type/)).toBeInTheDocument();
    expect(api.addTicketAttachment).not.toHaveBeenCalled();
  });
});
