import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App", () => {
  // WORKED EXAMPLE — provided for you.
  it("renders the TokTickIT heading", () => {
    render(<App />);
    expect(screen.getByText(/TokTickIT/i)).toBeInTheDocument();
  });

  it("shows Online after a successful health check", async () => {
    vi.spyOn(api, "checkHealth").mockResolvedValue({
      status: "ok",
      service: "TokTickIT API",
    });
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Check System" }));

    expect(await screen.findByText("System Status: Online")).toBeInTheDocument();
    expect(screen.getByText("Service: TokTickIT API")).toBeInTheDocument();
    expect(api.checkHealth).toHaveBeenCalledTimes(1);
  });

  it("shows Offline with a useful message when the backend is unavailable", async () => {
    vi.spyOn(api, "checkHealth").mockRejectedValue(
      new Error("Unable to connect to TokTickIT API.")
    );
    const user = userEvent.setup();

    render(<App />);
    await user.click(screen.getByRole("button", { name: "Check System" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("System Status: Offline");
    expect(alert).toHaveTextContent("Unable to connect to TokTickIT API.");
  });

  // Issue 4 — write these yourself. Hint: mock the api module with
  // vi.spyOn(api, "checkSystem").mockResolvedValue(...) / .mockRejectedValue(...)
  // then click the button and assert the Online list / Offline message.
  it.todo("shows Online and the seeded categories on success");
  it.todo("shows an Offline error message when the API is unavailable");
});
