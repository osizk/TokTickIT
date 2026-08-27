import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../../src/App.js";
import * as api from "../../src/api.js";

const activeRequesters: api.Requester[] = [
  { id: 1, name: "Amina Rahman", email: "amina@example.test" },
  { id: 2, name: "Ben Carter", email: "ben@example.test" },
];

function setPath(path: string) {
  window.history.replaceState({}, "", path);
}

describe("Development Requester context", () => {
  beforeEach(() => {
    sessionStorage.clear();
    setPath("/select-requester");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading, active options, an accessible select, and a disabled Continue button", async () => {
    let resolveRequesters!: (value: api.Requester[]) => void;
    vi.spyOn(api, "fetchRequesters").mockReturnValue(
      new Promise((resolve) => {
        resolveRequesters = resolve;
      }),
    );
    const user = userEvent.setup();

    render(<App />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading Development Requesters",
    );
    const requesterSelect = screen.getByRole("combobox", {
      name: "Development Requester",
    });
    expect(requesterSelect).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    resolveRequesters(activeRequesters);
    expect(
      await screen.findByRole("option", { name: "Amina Rahman (amina@example.test)" }),
    ).toBeInTheDocument();
    requesterSelect.focus();
    expect(requesterSelect).toHaveFocus();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();

    await user.selectOptions(requesterSelect, "2");
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("shows a safe failure with Retry and reloads requesters", async () => {
    vi.spyOn(api, "fetchRequesters")
      .mockRejectedValueOnce(new Error("database details must not escape"))
      .mockResolvedValueOnce(activeRequesters);
    const user = userEvent.setup();

    render(<App />);

    expect(
      await screen.findByRole("alert", { name: "Requester loading error" }),
    ).toHaveTextContent("Unable to load Development Requesters.");
    expect(screen.queryByText("database details must not escape")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("option", { name: "Ben Carter (ben@example.test)" }),
    ).toBeInTheDocument();
  });

  it("shows an actionable empty state when there are no active requesters", async () => {
    vi.spyOn(api, "fetchRequesters").mockResolvedValue([]);

    render(<App />);

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "No active Development Requesters are available.",
      ),
    );
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("retains a valid stored requester and guards protected routes", async () => {
    sessionStorage.setItem("toktickit.requesterId", "2");
    vi.spyOn(api, "fetchRequesters").mockResolvedValue(activeRequesters);

    render(<App />);

    expect(await screen.findByText("Ben Carter")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My Tickets" })).toHaveAttribute(
      "href",
      "/tickets",
    );
    expect(window.location.pathname).toBe("/tickets");
    expect(sessionStorage.getItem("toktickit.requesterId")).toBe("2");
  });

  it("clears an invalid stored requester and returns to selection", async () => {
    sessionStorage.setItem("toktickit.requesterId", "999");
    setPath("/tickets");
    vi.spyOn(api, "fetchRequesters").mockResolvedValue(activeRequesters);

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Select Development Requester" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/select-requester");
    expect(sessionStorage.getItem("toktickit.requesterId")).toBeNull();
  });

  it("clears a malformed stored requester id", async () => {
    sessionStorage.setItem("toktickit.requesterId", "not-a-requester-id");
    setPath("/tickets");
    vi.spyOn(api, "fetchRequesters").mockResolvedValue(activeRequesters);

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Select Development Requester" }),
    ).toBeInTheDocument();
    expect(sessionStorage.getItem("toktickit.requesterId")).toBeNull();
  });

  it("stores only the selected id, navigates to the shell, and Change Requester clears it", async () => {
    vi.spyOn(api, "fetchRequesters").mockResolvedValue(activeRequesters);
    const user = userEvent.setup();

    render(<App />);

    await user.selectOptions(
      await screen.findByRole("combobox", { name: "Development Requester" }),
      "1",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(window.location.pathname).toBe("/tickets"));
    expect(sessionStorage.getItem("toktickit.requesterId")).toBe("1");
    expect(screen.getByRole("heading", { name: "My Tickets" })).toBeInTheDocument();
    expect(screen.getByText("Amina Rahman")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Change Requester" }));

    expect(window.location.pathname).toBe("/select-requester");
    expect(sessionStorage.getItem("toktickit.requesterId")).toBeNull();
    expect(
      await screen.findByRole("heading", { name: "Select Development Requester" }),
    ).toBeInTheDocument();
  });
});
