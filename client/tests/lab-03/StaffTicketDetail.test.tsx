import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StaffTicketDetail from "../../src/StaffTicketDetail.js";
import * as api from "../../src/api.js";

const ticket: api.StaffTicket = {
  id: 1,
  ticketNumber: "TKT-2026-000001",
  requester: { id: 1, name: "Amina Rahman", email: "amina@example.test" },
  category: { id: 2, name: "Hardware" },
  relatedSystem: { id: 1, name: "Campus Wi-Fi" },
  requestedPriority: "HIGH",
  itPriority: "MEDIUM",
  status: "OPEN",
  summary: "Campus Wi-Fi disconnects",
  description: "The connection drops repeatedly during class.",
  ticketOwner: { id: 8, name: "Michael Brown", email: "michael@example.com", role: "IT_STAFF" },
  resolutionIndication: null,
  createdAt: "2026-09-13T10:00:00.000Z",
  updatedAt: "2026-09-13T10:05:00.000Z",
};
const assignees: api.StaffAssignee[] = [
  { id: 8, name: "Michael Brown", email: "michael@example.test", role: "IT_STAFF" },
  { id: 9, name: "Priya Shah", email: "priya@example.test", role: "ADMINISTRATOR" },
];

describe("Lab 3 Staff Ticket Detail operations", () => {
  beforeEach(() => {
    vi.spyOn(api, "fetchStaffTicket").mockResolvedValue(ticket);
    vi.spyOn(api, "fetchStaffAssignees").mockResolvedValue(assignees);
    vi.spyOn(api, "fetchTicketAttachments").mockResolvedValue([]);
    vi.spyOn(api, "fetchTicketComments").mockResolvedValue([]);
    vi.spyOn(api, "fetchInternalNotes").mockResolvedValue([]);
    vi.spyOn(api, "updateStaffTicketAssignment").mockResolvedValue({ ...ticket, ticketOwner: assignees[0] });
    vi.spyOn(api, "updateStaffTicketPriority").mockResolvedValue({ ...ticket, itPriority: "URGENT" });
    vi.spyOn(api, "updateStaffTicketStatus").mockResolvedValue({ ...ticket, status: "RESOLVED" });
    vi.spyOn(api, "addPublicComment").mockResolvedValue({ id: 3, content: "Staff update", author: { id: 8, name: "Michael Brown", email: "michael@example.test", role: "IT_STAFF" }, createdAt: "2026-09-13T10:06:00.000Z" });
    vi.spyOn(api, "addInternalNote").mockResolvedValue({ id: 4, content: "Private note", author: { id: 8, name: "Michael Brown", email: "michael@example.test", role: "IT_STAFF" }, createdAt: "2026-09-13T10:07:00.000Z" });
  });

  afterEach(() => vi.restoreAllMocks());

  it("renders the staff operation controls and keeps comments and notes distinct", async () => {
    render(<StaffTicketDetail ticketNumber={ticket.ticketNumber} currentUserId={8} navigate={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Staff Ticket Detail" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ticket Operations" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Assignee" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "IT Priority" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Public Comments" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Internal Notes" })).toBeInTheDocument();
    expect(screen.getByText("Never shown to Requesters.")).toBeInTheDocument();
  });

  it("requires confirmation for reassignment and terminal status changes", async () => {
    const user = userEvent.setup();
    render(<StaffTicketDetail ticketNumber={ticket.ticketNumber} currentUserId={8} navigate={vi.fn()} />);
    await screen.findByRole("heading", { name: "Staff Ticket Detail" });

    await user.selectOptions(screen.getByRole("combobox", { name: "Assignee" }), "9");
    await user.click(screen.getByRole("button", { name: "Assign / Reassign" }));
    expect(await screen.findByRole("dialog", { name: "Confirm reassignment" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(api.updateStaffTicketAssignment).toHaveBeenCalledWith(ticket.ticketNumber, 9, true));

    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "RESOLVED");
    await user.click(screen.getByRole("button", { name: "Save Status" }));
    expect(await screen.findByRole("dialog", { name: "Change status to RESOLVED?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(api.updateStaffTicketStatus).toHaveBeenCalledWith(ticket.ticketNumber, "RESOLVED", true));
  });

  it("posts a public comment and a staff-only internal note", async () => {
    const user = userEvent.setup();
    render(<StaffTicketDetail ticketNumber={ticket.ticketNumber} navigate={vi.fn()} />);
    await screen.findByRole("heading", { name: "Staff Ticket Detail" });
    await user.type(screen.getByLabelText("Add Public Comment"), "Staff update");
    await user.click(screen.getByRole("button", { name: "Post Public Comment" }));
    await waitFor(() => expect(api.addPublicComment).toHaveBeenCalledWith(ticket.ticketNumber, "Staff update"));
    await user.type(screen.getByLabelText("Add Internal Note"), "Private note");
    await user.click(screen.getByRole("button", { name: "Post Internal Note" }));
    await waitFor(() => expect(api.addInternalNote).toHaveBeenCalledWith(ticket.ticketNumber, "Private note"));
  });
});
