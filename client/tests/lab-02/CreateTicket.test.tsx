import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const createdTicket: api.CreatedTicket = {
  id: 100,
  ticketNumber: "TKT-2026-000001",
  requester: activeRequesters[0],
  category: categories[0],
  relatedSystem: relatedSystems[0],
  requestedPriority: "HIGH",
  status: "NEW",
  summary: "VPN access fails",
  description: "The VPN connection fails after entering valid credentials.",
  createdAt: "2026-08-27T08:30:00.000Z",
  updatedAt: "2026-08-27T08:30:00.000Z",
  attachments: [],
};

async function openCreateTicket(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);

  await user.selectOptions(
    await screen.findByRole("combobox", { name: "Development Requester" }),
    "1",
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(await screen.findByRole("link", { name: "Create Ticket" }));
  expect(await screen.findByRole("heading", { name: "Create Ticket" })).toBeInTheDocument();
}

async function fillValidTicket(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByRole("combobox", { name: /Category/ }), "10");
  await user.selectOptions(screen.getByRole("combobox", { name: /Related System/ }), "20");
  await user.selectOptions(screen.getByRole("combobox", { name: /Requested Priority/ }), "HIGH");
  await user.type(screen.getByLabelText(/Summary/), "  VPN access fails  ");
  await user.type(
    screen.getByLabelText(/Description/),
    "  The VPN connection fails after entering valid credentials.  ",
  );
}

describe("Create Ticket", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/select-requester");
    vi.spyOn(api, "fetchRequesters").mockResolvedValue(activeRequesters);
    vi.spyOn(api, "fetchCategories").mockResolvedValue(categories);
    vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue(relatedSystems);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the approved Create Ticket form inside the selected requester shell", async () => {
    const user = userEvent.setup();
    await openCreateTicket(user);

    expect(screen.getByLabelText(/Summary/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Category/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Related System/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Requested Priority/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit Ticket/ })).toBeInTheDocument();
  });

  it("keeps submission disabled while Ticket reference data is loading", async () => {
    vi.mocked(api.fetchCategories).mockReturnValue(new Promise<api.Category[]>(() => undefined));
    const user = userEvent.setup();
    await openCreateTicket(user);

    expect(await screen.findByText("Loading Categories and Related Systems...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit Ticket" })).toBeDisabled();
  });

  it("shows a safe reference-data failure and retries successfully", async () => {
    const categorySpy = vi.mocked(api.fetchCategories);
    categorySpy.mockRejectedValueOnce(new Error("database unavailable")).mockResolvedValue(categories);
    const user = userEvent.setup();
    await openCreateTicket(user);

    expect(await screen.findByRole("alert", { name: "Reference data loading error" })).toHaveTextContent(
      "Unable to load Ticket reference data.",
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(categorySpy).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Submit Ticket" })).not.toBeDisabled();
  });

  it("shows strict validation errors and focuses the first invalid field before submission", async () => {
    const user = userEvent.setup();
    await openCreateTicket(user);
    const createSpy = vi.spyOn(api, "createTicket");

    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));

    expect(await screen.findByText("Summary must be 5–120 characters after trimming.")).toBeInTheDocument();
    expect(screen.getByText("Description must be 10–5000 characters after trimming.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Category/ })).toHaveFocus();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("trims fields and shows the backend-created Ticket result after a successful submit", async () => {
    const user = userEvent.setup();
    await openCreateTicket(user);
    const createSpy = vi.spyOn(api, "createTicket").mockResolvedValue({
      ticket: createdTicket,
      attachments: [],
    });

    await fillValidTicket(user);
    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(createSpy).toHaveBeenCalledWith(1, {
      categoryId: 10,
      relatedSystemId: 20,
      requestedPriority: "HIGH",
      summary: "VPN access fails",
      description: "The VPN connection fails after entering valid credentials.",
      attachments: [],
    });
    expect(await screen.findByText("TKT-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("Current Status: NEW")).toBeInTheDocument();
  });

  it("preserves entered values and shows a safe message when creation fails", async () => {
    const user = userEvent.setup();
    await openCreateTicket(user);
    vi.spyOn(api, "createTicket").mockRejectedValue(
      new api.ApiClientError("Unable to create Ticket.", 500),
    );

    await fillValidTicket(user);
    await user.click(screen.getByRole("button", { name: "Submit Ticket" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to create Ticket.");
    expect(screen.getByLabelText(/Summary/)).toHaveValue("  VPN access fails  ");
    expect(screen.getByLabelText(/Description/)).toHaveValue(
      "  The VPN connection fails after entering valid credentials.  ",
    );
  });

  it("guards against duplicate submissions while the create request is pending", async () => {
    const user = userEvent.setup();
    await openCreateTicket(user);
    let resolveRequest!: (value: { ticket: api.CreatedTicket; attachments: api.TicketAttachment[] }) => void;
    const request = new Promise<{ ticket: api.CreatedTicket; attachments: api.TicketAttachment[] }>((resolve) => {
      resolveRequest = resolve;
    });
    const createSpy = vi.spyOn(api, "createTicket").mockReturnValue(request);

    await fillValidTicket(user);
    const submitButton = screen.getByRole("button", { name: "Submit Ticket" });
    await user.click(submitButton);
    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Submitting Ticket..." })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Submitting Ticket..." }));
    expect(createSpy).toHaveBeenCalledTimes(1);

    resolveRequest({ ticket: createdTicket, attachments: [] });
    expect(await screen.findByText("TKT-2026-000001")).toBeInTheDocument();
  });

  it("rejects unsupported attachment metadata before calling the API", async () => {
    const user = userEvent.setup();
    await openCreateTicket(user);
    const createSpy = vi.spyOn(api, "createTicket");
    const file = new File(["not an allowed attachment"], "notes.txt", { type: "text/plain" });

    fireEvent.change(screen.getByLabelText("Attachments"), { target: { files: [file] } });

    expect(await screen.findByText(/supported extension and matching MIME type/)).toBeInTheDocument();
    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();
    expect(createSpy).not.toHaveBeenCalled();
  });
});
