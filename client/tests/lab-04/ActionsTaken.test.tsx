import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ActionsTaken from "../../src/ActionsTaken.js";
import * as api from "../../src/api.js";

const ticketNumber = "TKT-2026-000001";
const action = {
  id: 41,
  ticketNumber,
  description: "Replace the failed network cable.",
  result: "Cable replaced and connectivity verified.",
  followUpRequired: true,
  followUpNote: "Check signal strength tomorrow.",
  attachmentNotes: "switch-port-photo.png",
  status: "COMPLETED",
  cancellationReason: null,
  assignee: { id: 8, name: "Michael Brown", email: "michael@example.test", role: "IT_STAFF" },
  createdBy: { id: 9, name: "Priya Shah", email: "priya@example.test", role: "ADMINISTRATOR" },
  performedBy: { id: 8, name: "Michael Brown", email: "michael@example.test", role: "IT_STAFF" },
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T11:00:00.000Z",
  completedAt: "2026-10-01T11:00:00.000Z",
  cancelledAt: null,
  version: 2,
};
const pagination = { page: 1, pageSize: 25, totalItems: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false };
const assignees = [
  { id: 8, name: "Michael Brown", email: "michael@example.test", role: "IT_STAFF" },
  { id: 9, name: "Priya Shah", email: "priya@example.test", role: "ADMINISTRATOR" },
];

describe("Lab 4 Actions Taken UI", () => {
  beforeEach(() => {
    vi.spyOn(api, "fetchActionsTaken").mockResolvedValue({ actions: [action], pagination, ticketVersion: 3 } as never);
    vi.spyOn(api, "fetchStaffAssignees").mockResolvedValue(assignees as never);
    vi.spyOn(api, "fetchActionRevisions").mockResolvedValue({ revisions: [], pagination } as never);
    vi.spyOn(api, "createActionTaken").mockResolvedValue({ action: { ...action, id: 42, status: "OPEN" }, ticketVersion: 4, replayed: false } as never);
    vi.spyOn(api, "updateActionTaken").mockResolvedValue({ action: { ...action, version: 3 }, ticketVersion: 4 } as never);
  });

  afterEach(() => vi.restoreAllMocks());

  it("shows public Action history to Requesters without edit controls or Internal Notes", async () => {
    render(<ActionsTaken ticketNumber={ticketNumber} readOnly />);

    const section = await screen.findByRole("region", { name: "Actions Taken" });
    expect(within(section).getByText(action.description)).toBeInTheDocument();
    expect(within(section).getByText(action.result!)).toBeInTheDocument();
    expect(within(section).getAllByText(/Michael Brown \(michael@example\.test\)/)).toHaveLength(2);
    expect(within(section).getByText(/Priya Shah \(priya@example\.test\)/)).toBeInTheDocument();
    expect(within(section).getByText(action.followUpNote!)).toBeInTheDocument();
    expect(within(section).getByText(action.attachmentNotes!)).toBeInTheDocument();
    expect(within(section).getByText("COMPLETED")).toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: /Create Action|Edit|Start Work|Complete|Cancel Action/ })).not.toBeInTheDocument();
    expect(within(section).queryByText(/Internal Notes|stored path|storage\/|uploads\//i)).not.toBeInTheDocument();
  });

  it("shows an explicit empty Result for an OPEN Action", async () => {
    vi.mocked(api.fetchActionsTaken).mockResolvedValueOnce({ actions: [{ ...action, status: "OPEN", result: null }], pagination, ticketVersion: 3 } as never);
    render(<ActionsTaken ticketNumber={ticketNumber} readOnly />);
    const resultLabel = await screen.findByText("Result", { selector: "dt" });
    expect(resultLabel.nextElementSibling).toHaveTextContent("Not recorded");
  });

  it("retries failed revision loading without closing the panel and preserves show/hide", async () => {
    const user = userEvent.setup();
    vi.mocked(api.fetchActionRevisions)
      .mockRejectedValueOnce(new Error("Network failure"))
      .mockResolvedValueOnce({ revisions: [{ id: 1, revisionNumber: 1, actor: action.createdBy, changedAt: action.createdAt, snapshot: action }], pagination } as never);
    render(<ActionsTaken ticketNumber={ticketNumber} readOnly />);
    await user.click(await screen.findByRole("button", { name: "Show revision history" }));
    await user.click(await screen.findByRole("button", { name: "Retry history" }));
    expect(await screen.findByRole("heading", { name: "Revision 1" })).toBeInTheDocument();
    expect(api.fetchActionRevisions).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Hide revision history" })).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Hide revision history" }));
    expect(screen.queryByRole("heading", { name: "Revision 1" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show revision history" }));
    expect(screen.getByRole("heading", { name: "Revision 1" })).toBeInTheDocument();
    expect(api.fetchActionRevisions).toHaveBeenCalledTimes(2);
  });

  it.each(["Create Action", "Edit Action"])("closes %s when read-only is enabled and does not reopen it later", async (name) => {
    const user = userEvent.setup();
    const { rerender } = render(<ActionsTaken ticketNumber={ticketNumber} currentUserId={8} />);
    await user.click(await screen.findByRole("button", { name }));
    expect(screen.getByRole("form")).toBeInTheDocument();
    rerender(<ActionsTaken ticketNumber={ticketNumber} currentUserId={8} readOnly />);
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    await act(async () => { rerender(<ActionsTaken ticketNumber={ticketNumber} currentUserId={8} />); });
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(api.createActionTaken).not.toHaveBeenCalled();
    expect(api.updateActionTaken).not.toHaveBeenCalled();
  });

  it.each(["Complete Action", "Cancel Action"])("closes the %s confirmation when read-only is enabled", async (name) => {
    const user = userEvent.setup();
    vi.mocked(api.fetchActionsTaken).mockResolvedValueOnce({ actions: [{ ...action, status: "IN_PROGRESS" }], pagination, ticketVersion: 3 } as never);
    const { rerender } = render(<ActionsTaken ticketNumber={ticketNumber} currentUserId={8} />);
    await user.click(await screen.findByRole("button", { name }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    rerender(<ActionsTaken ticketNumber={ticketNumber} currentUserId={8} readOnly />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => { rerender(<ActionsTaken ticketNumber={ticketNumber} currentUserId={8} />); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.updateActionTaken).not.toHaveBeenCalled();
  });

  it("marks required fields clearly and identifies optional fields", async () => {
    const user = userEvent.setup();
    render(<ActionsTaken ticketNumber={ticketNumber} currentUserId={8} />);
    await user.click(await screen.findByRole("button", { name: "Create Action" }));

    const description = screen.getByLabelText("Description");
    const assignee = screen.getByLabelText("Assignee");
    expect(description).toHaveAttribute("aria-required", "true");
    expect(assignee).toHaveAttribute("aria-required", "true");
    expect(document.querySelector('label[for="create-description"]')).toHaveClass("action-required-label");
    expect(document.querySelector('label[for="create-assigneeUserId"]')).toHaveClass("action-required-label");
    expect(screen.getByLabelText("Result (optional)")).toHaveAttribute("aria-required", "false");
    expect(screen.getByLabelText("Attachment Notes (optional)")).toHaveAttribute("aria-required", "false");

    const followUpToggle = screen.getByLabelText("Follow-up required");
    await user.click(followUpToggle);
    expect(screen.getByLabelText("Follow-up Note")).toHaveAttribute("aria-required", "true");
    await user.type(screen.getByLabelText("Follow-up Note"), "Check again tomorrow.");
    await user.click(followUpToggle);
    expect(screen.getByLabelText("Follow-up Note (optional)")).toHaveAttribute("aria-required", "false");
  });

  it("returns keyboard focus to Create Action when its unsaved form is cancelled", async () => {
    const user = userEvent.setup();
    render(<ActionsTaken ticketNumber={ticketNumber} currentUserId={8} />);
    const create = await screen.findByRole("button", { name: "Create Action" });
    await user.click(create);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(create).toHaveFocus());
    expect(api.createActionTaken).not.toHaveBeenCalled();
  });

  it("requires a valid Result when editing a completed Action", async () => {
    const user = userEvent.setup();
    render(<ActionsTaken ticketNumber={ticketNumber} currentUserId={8} />);
    await user.click(await screen.findByRole("button", { name: "Edit Action" }));
    const result = screen.getByLabelText("Result");
    expect(result).toHaveAttribute("aria-required", "true");
    expect(document.querySelector('label[for="edit-41-result"]')).toHaveClass("action-required-label");

    await user.clear(result);
    await user.click(screen.getByRole("button", { name: "Save Action" }));

    expect(await screen.findByText("Enter a result of at least 5 characters to complete this Action.")).toBeInTheDocument();
    expect(api.updateActionTaken).not.toHaveBeenCalled();
  });

  it("creates with validated fields, an eligible assignee and a stable request key", async () => {
    const user = userEvent.setup();
    render(<ActionsTaken ticketNumber={ticketNumber} currentUserId={8} />);
    await screen.findByText(action.description);
    await user.click(screen.getByRole("button", { name: "Create Action" }));
    await user.type(screen.getByLabelText("Description"), "Inspect the access point.");
    await user.selectOptions(screen.getByLabelText("Assignee"), "9");
    await user.type(screen.getByLabelText(/^Result/), "Signal restored successfully.");
    await user.click(screen.getByLabelText("Follow-up required"));
    await user.type(screen.getByLabelText("Follow-up Note"), "Confirm stability tomorrow.");
    await user.type(screen.getByLabelText(/^Attachment Notes/), "wifi-test.png");
    await user.click(screen.getByRole("button", { name: "Save Action" }));

    await waitFor(() => expect(api.createActionTaken).toHaveBeenCalledWith(ticketNumber, expect.objectContaining({
      expectedTicketVersion: 3,
      description: "Inspect the access point.",
      assigneeUserId: 9,
      result: "Signal restored successfully.",
      followUpRequired: true,
      followUpNote: "Confirm stability tomorrow.",
      attachmentNotes: "wifi-test.png",
      clientRequestId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
    })));
    expect(await screen.findByText("Action saved.")).toBeInTheDocument();
  });

  it("retains an edited draft after a stale-version response and offers an explicit reload", async () => {
    vi.mocked(api.updateActionTaken).mockRejectedValueOnce(new api.ApiClientError("A newer version exists.", 409, "STALE_VERSION"));
    const user = userEvent.setup();
    render(<ActionsTaken ticketNumber={ticketNumber} currentUserId={8} />);
    await user.click(await screen.findByRole("button", { name: "Edit Action" }));
    const description = screen.getByLabelText("Description");
    await user.clear(description);
    await user.type(description, "Updated network cable inspection.");
    await user.click(screen.getByRole("button", { name: "Save Action" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/someone else changed this Action/i);
    expect(screen.getByLabelText("Description")).toHaveValue("Updated network cable inspection.");
    expect(screen.getByRole("button", { name: "Reload current Action" })).toBeInTheDocument();
  });

  it("retains the same creation key and payload when retrying an uncertain request", async () => {
    vi.mocked(api.createActionTaken).mockRejectedValueOnce(new api.ApiClientError("Unable to save Action.", 0));
    const user = userEvent.setup();
    render(<ActionsTaken ticketNumber={ticketNumber} currentUserId={8} />);
    await screen.findByText(action.description);
    await user.click(screen.getByRole("button", { name: "Create Action" }));
    await user.type(screen.getByLabelText("Description"), "Inspect the laptop docking station.");
    await user.selectOptions(screen.getByLabelText("Assignee"), "8");
    await user.click(screen.getByRole("button", { name: "Save Action" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/safely check the same request/i);
    const firstPayload = vi.mocked(api.createActionTaken).mock.calls[0][1];

    await user.click(screen.getByRole("button", { name: "Retry Save" }));
    await waitFor(() => expect(api.createActionTaken).toHaveBeenCalledTimes(2));
    expect(api.createActionTaken).toHaveBeenLastCalledWith(ticketNumber, firstPayload);
  });

  it("retries a safe list failure and exposes page-size controls", async () => {
    vi.mocked(api.fetchActionsTaken).mockRejectedValueOnce(new api.ApiClientError("Unable to load Actions Taken.", 0));
    const user = userEvent.setup();
    render(<ActionsTaken ticketNumber={ticketNumber} readOnly />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to reach the server");
    await user.click(screen.getByRole("button", { name: "Retry Actions" }));
    expect(await screen.findByText(action.description)).toBeInTheDocument();
    expect(screen.getByLabelText("Actions per page")).toHaveValue("25");
  });

  it("starts work without changing the Ticket Owner", async () => {
    vi.mocked(api.fetchActionsTaken).mockResolvedValue({ actions: [{ ...action, status: "OPEN", performedBy: null, completedAt: null }], pagination, ticketVersion: 3 } as never);
    const user = userEvent.setup();
    render(<ActionsTaken ticketNumber={ticketNumber} currentUserId={8} />);
    await user.click(await screen.findByRole("button", { name: "Start Work" }));
    await waitFor(() => expect(api.updateActionTaken).toHaveBeenCalledWith(ticketNumber, action.id, {
      expectedTicketVersion: 3,
      expectedActionVersion: 2,
      status: "IN_PROGRESS",
    }));
  });

  it("requires confirmation to complete an Action and sends its Result", async () => {
    vi.mocked(api.fetchActionsTaken).mockResolvedValue({ actions: [{ ...action, status: "IN_PROGRESS" }], pagination, ticketVersion: 3 } as never);
    const user = userEvent.setup();
    render(<ActionsTaken ticketNumber={ticketNumber} currentUserId={8} />);
    await user.click(await screen.findByRole("button", { name: "Complete Action" }));
    expect(await screen.findByRole("dialog", { name: "Complete Action?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm completion" }));
    await waitFor(() => expect(api.updateActionTaken).toHaveBeenCalledWith(ticketNumber, action.id, {
      expectedTicketVersion: 3,
      expectedActionVersion: 2,
      status: "COMPLETED",
      result: action.result,
    }));
  });

  it("requires a reason and confirmation before cancelling an Action", async () => {
    vi.mocked(api.fetchActionsTaken).mockResolvedValue({ actions: [{ ...action, status: "IN_PROGRESS" }], pagination, ticketVersion: 3 } as never);
    const user = userEvent.setup();
    render(<ActionsTaken ticketNumber={ticketNumber} currentUserId={8} />);
    await user.click(await screen.findByRole("button", { name: "Cancel Action" }));
    const reason = screen.getByLabelText("Cancellation reason");
    expect(reason).toHaveAttribute("aria-required", "true");
    await user.type(reason, "No");
    await user.click(screen.getByRole("button", { name: "Confirm cancellation" }));
    expect(await screen.findByText("Enter a cancellation reason between 5 and 250 characters.")).toBeInTheDocument();
    await user.type(reason, " longer needed.");
    await user.click(screen.getByRole("button", { name: "Confirm cancellation" }));
    await waitFor(() => expect(api.updateActionTaken).toHaveBeenCalledWith(ticketNumber, action.id, {
      expectedTicketVersion: 3,
      expectedActionVersion: 2,
      status: "CANCELLED",
      cancellationReason: "No longer needed.",
    }));
  });

  it("focuses and reports strict field validation before sending", async () => {
    const user = userEvent.setup();
    render(<ActionsTaken ticketNumber={ticketNumber} currentUserId={8} />);
    await user.click(await screen.findByRole("button", { name: "Create Action" }));
    await user.click(screen.getByRole("button", { name: "Save Action" }));
    expect(await screen.findByText("Enter a description between 5 and 2,000 characters.")).toBeInTheDocument();
    expect(screen.getByText("Fix the errors shown under the fields, then choose Save Action again.")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toHaveAttribute("aria-invalid", "true");
    expect(api.createActionTaken).not.toHaveBeenCalled();
  });
});
