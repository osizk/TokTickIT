import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ApiClientError,
  type AdminUser,
  type AuthUser,
  createAdminUser,
  fetchAdminUsers,
  resetAdminUserPassword,
  updateAdminUser,
} from "./api.js";

type ManagedRole = AuthUser["role"];
type EditorState = {
  id?: number;
  name: string;
  email: string;
  role: ManagedRole;
  isActive: boolean;
  initialPassword: string;
};

const roles: ManagedRole[] = ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"];

function safeMessage(error: unknown, fallback: string): string {
  return error instanceof ApiClientError && error.message ? error.message : fallback;
}

function emptyEditor(): EditorState {
  return { name: "", email: "", role: "REQUESTER", isActive: true, initialPassword: "" };
}

function UserTable({ users, onEdit, selectedUserId }: { users: AdminUser[]; onEdit: (user: AdminUser) => void; selectedUserId?: number }) {
  return (
    <>
      <div className="admin-users-table-wrap">
        <table className="admin-users-table" aria-label="Users">
          <thead><tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{users.map((user) => <tr key={user.id} className={user.id === selectedUserId ? "is-selected" : undefined}>
            <td>{user.name}</td><td>{user.email}</td><td>{user.role.replace("_", " ")}</td><td>{user.isActive ? "Active" : "Inactive"}</td>
            <td><button className="zen-button zen-button-secondary" type="button" onClick={() => onEdit(user)} aria-label={`Edit ${user.name}`}>Edit</button></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="admin-users-cards" aria-label="Mobile user cards">
        {users.map((user) => <article className={`admin-user-card${user.id === selectedUserId ? " is-selected" : ""}`} key={user.id}>
          <h3>{user.name}</h3><dl><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Role</dt><dd>{user.role.replace("_", " ")}</dd></div><div><dt>Status</dt><dd>{user.isActive ? "Active" : "Inactive"}</dd></div></dl>
          <button className="zen-button zen-button-secondary" type="button" onClick={() => onEdit(user)} aria-label={`Edit ${user.name}`}>Edit</button>
        </article>)}
      </div>
    </>
  );
}

export default function AdminUserManagement() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [role, setRole] = useState<ManagedRole | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const editorRef = useRef<HTMLDivElement | null>(null);
  const editorHeadingRef = useRef<HTMLHeadingElement | null>(null);

  const load = useCallback(async (nextSearch = appliedSearch, nextRole: ManagedRole | "" = role) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminUsers({ ...(nextSearch ? { search: nextSearch } : {}), ...(nextRole ? { role: nextRole } : {}) });
      setUsers(result.users);
    } catch (reason) {
      setError(safeMessage(reason, "Unable to load Users."));
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, role]);

  useEffect(() => { void load("", ""); }, []);

  useEffect(() => {
    if (!editor) return;
    const timer = window.setTimeout(() => {
      editorRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      editorHeadingRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [editor?.id]);

  function openCreate() {
    setEditor(emptyEditor());
    setFieldErrors({});
    setError(null);
    setResetOpen(false);
    setResetPassword("");
  }

  function openEdit(user: AdminUser) {
    setEditor({ id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, initialPassword: "" });
    setFieldErrors({});
    setError(null);
    setResetOpen(false);
    setResetPassword("");
  }

  function validateEditor(): boolean {
    if (!editor) return false;
    const errors: Record<string, string> = {};
    if (editor.name.trim().length < 2 || editor.name.trim().length > 100) errors.name = "Name must be 2-100 characters.";
    if (!/^\S+@\S+\.\S+$/.test(editor.email.trim())) errors.email = "Enter a valid email address.";
    if (!roles.includes(editor.role)) errors.role = "Choose a valid User role.";
    if (!editor.id && (editor.initialPassword.length < 12 || !/[A-Z]/.test(editor.initialPassword) || !/[a-z]/.test(editor.initialPassword) || !/[0-9]/.test(editor.initialPassword) || !/[^A-Za-z0-9]/.test(editor.initialPassword))) errors.initialPassword = "Password must meet the Lab 3 policy.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || saving || !validateEditor()) return;
    setSaving(true);
    setError(null);
    try {
      if (editor.id) {
        const result = await updateAdminUser(editor.id, { name: editor.name.trim(), email: editor.email.trim(), role: editor.role, isActive: editor.isActive });
        setUsers((current) => current.map((user) => user.id === result.user.id ? result.user : user));
      } else {
        const result = await createAdminUser({ name: editor.name.trim(), email: editor.email.trim(), role: editor.role, isActive: editor.isActive, initialPassword: editor.initialPassword });
        setUsers((current) => [...current, result.user].sort((a, b) => a.name.localeCompare(b.name)));
      }
      setEditor(null);
    } catch (reason) {
      setError(safeMessage(reason, "Unable to save User."));
    } finally {
      setSaving(false);
    }
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor?.id || saving) return;
    if (resetPassword.length < 12 || !/[A-Z]/.test(resetPassword) || !/[a-z]/.test(resetPassword) || !/[0-9]/.test(resetPassword) || !/[^A-Za-z0-9]/.test(resetPassword)) {
      setFieldErrors({ initialPassword: "Password must meet the Lab 3 policy." });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await resetAdminUserPassword(editor.id, resetPassword);
      setUsers((current) => current.map((user) => user.id === result.user.id ? result.user : user));
      setResetOpen(false);
      setResetPassword("");
    } catch (reason) {
      setError(safeMessage(reason, "Unable to reset the initial password."));
    } finally {
      setSaving(false);
    }
  }

  async function applySearch() {
    const next = search.trim();
    setAppliedSearch(next);
    await load(next, role);
  }

  async function changeRole(next: string) {
    const nextRole = next as ManagedRole | "";
    setRole(nextRole);
    await load(appliedSearch, nextRole);
  }

  return (
    <section className="zen-card admin-users" aria-labelledby="user-management-heading">
      <div className="admin-users-heading"><div><p className="zen-eyebrow">Administrator workspace</p><h1 id="user-management-heading">User Management</h1><p className="zen-lead">Create and maintain individual TokTickIT accounts.</p></div><button className="zen-button zen-button-primary" type="button" onClick={openCreate}>Create User</button></div>
      <div className="admin-users-controls" aria-label="User search controls">
        <div className="zen-field"><label htmlFor="admin-user-search">Search users</label><input id="admin-user-search" className="zen-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <div className="zen-field"><label htmlFor="admin-user-role">Role</label><select id="admin-user-role" className="zen-input" value={role} onChange={(event) => void changeRole(event.target.value)}><option value="">All roles</option>{roles.map((value) => <option key={value} value={value}>{value.replace("_", " ")}</option>)}</select></div>
        <button className="zen-button zen-button-secondary" type="button" onClick={() => void applySearch()}>Search</button>
      </div>
      {error && <div className="zen-state zen-state-error" role="alert" aria-label="User management error"><p>{error}</p><button className="zen-button zen-button-secondary" type="button" onClick={() => void load()}>Retry</button></div>}
      {loading ? <p className="zen-state zen-state-info" role="status">Loading Users...</p> : users.length === 0 ? <p className="zen-state zen-state-info">No Users match the current search.</p> : <UserTable users={users} onEdit={openEdit} selectedUserId={editor?.id} />}
      {editor && <div ref={editorRef} className="admin-editor" role="dialog" aria-label={editor.id ? "Edit User" : "Create User"}><div className="admin-editor-header"><h2 ref={editorHeadingRef} id="admin-editor-heading" tabIndex={-1}>{editor.id ? `Edit User - ${editor.name}` : "Create User"}</h2><button className="zen-button zen-button-link" type="button" onClick={() => setEditor(null)}>Cancel</button></div><form onSubmit={(event) => void submitEditor(event)} noValidate><div className="zen-form-grid">
        <div className="zen-field"><label htmlFor="admin-name">Name</label><input id="admin-name" className="zen-input" value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} aria-invalid={Boolean(fieldErrors.name)} />{fieldErrors.name && <span className="zen-field-error">{fieldErrors.name}</span>}</div>
        <div className="zen-field"><label htmlFor="admin-email">Email</label><input id="admin-email" className="zen-input" type="email" value={editor.email} onChange={(event) => setEditor({ ...editor, email: event.target.value })} aria-invalid={Boolean(fieldErrors.email)} />{fieldErrors.email && <span className="zen-field-error">{fieldErrors.email}</span>}</div>
        <div className="zen-field"><label htmlFor="admin-role">User role</label><select id="admin-role" className="zen-input" value={editor.role} onChange={(event) => setEditor({ ...editor, role: event.target.value as ManagedRole })} aria-invalid={Boolean(fieldErrors.role)}>{roles.map((value) => <option key={value} value={value}>{value.replace("_", " ")}</option>)}</select>{fieldErrors.role && <span className="zen-field-error">{fieldErrors.role}</span>}</div>
        <label className="zen-checkbox-label" htmlFor="admin-active"><input id="admin-active" type="checkbox" checked={editor.isActive} onChange={(event) => setEditor({ ...editor, isActive: event.target.checked })} /> Active</label>
        {!editor.id && <div className="zen-field"><label htmlFor="admin-initial-password">Initial password</label><input id="admin-initial-password" className="zen-input" type="password" value={editor.initialPassword} onChange={(event) => setEditor({ ...editor, initialPassword: event.target.value })} aria-invalid={Boolean(fieldErrors.initialPassword)} />{fieldErrors.initialPassword && <span className="zen-field-error">{fieldErrors.initialPassword}</span>}</div>}
      </div>{fieldErrors.initialPassword && editor.id && <p className="zen-field-error">{fieldErrors.initialPassword}</p>}<div className="zen-form-actions"><button className="zen-button zen-button-primary" type="submit" disabled={saving}>{saving ? "Saving..." : "Save User"}</button></div></form>
        {editor.id && <div className="admin-password-reset"><button className="zen-button zen-button-secondary" type="button" onClick={() => setResetOpen((current) => !current)}>Reset initial password</button>{resetOpen && <form onSubmit={(event) => void submitReset(event)}><div className="zen-field"><label htmlFor="admin-reset-password">New initial password</label><input id="admin-reset-password" className="zen-input" type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} /></div><button className="zen-button zen-button-secondary" type="submit" disabled={saving}>Save password reset</button></form>}</div>}
      </div>}
    </section>
  );
}
