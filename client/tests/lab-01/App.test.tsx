import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App", () => {
  it("renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  it("shows categories returned by the API", async () => {
    vi.spyOn(api, "checkSystem").mockResolvedValue({
      online: true,
      service: "TokTickIT API",
      categories: [
        { id: 11, name: "Database-backed category" },
        { id: 12, name: "Another API category" },
      ],
    });
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Check System" }));

    expect(await screen.findByText("System Status: Online")).toBeInTheDocument();
    expect(screen.getByText("Database-backed category")).toBeInTheDocument();
    expect(screen.getByText("Another API category")).toBeInTheDocument();
  });

  it("shows a loading state while categories are being requested", async () => {
    let resolveSystem!: (value: api.SystemStatus) => void;
    vi.spyOn(api, "checkSystem").mockReturnValue(
      new Promise((resolve) => {
        resolveSystem = resolve;
      })
    );
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Check System" }));

    expect(screen.getByRole("status")).toHaveTextContent("Loading...");

    resolveSystem({
      online: true,
      service: "TokTickIT API",
      categories: [{ id: 21, name: "Loaded after request" }],
    });
    expect(await screen.findByText("Loaded after request")).toBeInTheDocument();
  });

  it("shows an Offline error when the API is unavailable", async () => {
    vi.spyOn(api, "checkSystem").mockRejectedValue(
      new Error("Unable to load request categories.")
    );
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Check System" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("System Status: Offline");
    expect(alert).toHaveTextContent("Unable to load request categories.");
  });
});
