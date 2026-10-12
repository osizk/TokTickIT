import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../../src/api.js";
import { RequesterDashboard } from "../../src/Dashboards.js";

const dashboard = {
  generatedAt: "2026-10-12T12:00:00.000Z",
  timezone: "Asia/Bangkok" as const,
  recentWindow: { from: "2026-10-05T12:00:00.000Z", through: "2026-10-12T12:00:00.000Z" },
  metrics: { activeTicketCount: 3, waitingForRequesterCount: 1, resolvedCount: 2, closedCount: 4 },
  recentTickets: [{ id: 1, ticketNumber: "TKT-2026-000001", summary: "Recent Wi-Fi issue", status: "OPEN" as const, requestedPriority: "HIGH" as const, itPriority: "MEDIUM" as const, updatedAt: "2026-10-12T11:00:00.000Z" }],
  attentionTickets: [{ id: 2, ticketNumber: "TKT-2026-000002", summary: "Please confirm access", status: "WAITING_FOR_REQUESTER" as const, requestedPriority: "LOW" as const, itPriority: "LOW" as const, updatedAt: "2026-10-11T11:00:00.000Z" }],
};

describe("Lab 4 Requester dashboard", () => {
  const navigate = vi.fn();

  beforeEach(() => {
    navigate.mockReset();
    vi.spyOn(api, "fetchRequesterDashboard").mockResolvedValue(dashboard);
  });

  afterEach(() => vi.restoreAllMocks());

  it("announces loading, renders owned metrics, and links each metric/list to its real destination", async () => {
    const user = userEvent.setup();
    let resolveDashboard!: (value: typeof dashboard) => void;
    vi.mocked(api.fetchRequesterDashboard).mockReturnValueOnce(new Promise((resolve) => { resolveDashboard = resolve; }));
    render(<RequesterDashboard navigate={navigate} />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading Requester Dashboard");
    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
    resolveDashboard(dashboard);
    expect(await screen.findByText("Please confirm access")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Active Tickets.*3/ })).toHaveAttribute("href", "/tickets?statusGroup=active");
    expect(screen.getByRole("link", { name: /Waiting for you.*1/ })).toHaveAttribute("href", "/tickets?status=WAITING_FOR_REQUESTER");
    expect(screen.getByRole("link", { name: /Resolved.*2/ })).toHaveAttribute("href", "/tickets?status=RESOLVED");
    expect(screen.getByRole("link", { name: /Closed.*4/ })).toHaveAttribute("href", "/tickets?status=CLOSED");
    expect(screen.getByText("Please confirm access")).toBeInTheDocument();
    expect(screen.getByText("Recent Wi-Fi issue")).toBeInTheDocument();

    const recentListLink = screen.getByRole("link", { name: "View recent Tickets" });
    const recentUrl = new URL(recentListLink.getAttribute("href")!, window.location.origin);
    expect(recentUrl.pathname).toBe("/tickets");
    expect(recentUrl.searchParams.get("updatedSince")).toBe(dashboard.recentWindow.from);
    expect(recentUrl.searchParams.get("updatedBefore")).toBe(dashboard.recentWindow.through);
    const recentLink = screen.getByRole("link", { name: /TKT-2026-000001.*Recent Wi-Fi issue/ });
    await user.click(recentLink);
    expect(navigate).toHaveBeenCalledWith("/tickets/TKT-2026-000001");
  });

  it("shows a real empty state for zero Tickets and supports refresh", async () => {
    vi.mocked(api.fetchRequesterDashboard)
      .mockResolvedValueOnce({
        ...dashboard,
        metrics: { activeTicketCount: 0, waitingForRequesterCount: 0, resolvedCount: 0, closedCount: 0 },
        recentTickets: [],
        attentionTickets: [],
      });
    let resolveRefresh!: (value: typeof dashboard) => void;
    vi.mocked(api.fetchRequesterDashboard).mockReturnValueOnce(new Promise((resolve) => { resolveRefresh = resolve; }));
    const user = userEvent.setup();
    render(<RequesterDashboard navigate={navigate} />);

    expect(await screen.findByText("You have no Tickets yet.")).toBeInTheDocument();
    expect(screen.getByText("No recent Ticket activity in the last 7 days.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh dashboard" }));
    await waitFor(() => expect(api.fetchRequesterDashboard).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Refreshing dashboard; showing the last successful response.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refreshing..." })).toBeDisabled();
    resolveRefresh(dashboard);
    expect(await screen.findByText("Recent Wi-Fi issue")).toBeInTheDocument();
  });

  it("hides untrusted error details and retries a failed dashboard request", async () => {
    vi.mocked(api.fetchRequesterDashboard)
      .mockRejectedValueOnce(new Error("private database connection detail"))
      .mockResolvedValueOnce(dashboard);
    const user = userEvent.setup();
    render(<RequesterDashboard navigate={navigate} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load your dashboard.");
    expect(screen.queryByText("private database connection detail")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Recent Wi-Fi issue")).toBeInTheDocument();
  });
});
