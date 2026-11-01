import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import App from "../../src/App.js";
import { StaffDashboard } from "../../src/Dashboards.js";

const statuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
const dashboard = {
  generatedAt: "2026-10-12T12:00:00.000Z",
  timezone: "Asia/Bangkok" as const,
  recentWindow: { from: "2026-10-05T12:00:00.000Z", through: "2026-10-12T12:00:00.000Z" },
  metrics: { unassignedActiveTicketCount: 6, myOwnedActiveTicketCount: 5, urgentActiveTicketCount: 2, ticketsWithMyActiveActionsCount: 3 },
  statusCounts: Object.fromEntries(statuses.map((status, index) => [status, index + 1])) as Record<(typeof statuses)[number], number>,
  itPriorityCounts: { LOW: 7, MEDIUM: 6, HIGH: 5, URGENT: 2 },
  myActions: [{ id: 42, ticketNumber: "TKT-2026-000042", ticketSummary: "Laptop battery issue", description: "Replace swollen battery", status: "IN_PROGRESS" as const, updatedAt: "2026-10-12T11:00:00.000Z" }],
  recentTickets: [{ id: 42, ticketNumber: "TKT-2026-000042", summary: "Laptop battery issue", status: "IN_PROGRESS" as const, requestedPriority: "HIGH" as const, itPriority: "URGENT" as const, updatedAt: "2026-10-12T11:00:00.000Z", requester: { id: 7, name: "Amina Rahman", email: "amina@example.test" }, ticketOwner: { id: 8, name: "Michael Brown", email: "michael@example.test", role: "IT_STAFF" as const } }],
  urgentTickets: [{ id: 43, ticketNumber: "TKT-2026-000043", summary: "Core switch offline", status: "OPEN" as const, requestedPriority: "HIGH" as const, itPriority: "URGENT" as const, updatedAt: "2026-10-11T11:00:00.000Z", requester: { id: 9, name: "Ben Carter", email: "ben@example.test" }, ticketOwner: null }],
};

describe("Lab 4 Staff dashboard", () => {
  const navigate = vi.fn();

  beforeEach(() => {
    navigate.mockReset();
    vi.spyOn(api, "fetchStaffDashboard").mockResolvedValue(dashboard);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/login");
  });

  it("announces the Staff dashboard loading state and disables refresh until data arrives", async () => {
    let resolveDashboard!: (value: typeof dashboard) => void;
    vi.mocked(api.fetchStaffDashboard).mockReturnValueOnce(new Promise((resolve) => { resolveDashboard = resolve; }));
    render(<StaffDashboard navigate={navigate} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading Staff Dashboard");
    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
    resolveDashboard(dashboard);
    expect(await screen.findByText("Replace swollen battery")).toBeInTheDocument();
  });

  it.each([
    { role: "IT_STAFF" as const, name: "Michael Brown", email: "michael.staff@example.test" },
    { role: "ADMINISTRATOR" as const, name: "Amina Admin", email: "amina.admin@example.test" },
  ])("lands an authenticated $role user on the Staff dashboard", async ({ role, name, email }) => {
    window.history.replaceState({}, "", "/login");
    vi.spyOn(api, "currentUser").mockRejectedValue(new api.ApiClientError("Authentication is required.", 401));
    vi.spyOn(api, "login").mockResolvedValue({
      user: { id: 8, name, email, role, isActive: true, mustChangePassword: false },
      csrfToken: "csrf-staff",
    });
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("Email"), "michael.staff@example.test");
    await user.type(screen.getByLabelText("Password"), "Initial-Lab3!Password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Staff Dashboard" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/staff/dashboard");
    expect(screen.getByRole("link", { name: "Ticket Queue" })).toBeInTheDocument();
    if (role === "ADMINISTRATOR") expect(screen.getByRole("link", { name: "User Management" })).toBeInTheDocument();
    else expect(screen.queryByRole("link", { name: "User Management" })).not.toBeInTheDocument();
    await waitFor(() => expect(api.fetchStaffDashboard).toHaveBeenCalled());
  });

  it("shows linked operational metrics, summaries and real dashboard sections", async () => {
    render(<StaffDashboard navigate={navigate} />);

    expect(await screen.findByRole("heading", { name: "Staff Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Unassigned active Tickets.*6/ })).toHaveAttribute("href", "/staff/tickets?statusGroup=active&owner=unassigned");
    expect(screen.getByRole("link", { name: /My owned active Tickets.*5/ })).toHaveAttribute("href", "/staff/tickets?statusGroup=active&owner=me");
    expect(screen.getByRole("link", { name: /Urgent active Tickets.*2/ })).toHaveAttribute("href", "/staff/tickets?statusGroup=active&itPriority=URGENT");
    expect(screen.getByRole("link", { name: /Tickets with my active Actions.*3/ })).toHaveAttribute("href", "/staff/tickets?statusGroup=active&actionAssignee=me");
    for (const status of statuses) {
      const href = `/staff/tickets?status=${status}`;
      expect(screen.getAllByRole("link").some((link) => link.getAttribute("href") === href && link.textContent?.includes(String(statuses.indexOf(status) + 1)))).toBe(true);
    }
    expect(screen.getAllByRole("link", { name: /URGENT.*2/ }).some((link) => link.getAttribute("href") === "/staff/tickets?statusGroup=active&itPriority=URGENT")).toBe(true);
    expect(screen.getByRole("heading", { name: "Actions assigned to you" })).toBeInTheDocument();
    expect(screen.getByText("Replace swollen battery")).toBeInTheDocument();
    expect(screen.getByText("Michael Brown")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("links current-user Actions to the matching detail heading and recent lists to the seven-day predicate", async () => {
    const user = userEvent.setup();
    render(<StaffDashboard navigate={navigate} />);

    const actionLink = await screen.findByRole("link", { name: /Replace swollen battery.*TKT-2026-000042/ });
    expect(actionLink).toHaveAttribute("href", "/staff/tickets/TKT-2026-000042#action-heading-42");
    await user.click(actionLink);
    expect(navigate).toHaveBeenCalledWith("/staff/tickets/TKT-2026-000042#action-heading-42");

    const recentListLink = screen.getByRole("link", { name: "View recent Tickets" });
    const recentUrl = new URL(recentListLink.getAttribute("href")!, window.location.origin);
    expect(recentUrl.pathname).toBe("/staff/tickets");
    expect(recentUrl.searchParams.get("updatedSince")).toBe(dashboard.recentWindow.from);
    expect(recentUrl.searchParams.get("updatedBefore")).toBe(dashboard.recentWindow.through);
  });

  it("shows empty sections, safe retryable failures, and a distinct forbidden state", async () => {
    vi.mocked(api.fetchStaffDashboard)
      .mockResolvedValueOnce({ ...dashboard, metrics: { unassignedActiveTicketCount: 0, myOwnedActiveTicketCount: 0, urgentActiveTicketCount: 0, ticketsWithMyActiveActionsCount: 0 }, statusCounts: Object.fromEntries(statuses.map((status) => [status, 0])) as Record<(typeof statuses)[number], number>, itPriorityCounts: { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 }, myActions: [], recentTickets: [], urgentTickets: [] })
      .mockRejectedValueOnce(new Error("secret SQL details"))
      .mockResolvedValueOnce(dashboard);
    const user = userEvent.setup();
    render(<StaffDashboard navigate={navigate} />);

    expect(await screen.findByText("There is no active Staff work right now.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh dashboard" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load the Staff dashboard.");
    expect(screen.queryByText("secret SQL details")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Replace swollen battery")).toBeInTheDocument();

    vi.mocked(api.fetchStaffDashboard).mockRejectedValueOnce(new api.ApiClientError("Forbidden", 403, "FORBIDDEN"));
    await user.click(screen.getByRole("button", { name: "Refresh dashboard" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission to view this dashboard.");
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
});
