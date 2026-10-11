import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import StaffTicketDetail from "../../src/StaffTicketDetail.js";
import TicketWorkflow from "../../src/TicketWorkflow.js";

const ticket: api.StaffTicketDetail = {
  id: 4,
  ticketNumber: "TKT-2026-000058",
  requester: { id: 2, name: "Amina Rahman", email: "amina@example.test" },
  category: { id: 1, name: "Hardware" },
  relatedSystem: { id: 1, name: "Campus Wi-Fi" },
  requestedPriority: "MEDIUM",
  itPriority: "LOW",
  status: "OPEN",
  summary: "Wi-Fi disconnects repeatedly",
  description: "The connection disconnects throughout the day.",
  ticketOwner: { id: 8, name: "Michael Brown", email: "michael@example.test", role: "IT_STAFF" },
  resolutionIndication: { indicatedAt: "2026-10-11T10:00:00.000Z", indicatedBy: { id: 2, name: "Amina Rahman", email: "amina@example.test", role: "REQUESTER" } },
  workflowVersion: 5,
  createdAt: "2026-10-10T10:00:00.000Z",
  updatedAt: "2026-10-11T10:00:00.000Z",
  allowedTransitions: ["IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"],
  resolutionGate: { canResolve: false, canClose: false, unmetConditions: ["COMPLETED_ACTION_REQUIRED", "UNFINISHED_ACTIONS"] },
};
const pagination: api.TicketListPagination = { page: 1, pageSize: 25, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false };

describe("Lab 4 Ticket workflow UI", () => {
  beforeEach(() => {
    vi.spyOn(api, "fetchTicketWorkflowEvents").mockResolvedValue({ events: [], pagination });
    vi.spyOn(api, "fetchStaffTicket").mockResolvedValue(ticket);
    vi.spyOn(api, "fetchStaffAssignees").mockResolvedValue([ticket.ticketOwner!] as never);
    vi.spyOn(api, "fetchTicketAttachments").mockResolvedValue([]);
    vi.spyOn(api, "fetchTicketComments").mockResolvedValue([]);
    vi.spyOn(api, "fetchInternalNotes").mockResolvedValue([]);
    vi.spyOn(api, "fetchActionsTaken").mockResolvedValue({ actions: [], pagination, ticketVersion: 5 });
    vi.spyOn(api, "updateStaffTicketStatus").mockResolvedValue({ ...ticket, status: "CANCELLED", workflowVersion: 6 });
  });

  afterEach(() => vi.restoreAllMocks());

  it("keeps the Requester indication advisory and renders immutable status history", async () => {
    vi.mocked(api.fetchTicketWorkflowEvents).mockResolvedValueOnce({
      events: [{ id: 7, ticketNumber: ticket.ticketNumber, actor: { id: 8, name: "Michael Brown", email: "michael@example.test", role: "IT_STAFF" }, fromStatus: "OPEN", toStatus: "IN_PROGRESS", reason: null, workflowVersion: 4, createdAt: "2026-10-11T09:00:00.000Z" }],
      pagination: { ...pagination, totalItems: 1, totalPages: 1 },
    });
    render(<TicketWorkflow ticketNumber={ticket.ticketNumber} status={ticket.status} workflowVersion={ticket.workflowVersion} resolutionIndication={ticket.resolutionIndication} />);
    expect(await screen.findByText("Current Ticket status: OPEN")).toBeInTheDocument();
    expect(screen.getByText("Requester indicated the problem appears resolved. Ticket status has not changed.")).toBeInTheDocument();
    expect(screen.getByText("OPEN → IN_PROGRESS")).toBeInTheDocument();
    expect(screen.getByText(/By Michael Brown.*Workflow version 4/)).toBeInTheDocument();
  });

  it("resets history pagination when the displayed Ticket changes", async () => {
    const user = userEvent.setup();
    const nextTicketNumber = "TKT-2026-000059";
    const event = (id: number, ticketNumber: string, reason: string | null): api.TicketWorkflowEvent => ({
      id, ticketNumber,
      actor: { id: 8, name: "Michael Brown", email: "michael@example.test", role: "IT_STAFF" },
      fromStatus: "OPEN", toStatus: "IN_PROGRESS", reason, workflowVersion: id,
      createdAt: "2026-10-11T09:00:00.000Z",
    });
    vi.mocked(api.fetchTicketWorkflowEvents).mockImplementation(async (ticketNumber, requestedPage = 1) => {
      if (ticketNumber === ticket.ticketNumber) {
        if (requestedPage === 1) {
          return {
            events: Array.from({ length: 25 }, (_, index) => event(index + 1, ticketNumber, null)),
            pagination: { ...pagination, totalItems: 26, totalPages: 2, hasNextPage: true },
          };
        }
        return {
          events: [event(26, ticketNumber, "Old Ticket page two")],
          pagination: { ...pagination, page: 2, totalItems: 26, totalPages: 2, hasPreviousPage: true },
        };
      }
      if (requestedPage === 1) {
        return {
          events: [event(100, ticketNumber, "New Ticket first page")],
          pagination: { ...pagination, totalItems: 1, totalPages: 1 },
        };
      }
      return {
        events: [],
        pagination: { ...pagination, page: requestedPage, totalItems: 1, totalPages: 1, hasPreviousPage: true },
      };
    });

    const { rerender } = render(<TicketWorkflow ticketNumber={ticket.ticketNumber} status={ticket.status} workflowVersion={ticket.workflowVersion} resolutionIndication={ticket.resolutionIndication} />);
    expect(await screen.findByText("Page 1 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next history page" }));
    expect(await screen.findByText("Reason: Old Ticket page two")).toBeInTheDocument();

    rerender(<TicketWorkflow ticketNumber={nextTicketNumber} status={ticket.status} workflowVersion={ticket.workflowVersion} resolutionIndication={ticket.resolutionIndication} />);

    expect(await screen.findByText("Reason: New Ticket first page")).toBeInTheDocument();
    await waitFor(() => expect(api.fetchTicketWorkflowEvents).toHaveBeenLastCalledWith(nextTicketNumber, 1));
    expect(screen.queryByText("Page 2 of 2")).not.toBeInTheDocument();
  });

  it("formats workflow event timestamps in the Bangkok timezone", async () => {
    const toLocaleString = vi.spyOn(Date.prototype, "toLocaleString");
    vi.mocked(api.fetchTicketWorkflowEvents).mockResolvedValueOnce({
      events: [{ id: 7, ticketNumber: ticket.ticketNumber, actor: { id: 8, name: "Michael Brown", email: "michael@example.test", role: "IT_STAFF" }, fromStatus: "OPEN", toStatus: "IN_PROGRESS", reason: null, workflowVersion: 4, createdAt: "2026-10-11T09:00:00.000Z" }],
      pagination: { ...pagination, totalItems: 1, totalPages: 1 },
    });
    render(<TicketWorkflow ticketNumber={ticket.ticketNumber} status={ticket.status} workflowVersion={ticket.workflowVersion} resolutionIndication={ticket.resolutionIndication} />);

    expect(await screen.findByText(/By Michael Brown.*Workflow version 4/)).toBeInTheDocument();
    expect(toLocaleString).toHaveBeenCalledWith(undefined, { timeZone: "Asia/Bangkok" });
  });

  it("shows resolution prerequisites and only permits legal Status targets", async () => {
    const user = userEvent.setup();
    render(<StaffTicketDetail ticketNumber={ticket.ticketNumber} navigate={vi.fn()} />);
    await screen.findByRole("heading", { name: "Ticket Operations" });
    const status = screen.getByRole("combobox", { name: "Status" });
    const values = within(status).getAllByRole("option").map((option) => (option as HTMLOptionElement).value);
    expect(values).toEqual(["OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "CANCELLED"]);
    expect(screen.getByText("Complete at least one Action with a valid Result.")).toBeInTheDocument();
    expect(screen.getByText("Finish or cancel all open Actions.")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "RESOLVED" })).not.toBeInTheDocument();

    await user.selectOptions(status, "CANCELLED");
    await user.click(screen.getByRole("button", { name: "Save Status" }));
    const dialog = await screen.findByRole("dialog", { name: "Change status to CANCELLED?" });
    await user.type(within(dialog).getByLabelText(/Cancellation reason/), "Duplicate ticket; no repair is required.");
    await user.click(within(dialog).getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(api.updateStaffTicketStatus).toHaveBeenCalledWith(ticket.ticketNumber, "CANCELLED", 5, true, "Duplicate ticket; no repair is required."));
  });

  it("offers an explicit Ticket reload after a stale workflow write", async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateStaffTicketStatus).mockRejectedValueOnce(new api.ApiClientError("Stale Ticket", 409, "STALE_VERSION"));
    render(<StaffTicketDetail ticketNumber={ticket.ticketNumber} navigate={vi.fn()} />);
    const status = await screen.findByRole("combobox", { name: "Status" });
    await user.selectOptions(status, "IN_PROGRESS");
    await user.click(screen.getByRole("button", { name: "Save Status" }));
    expect(await screen.findByText(/another update changed this Ticket/i)).toBeInTheDocument();
    const loadCalls = vi.mocked(api.fetchStaffTicket).mock.calls.length;
    await user.click(screen.getByRole("button", { name: "Reload current Ticket" }));
    await waitFor(() => expect(api.fetchStaffTicket).toHaveBeenCalledTimes(loadCalls + 1));
  });
});
