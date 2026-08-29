import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const activeRequesters: api.Requester[] = [
  { id: 1, name: "Amina Rahman", email: "amina@example.test" },
];
const categories: api.Category[] = [
  { id: 10, name: "Hardware" },
  { id: 11, name: "Software" },
];
const relatedSystems: api.RelatedSystem[] = [
  { id: 20, name: "Identity Service" },
  { id: 21, name: "Network" },
];

const tickets: api.TicketListItem[] = [
  {
    id: 1,
    ticketNumber: "TKT-2026-000001",
    summary: "VPN access fails",
    category: categories[0],
    relatedSystem: relatedSystems[0],
    requestedPriority: "HIGH",
    status: "NEW",
    createdAt: "2026-08-27T08:30:00.000Z",
    updatedAt: "2026-08-27T09:30:00.000Z",
  },
];

const listResponse: api.TicketListResponse = {
  items: tickets,
  pagination: {
    page: 1,
    pageSize: 10,
    totalItems: 1,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  },
};

async function openMyTickets(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.selectOptions(
    await screen.findByRole("combobox", { name: "Development Requester" }),
    "1",
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
}

describe("My Tickets", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/select-requester");
    vi.spyOn(api, "fetchRequesters").mockResolvedValue(activeRequesters);
    vi.spyOn(api, "fetchCategories").mockResolvedValue(categories);
    vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue(relatedSystems);
    vi.spyOn(api, "fetchTickets").mockResolvedValue(listResponse);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads owned Tickets with controls and a desktop table plus mobile cards", async () => {
    const user = userEvent.setup();
    await openMyTickets(user);

    expect(await screen.findByRole("table", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.getAllByText("VPN access fails")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Create Ticket" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search Tickets" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Category" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Related System" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Requested Priority" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveValue("updatedAt");
    expect(screen.getByRole("combobox", { name: "Order" })).toHaveValue("desc");
    expect(screen.getByRole("combobox", { name: "Page size" })).toHaveValue("10");
    expect(screen.getByRole("region", { name: "Mobile ticket cards" })).toBeInTheDocument();
  });

  it("writes search/filter controls to the URL and requests the selected page", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.mocked(api.fetchTickets);
    await openMyTickets(user);

    await user.type(screen.getByRole("searchbox", { name: "Search Tickets" }), "VPN");
    await user.click(screen.getByRole("button", { name: "Apply Filters" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Category" }), "10");
    await user.selectOptions(screen.getByRole("combobox", { name: "Page size" }), "25");

    await waitFor(() => expect(window.location.search).toContain("search=VPN"));
    expect(window.location.search).toContain("categoryId=10");
    expect(window.location.search).toContain("pageSize=25");
    expect(fetchSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ search: "VPN", categoryId: 10, pageSize: 25, page: 1 }),
    );
  });

  it("distinguishes no owned Tickets from filtered no-results and can clear filters", async () => {
    vi.mocked(api.fetchTickets)
      .mockResolvedValueOnce({ ...listResponse, items: [], pagination: { ...listResponse.pagination, totalItems: 0, totalPages: 0 } })
      .mockResolvedValueOnce({ ...listResponse, items: [], pagination: { ...listResponse.pagination, totalItems: 0, totalPages: 0 } })
      .mockResolvedValue(listResponse);
    const user = userEvent.setup();
    await openMyTickets(user);

    expect(await screen.findByText("You have no Tickets yet.")).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Search Tickets" }), "missing");
    await user.click(screen.getByRole("button", { name: "Apply Filters" }));
    expect(await screen.findByText("No Tickets match your filters.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear Filters" }));
    expect((await screen.findAllByText("VPN access fails")).length).toBeGreaterThan(0);
  });

  it("shows loading and safe retry states", async () => {
    let resolveTickets!: (value: api.TicketListResponse) => void;
    vi.mocked(api.fetchTickets).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveTickets = resolve;
      }),
    ).mockRejectedValueOnce(new Error("database details must not escape")).mockResolvedValue(listResponse);
    const user = userEvent.setup();
    await openMyTickets(user);

    expect(screen.getByRole("status")).toHaveTextContent("Loading My Tickets");
    resolveTickets(listResponse);
    expect((await screen.findAllByText("VPN access fails")).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Apply Filters" }));
    expect(await screen.findByRole("alert", { name: "My Tickets loading error" })).toHaveTextContent(
      "Unable to load My Tickets.",
    );
    expect(screen.queryByText("database details must not escape")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect((await screen.findAllByText("VPN access fails")).length).toBeGreaterThan(0);
  });
});
