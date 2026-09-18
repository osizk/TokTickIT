import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminUserManagement from "../../src/AdminUserManagement.js";
import * as api from "../../src/api.js";

const admin: api.AdminUser = {
  id: 1,
  name: "Amina Admin",
  email: "amina.admin@example.test",
  role: "ADMINISTRATOR",
  isActive: true,
  mustChangePassword: false,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};
const staff: api.AdminUser = {
  id: 2,
  name: "Michael Staff",
  email: "michael.staff@example.test",
  role: "IT_STAFF",
  isActive: true,
  mustChangePassword: false,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};
const requester: api.AdminUser = {
  id: 3,
  name: "Ben Requester",
  email: "ben.requester@example.test",
  role: "REQUESTER",
  isActive: false,
  mustChangePassword: true,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

describe("Lab 3 Administrator User Management", () => {
  beforeEach(() => {
    vi.spyOn(api, "fetchAdminUsers").mockResolvedValue({ users: [admin, staff, requester] });
    vi.spyOn(api, "createAdminUser").mockResolvedValue({ user: { ...staff, id: 9, email: "new.user@example.test", name: "New User", role: "IT_STAFF", mustChangePassword: true } });
    vi.spyOn(api, "updateAdminUser").mockResolvedValue({ user: { ...staff, name: "Michael Updated" } });
    vi.spyOn(api, "resetAdminUserPassword").mockResolvedValue({ user: { ...staff, mustChangePassword: true } });
  });

  afterEach(() => vi.restoreAllMocks());

  it("loads a searchable, role-filterable safe user list", async () => {
    const user = userEvent.setup();
    render(<AdminUserManagement />);

    expect(await screen.findByRole("heading", { name: "User Management" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search users" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Role" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Users" })).toBeInTheDocument();
    expect(screen.getAllByText("Michael Staff").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Inactive").length).toBeGreaterThan(0);

    await user.type(screen.getByRole("searchbox", { name: "Search users" }), "Michael");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => expect(api.fetchAdminUsers).toHaveBeenLastCalledWith({ search: "Michael" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Role" }), "IT_STAFF");
    await waitFor(() => expect(api.fetchAdminUsers).toHaveBeenLastCalledWith({ search: "Michael", role: "IT_STAFF" }));
  });

  it("renders mobile user cards with usable Edit actions", async () => {
    render(<AdminUserManagement />);

    const mobileCards = await screen.findByLabelText("Mobile user cards");
    expect(mobileCards).toHaveClass("admin-users-cards");
    expect(within(mobileCards).getAllByRole("button", { name: /^Edit / })).toHaveLength(3);
    expect(within(mobileCards).getByRole("button", { name: "Edit Michael Staff" })).toBeEnabled();
  });

  it("creates and edits one-role users with safe conflict feedback", async () => {
    const user = userEvent.setup();
    render(<AdminUserManagement />);
    await user.click(await screen.findByRole("button", { name: "Create User" }));
    await user.type(screen.getByLabelText("Name"), "New User");
    await user.type(screen.getByLabelText("Email"), "new.user@example.test");
    await user.selectOptions(screen.getByRole("combobox", { name: "User role" }), "IT_STAFF");
    await user.type(screen.getByLabelText("Initial password"), "Initial-User!2026");
    await user.click(screen.getByRole("button", { name: "Save User" }));
    await waitFor(() => expect(api.createAdminUser).toHaveBeenCalledWith({ name: "New User", email: "new.user@example.test", role: "IT_STAFF", isActive: true, initialPassword: "Initial-User!2026" }));

    await user.click(screen.getAllByRole("button", { name: "Edit Michael Staff" })[0]);
    const name = screen.getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Michael Updated");
    await user.click(screen.getByRole("button", { name: "Save User" }));
    await waitFor(() => expect(api.updateAdminUser).toHaveBeenCalledWith(2, { name: "Michael Updated", email: staff.email, role: "IT_STAFF", isActive: true }));
  });

  it("shows safe owner/safety failures and offers a password reset action", async () => {
    vi.mocked(api.updateAdminUser).mockRejectedValueOnce(new api.ApiClientError("This User owns Tickets and cannot be made ineligible.", 409, "USER_OWNS_TICKETS"));
    const user = userEvent.setup();
    render(<AdminUserManagement />);
    await user.click((await screen.findAllByRole("button", { name: "Edit Michael Staff" }))[0]);
    await user.click(screen.getByLabelText("Active"));
    await user.click(screen.getByRole("button", { name: "Save User" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("owns Tickets");
    expect(screen.getByRole("button", { name: "Reset initial password" })).toBeInTheDocument();
  });
});
