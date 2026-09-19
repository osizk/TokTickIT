import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.js";

function setPath(path: string) {
  window.history.replaceState({}, "", path);
}

describe("Lab 3 Login screen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", "/login");
  });

  it("renders the accessible Login form instead of the removed requester selector", async () => {
    setPath("/login");
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/auth/me")) {
        return Promise.resolve(new Response(JSON.stringify({ error: { code: "SESSION_REQUIRED", message: "Authentication is required." } }), { status: 401, headers: { "Content-Type": "application/json" } }));
      }
      return Promise.resolve(new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } }));
    }));

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    expect(screen.queryByRole("heading", { name: "Select Development Requester" })).not.toBeInTheDocument();
  });
});
