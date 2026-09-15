import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

function setPath(path: string) {
  window.history.replaceState({}, "", path);
}

describe("Lab 3 authenticated Requester UI", () => {
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
});
