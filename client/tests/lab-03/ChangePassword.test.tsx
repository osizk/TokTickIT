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
    expect(screen.getByText("At least one uppercase letter")).toBeInTheDocument();
    expect(screen.getByText("At least one lowercase letter")).toBeInTheDocument();
    expect(screen.getByText("At least one number")).toBeInTheDocument();
    expect(screen.getByText("At least one symbol")).toBeInTheDocument();
    expect(screen.getByText("No leading or trailing whitespace")).toBeInTheDocument();
    expect(screen.getByText("Different from the current password")).toBeInTheDocument();
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

  it("updates every password requirement and confirmation status while the User types", async () => {
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
    const user = userEvent.setup();
    render(<App />);

    await screen.findByRole("heading", { name: "Change Password" });
    const currentPassword = screen.getByLabelText("Current password");
    const newPassword = screen.getByLabelText("New password");
    const confirmPassword = screen.getByLabelText("Confirm new password");

    expect(screen.getByText("0 of 7 password requirements passed.")).toBeInTheDocument();
    await user.type(currentPassword, "Current-Password!2026");
    await user.type(newPassword, "New-Password!2026");

    expect(screen.getByText("7 of 7 password requirements passed.")).toBeInTheDocument();
    expect(screen.getAllByText("Passed")).toHaveLength(7);

    await user.type(confirmPassword, "does-not-match");
    expect(screen.getByText("Passwords do not match yet.")).toBeInTheDocument();
    await user.clear(confirmPassword);
    await user.type(confirmPassword, "New-Password!2026");
    expect(screen.getByText("Passwords match.")).toBeInTheDocument();
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
