import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const authUser: api.AuthUser = {
  id: 101,
  name: "Amina Rahman",
  email: "amina@example.test",
  role: "REQUESTER",
  isActive: true,
  mustChangePassword: false,
  legacyRequesterId: 1,
};

function setPath(path: string) {
  window.history.replaceState({}, "", path);
}

describe("Lab 3 authenticated Requester context", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setPath("/login");
    vi.spyOn(api, "currentUser").mockRejectedValue(new api.ApiClientError("Authentication is required.", 401));
    vi.spyOn(api, "login").mockResolvedValue({ user: authUser, csrfToken: "csrf-test-token" });
    vi.spyOn(api, "fetchTickets").mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false },
    });
    vi.spyOn(api, "fetchCategories").mockResolvedValue([]);
    vi.spyOn(api, "fetchRelatedSystems").mockResolvedValue([]);
  });

  afterEach(() => vi.restoreAllMocks());

  it("guards a protected route with Sign in and does not render the removed selector", async () => {
    setPath("/tickets");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Select Development Requester" })).not.toBeInTheDocument();
  });

  it("uses the authenticated shell identity and clears legacy storage", async () => {
    const user = userEvent.setup();
    sessionStorage.setItem("toktickit.requesterId", "999");
    render(<App />);

    await user.type(await screen.findByLabelText("Email"), authUser.email);
    await user.type(screen.getByLabelText("Password"), "Initial-Lab3!Password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("link", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.getByText("Amina Rahman")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change Requester" })).not.toBeInTheDocument();
    expect(sessionStorage.length).toBe(0);
  });
});
