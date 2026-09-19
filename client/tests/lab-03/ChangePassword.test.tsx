import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";

function setPath(path: string) {
  window.history.replaceState({}, "", path);
}

describe("Lab 3 mandatory Change Password screen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/login");
  });

  it("keeps a first-login User on the password-change route with required controls", async () => {
    setPath("/change-password");
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/auth/me")) {
        return Promise.resolve(new Response(JSON.stringify({
          user: { id: 101, name: "Amina Rahman", email: "amina@example.test", role: "REQUESTER", isActive: true, mustChangePassword: true },
          csrfToken: "csrf-test-token",
        }), { status: 200, headers: { "Content-Type": "application/json" } }));
      }
      return Promise.resolve(new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } }));
    }));

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Change Password" })).toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
    expect(screen.getByText("12-128 characters")).toBeInTheDocument();
    expect(screen.getByText(/uppercase letter, lowercase letter, number, and symbol/)).toBeInTheDocument();
    expect(screen.getByText("No leading or trailing whitespace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save password" })).toBeDisabled();
  });

  it("shows precise local password validation before making a request", async () => {
    setPath("/change-password");
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/auth/me")) {
        return Promise.resolve(new Response(JSON.stringify({
          user: { id: 101, name: "Amina Rahman", email: "amina@example.test", role: "REQUESTER", isActive: true, mustChangePassword: true },
          csrfToken: "csrf-test-token",
        }), { status: 200, headers: { "Content-Type": "application/json" } }));
      }
      return Promise.resolve(new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Change Password" });
    await user.type(screen.getByLabelText("Current password"), "Current-Password!2026");
    await user.type(screen.getByLabelText("New password"), "short");
    await user.type(screen.getByLabelText("Confirm new password"), "short");
    await user.click(screen.getByRole("button", { name: "Save password" }));

    expect(screen.getByText("Please correct the highlighted fields.")).toBeInTheDocument();
    expect(screen.getByText("Password must be 12-128 characters without surrounding whitespace.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces safe server messages and field errors", async () => {
    setPath("/change-password");
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/auth/me")) {
        return Promise.resolve(new Response(JSON.stringify({
          user: { id: 101, name: "Amina Rahman", email: "amina@example.test", role: "REQUESTER", isActive: true, mustChangePassword: true },
          csrfToken: "csrf-test-token",
        }), { status: 200, headers: { "Content-Type": "application/json" } }));
      }
      if (String(input).endsWith("/api/auth/change-password")) {
        return Promise.resolve(new Response(JSON.stringify({ error: {
          code: "VALIDATION_ERROR",
          message: "Check the highlighted fields.",
          fieldErrors: { newPassword: "Password must include uppercase, lowercase, number, and symbol characters." },
        } }), { status: 400, headers: { "Content-Type": "application/json" } }));
      }
      return Promise.resolve(new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Change Password" });
    await user.type(screen.getByLabelText("Current password"), "Current-Password!2026");
    await user.type(screen.getByLabelText("New password"), "New-Password!2026");
    await user.type(screen.getByLabelText("Confirm new password"), "New-Password!2026");
    await user.click(screen.getByRole("button", { name: "Save password" }));

    expect(await screen.findByText("Check the highlighted fields.")).toBeInTheDocument();
    expect(screen.getByText("Password must include uppercase, lowercase, number, and symbol characters.")).toBeInTheDocument();
  });
});
