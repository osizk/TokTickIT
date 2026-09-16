import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

function setPath(path: string) {
  window.history.replaceState({}, "", path);
}

describe("Lab 3 authenticated Requester UI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    sessionStorage.clear();
    window.history.replaceState({}, "", "/login");
  });

  it("shows Login instead of the Lab 2 requester selector", () => {
    setPath("/login");
    sessionStorage.clear();

    render(<App />);

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Select Development Requester" })).not.toBeInTheDocument();
  });

  it("redirects the removed selector route to Login", async () => {
    setPath("/select-requester");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });

  it("signs in and reaches the Requester shell without sessionStorage or requester-header context", async () => {
    setPath("/login");
    sessionStorage.clear();
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me")) {
        return Promise.resolve(new Response(JSON.stringify({ error: { code: "SESSION_REQUIRED", message: "Authentication is required." } }), { status: 401, headers: { "Content-Type": "application/json" } }));
      }
      if (url.endsWith("/api/auth/login") && init?.method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({
          user: { id: 101, name: "Amina Rahman", email: "amina@example.test", role: "REQUESTER", isActive: true, mustChangePassword: false },
          csrfToken: "csrf-test-token",
        }), { status: 200, headers: { "Content-Type": "application/json" } }));
      }
      return Promise.resolve(new Response(JSON.stringify({ error: { code: "NOT_EXPECTED", message: "Unexpected request" } }), { status: 500, headers: { "Content-Type": "application/json" } }));
    }));

    render(<App />);

    await user.type(screen.getByLabelText("Email"), "amina@example.test");
    await user.type(screen.getByLabelText("Password"), "Initial-Lab3!Password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("link", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.getByText("REQUESTER")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Select Development Requester" })).not.toBeInTheDocument();
    expect(sessionStorage.length).toBe(0);
  });

  it("keeps the authenticated workspace visible and offers retry when logout fails", async () => {
    setPath("/login");
    const user = userEvent.setup();
    let logoutAttempts = 0;
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me")) {
        return Promise.resolve(new Response(JSON.stringify({ error: { code: "SESSION_REQUIRED", message: "Authentication is required." } }), { status: 401, headers: { "Content-Type": "application/json" } }));
      }
      if (url.endsWith("/api/auth/login")) {
        return Promise.resolve(new Response(JSON.stringify({ user: { id: 101, name: "Amina Rahman", email: "amina@example.test", role: "REQUESTER", isActive: true, mustChangePassword: false }, csrfToken: "csrf-test-token" }), { status: 200, headers: { "Content-Type": "application/json" } }));
      }
      if (url.endsWith("/api/auth/logout") && init?.method === "POST") {
        logoutAttempts += 1;
        return Promise.resolve(logoutAttempts === 1
          ? new Response(JSON.stringify({ error: { code: "LOGOUT_FAILED", message: "Logout failed." } }), { status: 500, headers: { "Content-Type": "application/json" } })
          : new Response(null, { status: 204 }));
      }
      if (url.endsWith("/api/categories")) return Promise.resolve(new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }));
      if (url.endsWith("/api/related-systems")) return Promise.resolve(new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }));
      if (url.includes("/api/tickets?")) return Promise.resolve(new Response(JSON.stringify({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false } }), { status: 200, headers: { "Content-Type": "application/json" } }));
      return Promise.resolve(new Response(JSON.stringify({ error: { code: "NOT_EXPECTED", message: "Unexpected request" } }), { status: 500, headers: { "Content-Type": "application/json" } }));
    }));

    render(<App />);
    await user.type(await screen.findByLabelText("Email"), "amina@example.test");
    await user.type(screen.getByLabelText("Password"), "Initial-Lab3!Password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Logout" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to sign out");
    expect(screen.getByRole("heading", { name: "My Tickets" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry logout" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(logoutAttempts).toBe(2);
  });

  it("redirects to Login when a protected Ticket request returns SESSION_REQUIRED after sign-in", async () => {
    setPath("/login");
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me")) return Promise.resolve(new Response(JSON.stringify({ error: { code: "SESSION_REQUIRED", message: "Authentication is required." } }), { status: 401, headers: { "Content-Type": "application/json" } }));
      if (url.endsWith("/api/auth/login")) return Promise.resolve(new Response(JSON.stringify({ user: { id: 101, name: "Amina Rahman", email: "amina@example.test", role: "REQUESTER", isActive: true, mustChangePassword: false }, csrfToken: "csrf-test-token" }), { status: 200, headers: { "Content-Type": "application/json" } }));
      if (url.endsWith("/api/categories") || url.endsWith("/api/related-systems")) return Promise.resolve(new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }));
      if (url.includes("/api/tickets?")) return Promise.resolve(new Response(JSON.stringify({ error: { code: "SESSION_REQUIRED", message: "Authentication is required." } }), { status: 401, headers: { "Content-Type": "application/json" } }));
      return Promise.resolve(new Response(JSON.stringify({ error: { code: "NOT_EXPECTED", message: "Unexpected request" } }), { status: 500, headers: { "Content-Type": "application/json" } }));
    }));

    render(<App />);
    await user.type(await screen.findByLabelText("Email"), "amina@example.test");
    await user.type(screen.getByLabelText("Password"), "Initial-Lab3!Password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });

  it("redirects a direct unauthenticated Change Password URL to Login", async () => {
    setPath("/change-password");
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/auth/me")) return Promise.resolve(new Response(JSON.stringify({ error: { code: "SESSION_REQUIRED", message: "Authentication is required." } }), { status: 401, headers: { "Content-Type": "application/json" } }));
      return Promise.resolve(new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } }));
    }));

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });

  it("ignores a stale initial session restore after a successful Login", async () => {
    setPath("/login");
    const user = userEvent.setup();
    let resolveRestore!: (response: Response) => void;
    const restoreResponse = new Promise<Response>((resolve) => { resolveRestore = resolve; });
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/auth/me")) return restoreResponse;
      if (url.endsWith("/api/auth/login") && init?.method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({ user: { id: 101, name: "Amina Rahman", email: "amina@example.test", role: "REQUESTER", isActive: true, mustChangePassword: false }, csrfToken: "csrf-test-token" }), { status: 200, headers: { "Content-Type": "application/json" } }));
      }
      if (url.endsWith("/api/categories") || url.endsWith("/api/related-systems")) return Promise.resolve(new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }));
      if (url.includes("/api/tickets?")) return Promise.resolve(new Response(JSON.stringify({ items: [], pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false } }), { status: 200, headers: { "Content-Type": "application/json" } }));
      return Promise.resolve(new Response(JSON.stringify({ error: { code: "NOT_EXPECTED", message: "Unexpected request" } }), { status: 500, headers: { "Content-Type": "application/json" } }));
    }));

    render(<App />);
    await user.type(screen.getByLabelText("Email"), "amina@example.test");
    await user.type(screen.getByLabelText("Password"), "Initial-Lab3!Password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "My Tickets" })).toBeInTheDocument();

    resolveRestore(new Response(JSON.stringify({ error: { code: "SESSION_REQUIRED", message: "Authentication is required." } }), { status: 401, headers: { "Content-Type": "application/json" } }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "My Tickets" })).toBeInTheDocument());
    expect(window.location.pathname).toBe("/tickets");
  });

  it.each(["/staff/tickets", "/staff/tickets/TKT-2026-000001", "/admin/users"])("redirects unauthenticated direct role route %s to Login", async (path) => {
    setPath(path);
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/auth/me")) return Promise.resolve(new Response(JSON.stringify({ error: { code: "SESSION_REQUIRED", message: "Authentication is required." } }), { status: 401, headers: { "Content-Type": "application/json" } }));
      return Promise.resolve(new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } }));
    }));

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });
});
