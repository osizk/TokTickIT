import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const staff: api.AuthUser = {
  id: 8,
  name: "Michael Brown",
  email: "michael.staff@example.test",
  role: "IT_STAFF",
  isActive: true,
  mustChangePassword: false,
};
const categories: api.Category[] = [
  { id: 10, name: "Hardware" },
  { id: 11, name: "Software" },
];
const systems: api.RelatedSystem[] = [
  { id: 20, name: "Campus Wi-Fi" },
  { id: 21, name: "Employee Portal" },
];
const assignees: api.StaffAssignee[] = [
  { id: 8, name: "Michael Brown", email: staff.email, role: "IT_STAFF" },
  { id: 9, name: "Priya Shah", email: "priya.staff@example.test", role: "IT_STAFF" },
];
const queueResponse: api.StaffTicketResponse = {
  items: [
    {
      id: 1,
      ticketNumber: "TKT-2026-000001",
      requester: { id: 1, name: "Amina Rahman", email: "amina@example.test" },
      category: categories[0],
      relatedSystem: systems[0],
      requestedPriority: "HIGH",
      itPriority: "URGENT",
      status: "IN_PROGRESS",
      summary: "Campus Wi-Fi disconnects",
      description: "The connection drops repeatedly during class.",
      ticketOwner: assignees[0],
      resolutionIndication: null,
      createdAt: "2026-08-27T08:30:00.000Z",
      updatedAt: "2026-08-27T09:30:00.000Z",
    },
    {
      id: 2,
      ticketNumber: "TKT-2026-000002",
      requester: { id: 2, name: "Ben Carter", email: "ben@example.test" },
      category: categories[1],
      relatedSystem: systems[1],
      requestedPriority: "LOW",
      itPriority: "MEDIUM",
      status: "NEW",
      summary: "Portal access request",
      description: "The employee portal denies access.",
      ticketOwner: null,
      resolutionIndication: null,
      createdAt: "2026-08-26T08:30:00.000Z",
      updatedAt: "2026-08-26T09:30:00.000Z",
    },
  ],
  pagination: { page: 1, pageSize: 10, totalItems: 2, totalPages: 1, hasPreviousPage: false, hasNextPage: false },
};

async function openQueue(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.type(await screen.findByLabelText("Email"), staff.email);
  await user.type(screen.getByLabelText("Password"), "Initial-Lab3!Password");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("heading", { name: "Ticket Queue" })).toBeInTheDocument();
}

describe("Lab 3 Staff Ticket Queue", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/login");
    vi.spyOn(api, "currentUser").mockRejectedValue(new api.ApiClientError("Authentication is required.", 401));
    vi.spyOn(api, "login").mockResolvedValue({ user: staff, csrfToken: "csrf-staff" });
    vi.spyOn(api, "fetchCategories").mockResolvedValue(categories);
    vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue(systems);
    vi.spyOn(api, "fetchStaffAssignees").mockResolvedValue(assignees);
    vi.spyOn(api, "fetchStaffTickets").mockResolvedValue(queueResponse);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/login");
  });

  it("renders queue controls, priorities, ownership, table, and mobile cards", async () => {
    const user = userEvent.setup();
    await openQueue(user);

    expect(await screen.findByRole("table", { name: "Staff Ticket Queue" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search Tickets" })).toBeInTheDocument();
    for (const label of ["Category", "Related System", "Requested Priority", "IT Priority", "Status", "Assignee", "Sort by", "Order", "Page size"]) {
      expect(screen.getByRole("combobox", { name: label })).toBeInTheDocument();
    }
    expect(screen.getAllByText("Campus Wi-Fi disconnects")).toHaveLength(2);
    expect(screen.getAllByText("URGENT").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Unassigned").length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "Mobile staff ticket cards" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ticket Queue" })).toHaveAttribute("href", "/staff/tickets");
  });

  it("keeps queue filters in the URL and passes all selected parameters to the API", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.mocked(api.fetchStaffTickets);
    await openQueue(user);

    await user.type(screen.getByRole("searchbox", { name: "Search Tickets" }), "Amina");
    await user.click(screen.getByRole("button", { name: "Apply Filters" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Category" }), "10");
    await user.selectOptions(screen.getByRole("combobox", { name: "Requested Priority" }), "HIGH");
    await user.selectOptions(screen.getByRole("combobox", { name: "IT Priority" }), "URGENT");
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "IN_PROGRESS");
    await user.selectOptions(screen.getByRole("combobox", { name: "Assignee" }), "unassigned");
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort by" }), "itPriority");
    await user.selectOptions(screen.getByRole("combobox", { name: "Order" }), "asc");
    await user.selectOptions(screen.getByRole("combobox", { name: "Page size" }), "25");

    await waitFor(() => expect(window.location.search).toContain("search=Amina"));
    expect(window.location.search).toContain("requestedPriority=HIGH");
    expect(window.location.search).toContain("itPriority=URGENT");
    expect(window.location.search).toContain("status=IN_PROGRESS");
    expect(window.location.search).toContain("owner=unassigned");
    expect(window.location.search).toContain("sort=itPriority");
    expect(window.location.search).toContain("order=asc");
    expect(window.location.search).toContain("pageSize=25");
    expect(fetchSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      search: "Amina", categoryId: 10, requestedPriority: "HIGH", itPriority: "URGENT", status: "IN_PROGRESS", owner: "unassigned", sort: "itPriority", order: "asc", page: 1, pageSize: 25,
    }));
  });

  it("distinguishes an empty queue from filtered no-results and can clear filters", async () => {
    vi.mocked(api.fetchStaffTickets)
      .mockResolvedValueOnce({ ...queueResponse, items: [], pagination: { ...queueResponse.pagination, totalItems: 0, totalPages: 0 } })
      .mockResolvedValueOnce({ ...queueResponse, items: [], pagination: { ...queueResponse.pagination, totalItems: 0, totalPages: 0 } })
      .mockResolvedValue(queueResponse);
    const user = userEvent.setup();
    await openQueue(user);
    expect(await screen.findByText("There are no Tickets in the staff queue yet.")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search Tickets" }), "missing");
    await user.click(screen.getByRole("button", { name: "Apply Filters" }));
    expect(await screen.findByText("No Tickets match your filters.")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Clear Filters" })[0]);
    expect((await screen.findAllByText("Campus Wi-Fi disconnects")).length).toBeGreaterThan(0);
  });

  it("shows a safe retryable failure and a distinct forbidden state", async () => {
    vi.mocked(api.fetchStaffTickets).mockRejectedValueOnce(new Error("database details must not escape")).mockResolvedValue(queueResponse);
    const user = userEvent.setup();
    await openQueue(user);
    expect(await screen.findByRole("alert", { name: "Ticket queue loading error" })).toHaveTextContent("Unable to load Ticket Queue.");
    expect(screen.queryByText("database details must not escape")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("table", { name: "Staff Ticket Queue" })).toBeInTheDocument();

    vi.mocked(api.fetchStaffTickets).mockRejectedValueOnce(new api.ApiClientError("Forbidden", 403, "FORBIDDEN"));
    await user.click(screen.getAllByRole("button", { name: "Clear Filters" })[0]);
    expect(await screen.findByRole("alert", { name: "Ticket queue loading error" })).toHaveTextContent("You do not have permission");
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
});
