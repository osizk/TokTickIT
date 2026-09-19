import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from "react";
import {
  ApiClientError,
  AuthUser,
  Requester,
  changePassword,
  currentUser,
  checkSystem,
  login,
  logout,
  setSessionExpiredHandler,
} from "./api.js";
import CreateTicketPage from "./CreateTicket.js";
import MyTickets from "./MyTickets.js";
import TicketDetail from "./TicketDetail.js";
import StaffTicketQueue from "./StaffTicketQueue.js";
import StaffTicketDetail from "./StaffTicketDetail.js";
import AdminUserManagement from "./AdminUserManagement.js";
import "./styles.css";

export const REQUESTER_STORAGE_KEY = "toktickit.requesterId";

function currentPath(): string {
  return typeof window === "undefined" ? "/login" : window.location.pathname;
}

function isProtectedPath(path: string): boolean {
  return path === "/select-requester" || path === "/change-password" || path === "/tickets" || path === "/tickets/new" || /^\/tickets\/[^/]+$/.test(path) || path === "/admin/users" || /^\/staff\/tickets(?:\/[^/]+)?$/.test(path);
}

function landingPath(user: AuthUser): string {
  if (user.role === "REQUESTER") return "/tickets";
  if (user.role === "ADMINISTRATOR") return "/admin/users";
  return "/staff/tickets";
}

function toRequester(user: AuthUser): Requester {
  return { id: user.legacyRequesterId ?? user.id, name: user.name, email: user.email };
}

function navigateTo(nextPath: string) {
  const nextUrl = new URL(nextPath, window.location.origin);
  const currentUrl = new URL(window.location.href);
  const currentLocation = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
  const nextLocation = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  if (currentLocation !== nextLocation) {
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}

function LegacyHealthPage() {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [service, setService] = useState<string | null>(null);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  async function handleCheck() {
    setState("loading"); setErrorMessage(null);
    try { const system = await checkSystem(); setService(system.service); setCategories(system.categories); setState("success"); }
    catch (error) { setErrorMessage(error instanceof Error ? error.message : "Unable to connect to TokTickIT API."); setState("error"); }
  }
  return <div className="container py-5" style={{ maxWidth: 640 }}><h1 className="h3 mb-4">TokTickIT <span className="text-success">IT Service Desk</span></h1><button className="btn btn-success" onClick={() => void handleCheck()} disabled={state === "loading"}>{state === "loading" ? "Loading..." : "Check System"}</button>{state === "loading" && <p className="mt-4" role="status">Loading...</p>}{state === "success" && <div className="mt-4" role="status"><p>System Status: Online</p><p>Service: {service}</p><h2 className="h5 mt-4">Supported Request Categories</h2><ul aria-label="Supported Request Categories">{categories.map((category) => <li key={category.id}>{category.name}</li>)}</ul></div>}{state === "error" && <div className="alert alert-danger mt-4" role="alert"><p className="mb-1">System Status: Offline</p><p className="mb-0">{errorMessage}</p></div>}</div>;
}

function LoginPage({ onSuccess }: { onSuccess: (result: { user: AuthUser }) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await login(email, password);
      onSuccess(result);
      setPassword("");
    } catch (reason) {
      setError(reason instanceof ApiClientError ? reason.message : "Email or password is incorrect.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="zen-page">
      <header className="zen-public-header"><a className="zen-brand" href="/login" aria-label="TokTickIT home"><span className="zen-brand-mark" aria-hidden="true">T</span><span><strong>TokTickIT</strong><small>IT Service Desk</small></span></a></header>
      <main className="zen-main" id="main-content"><section className="zen-card zen-selection-card" aria-labelledby="login-heading">
        <p className="zen-eyebrow">Secure service desk access</p><h1 id="login-heading">Sign in</h1>
        <p className="zen-lead">Use your TokTickIT account to access your permitted workspace.</p>
        <form onSubmit={(event) => void submit(event)} noValidate>
          <div className="zen-form-grid">
            <div className="zen-field"><label htmlFor="login-email">Email</label><input id="login-email" className="zen-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></div>
            <div className="zen-field"><label htmlFor="login-password">Password</label><input id="login-password" className="zen-input" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /><label className="zen-checkbox-label"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} /> Show password</label></div>
          </div>
          {error && <p className="zen-field-error" role="alert">{error}</p>}
          <div className="zen-form-actions"><button className="zen-button zen-button-primary" type="submit" disabled={submitting || !email.trim() || !password}>{submitting ? "Signing in..." : "Sign in"}</button></div>
        </form>
      </section></main>
    </div>
  );
}

function LogoutFeedback({ message, onRetry, pending }: { message: string | null; onRetry: () => void; pending: boolean }) {
  if (!message) return null;
  return <div className="zen-state zen-state-error" role="alert"><p>{message}</p><button className="zen-button zen-button-secondary" type="button" onClick={onRetry} disabled={pending}>{pending ? "Retrying logout..." : "Retry logout"}</button></div>;
}

function PasswordRequirement({ met, active, children }: { met: boolean; active: boolean; children: string }) {
  const state = !active ? "required" : met ? "passed" : "not-yet";
  return (
    <li className={`zen-password-rule is-${state}`}>
      <span className="zen-password-rule-icon" aria-hidden="true">{!active ? "–" : met ? "✓" : "×"}</span>
      <span className="zen-password-rule-label">{children}</span>
      <span className="zen-password-rule-state">{!active ? "Required" : met ? "Passed" : "Not yet"}</span>
    </li>
  );
}

function ChangePasswordPage({ user, onSuccess, onLogout, logoutError, logoutPending }: { user: AuthUser; onSuccess: (next: AuthUser) => void; onLogout: () => void; logoutError: string | null; logoutPending: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const passwordStarted = next.length > 0;
  const passwordRequirements = [
    { label: "12-128 characters", met: next.length >= 12 && next.length <= 128 },
    { label: "At least one uppercase letter", met: /[A-Z]/.test(next) },
    { label: "At least one lowercase letter", met: /[a-z]/.test(next) },
    { label: "At least one number", met: /[0-9]/.test(next) },
    { label: "At least one symbol", met: /[^A-Za-z0-9]/.test(next) },
    { label: "No leading or trailing whitespace", met: next.trim() === next },
    { label: "Different from the current password", met: current.length > 0 && next !== current },
  ];
  const passedRequirementCount = passwordStarted ? passwordRequirements.filter((requirement) => requirement.met).length : 0;
  const confirmationStarted = confirm.length > 0;
  const passwordsMatch = confirmationStarted && confirm === next;

  function updatePasswordField(field: "current" | "next" | "confirm", value: string) {
    if (field === "current") setCurrent(value);
    if (field === "next") setNext(value);
    if (field === "confirm") setConfirm(value);
    setFieldErrors((previous) => {
      if (!previous[field]) return previous;
      const updated = { ...previous };
      delete updated[field];
      return updated;
    });
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const nextFieldErrors: Record<string, string> = {};
    if (!current) nextFieldErrors.current = "Current password is required.";
    if (!next) nextFieldErrors.next = "New password is required.";
    else if (next.length < 12 || next.length > 128 || next.trim() !== next) nextFieldErrors.next = "Password must be 12-128 characters without surrounding whitespace.";
    else if (!/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/[0-9]/.test(next) || !/[^A-Za-z0-9]/.test(next)) nextFieldErrors.next = "Password must include uppercase, lowercase, number, and symbol characters.";
    if (confirm !== next) nextFieldErrors.confirm = "Passwords must match.";
    if (current && next && current === next) nextFieldErrors.next = "New password must differ from the current password.";
    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError("Please correct the highlighted fields.");
      return;
    }
    setSubmitting(true); setError(null);
    setFieldErrors({});
    try { const result = await changePassword(current, next, confirm); onSuccess(result.user); }
    catch (reason) {
      if (reason instanceof ApiClientError) {
        setError(reason.message);
        const serverErrors = reason.fieldErrors ?? {};
        setFieldErrors({
          ...(serverErrors.currentPassword ? { current: serverErrors.currentPassword } : {}),
          ...(serverErrors.newPassword ? { next: serverErrors.newPassword } : {}),
          ...(serverErrors.confirmPassword ? { confirm: serverErrors.confirmPassword } : {}),
        });
      } else {
        setError("Unable to change password. Please try again.");
      }
    }
    finally { setSubmitting(false); }
  }
  return (
    <div className="zen-page">
      <header className="zen-public-header"><div className="zen-header-inner"><span className="zen-brand"><span className="zen-brand-mark" aria-hidden="true">T</span><span><strong>TokTickIT</strong><small>IT Service Desk</small></span></span><button className="zen-button zen-button-link" type="button" onClick={onLogout} disabled={logoutPending}>{logoutPending ? "Signing out..." : "Logout"}</button></div></header>
      <main className="zen-main" id="main-content"><LogoutFeedback message={logoutError} onRetry={onLogout} pending={logoutPending} /><section className="zen-card zen-selection-card" aria-labelledby="change-password-heading">
        <p className="zen-eyebrow">First-login security</p><h1 id="change-password-heading">Change Password</h1><p className="zen-lead">{user.name}, change the initial password before entering the application.</p>
        <form onSubmit={(event) => void submit(event)} noValidate><div className="zen-form-grid">
          <div className="zen-field"><label htmlFor="current-password">Current password</label><input id="current-password" className="zen-input" type="password" value={current} onChange={(event) => updatePasswordField("current", event.target.value)} autoComplete="current-password" aria-invalid={Boolean(fieldErrors.current)} aria-describedby={fieldErrors.current ? "current-password-error" : undefined} required />{fieldErrors.current && <p id="current-password-error" className="zen-field-error" role="alert">{fieldErrors.current}</p>}</div>
          <div className="zen-field"><label htmlFor="new-password">New password</label><input id="new-password" className="zen-input" type="password" value={next} onChange={(event) => updatePasswordField("next", event.target.value)} autoComplete="new-password" aria-invalid={Boolean(fieldErrors.next)} aria-describedby={`password-policy-summary password-policy-hint${fieldErrors.next ? " new-password-error" : ""}`} required /><p id="password-policy-summary" className="zen-password-policy-summary" role="status" aria-live="polite">{passedRequirementCount} of {passwordRequirements.length} password requirements passed.</p><ul id="password-policy-hint" className="zen-password-policy">{passwordRequirements.map((requirement) => <PasswordRequirement key={requirement.label} met={requirement.met} active={passwordStarted}>{requirement.label}</PasswordRequirement>)}</ul>{fieldErrors.next && <p id="new-password-error" className="zen-field-error" role="alert">{fieldErrors.next}</p>}</div>
          <div className="zen-field"><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" className="zen-input" type="password" value={confirm} onChange={(event) => updatePasswordField("confirm", event.target.value)} autoComplete="new-password" aria-invalid={Boolean(fieldErrors.confirm) || (confirmationStarted && !passwordsMatch)} aria-describedby={`${confirmationStarted ? "password-match-status" : ""}${fieldErrors.confirm ? " confirm-password-error" : ""}`.trim() || undefined} required />{confirmationStarted && <p id="password-match-status" className={`zen-password-match ${passwordsMatch ? "is-passed" : "is-not-yet"}`} role="status" aria-live="polite"><span aria-hidden="true">{passwordsMatch ? "✓" : "×"}</span> {passwordsMatch ? "Passwords match." : "Passwords do not match yet."}</p>}{fieldErrors.confirm && <p id="confirm-password-error" className="zen-field-error" role="alert">{fieldErrors.confirm}</p>}</div>
        </div>{error && <p className="zen-field-error" role="alert">{error}</p>}<div className="zen-form-actions"><button className="zen-button zen-button-primary" type="submit" disabled={submitting || !current || !next || !confirm}>{submitting ? "Saving password..." : "Save password"}</button></div></form>
      </section></main>
    </div>
  );
}

interface ShellProps { path: string; user: AuthUser; navigate: (path: string) => void; onLogout: () => void; logoutError: string | null; logoutPending: boolean; }

function AppShell({ path, user, navigate, onLogout, logoutError, logoutPending }: ShellProps) {
  const requester = useMemo(() => toRequester(user), [user]);
  const goTo = (event: MouseEvent<HTMLAnchorElement>, nextPath: string) => { event.preventDefault(); navigate(nextPath); };
  return (
    <div className="zen-page"><header className="zen-app-header"><div className="zen-header-inner">
      <a className="zen-brand" href={landingPath(user)} onClick={(event) => goTo(event, landingPath(user))}><span className="zen-brand-mark" aria-hidden="true">T</span><span><strong>TokTickIT</strong><small>IT Service Desk</small></span></a>
      {user.role === "REQUESTER" && <nav className="zen-nav" aria-label="Primary navigation"><a href="/tickets" className={path === "/tickets" ? "is-active" : undefined} aria-current={path === "/tickets" ? "page" : undefined} onClick={(event) => goTo(event, "/tickets")}>My Tickets</a><a href="/tickets/new" className={path === "/tickets/new" ? "is-active" : undefined} aria-current={path === "/tickets/new" ? "page" : undefined} onClick={(event) => goTo(event, "/tickets/new")}>Create Ticket</a></nav>}
      {(user.role === "IT_STAFF" || user.role === "ADMINISTRATOR") && <nav className="zen-nav" aria-label="Primary navigation"><a href="/staff/tickets" className={path === "/staff/tickets" ? "is-active" : undefined} aria-current={path === "/staff/tickets" ? "page" : undefined} onClick={(event) => goTo(event, "/staff/tickets")}>Ticket Queue</a>{user.role === "ADMINISTRATOR" && <a href="/admin/users" className={path === "/admin/users" ? "is-active" : undefined} aria-current={path === "/admin/users" ? "page" : undefined} onClick={(event) => goTo(event, "/admin/users")}>User Management</a>}</nav>}
      <div className="zen-identity" aria-label="Current user"><span className="zen-identity-label">{user.role.replace("_", " ")}</span><strong>{user.name}</strong><button className="zen-button zen-button-link" type="button" onClick={onLogout} disabled={logoutPending}>{logoutPending ? "Signing out..." : "Logout"}</button></div>
    </div></header><main className="zen-main" id="main-content"><LogoutFeedback message={logoutError} onRetry={onLogout} pending={logoutPending} /><RouteContent path={path} user={user} requester={requester} navigate={navigate} /></main></div>
  );
}

function RouteContent({ path, user, requester, navigate }: { path: string; user: AuthUser; requester: Requester; navigate: (path: string) => void }) {
  if (user.role === "REQUESTER" && path === "/tickets/new") return <CreateTicketPage requester={requester} navigate={navigate} />;
  if (user.role === "REQUESTER" && path === "/tickets") return <MyTickets requester={requester} navigate={navigate} />;
  if (user.role === "REQUESTER" && path.startsWith("/tickets/") && path !== "/tickets/new") {
    let ticketNumber = path.slice("/tickets/".length);
    try { ticketNumber = decodeURIComponent(ticketNumber); } catch { /* API returns a safe not-found response. */ }
    return <TicketDetail requester={requester} ticketNumber={ticketNumber} navigate={navigate} />;
  }
  if ((user.role === "IT_STAFF" || user.role === "ADMINISTRATOR") && path === "/staff/tickets") {
    return <StaffTicketQueue navigate={navigate} />;
  }
  if ((user.role === "IT_STAFF" || user.role === "ADMINISTRATOR") && path.startsWith("/staff/tickets/")) {
    let ticketNumber = path.slice("/staff/tickets/".length);
    try { ticketNumber = decodeURIComponent(ticketNumber); } catch { /* API returns a safe not-found response. */ }
    return <StaffTicketDetail ticketNumber={ticketNumber} navigate={navigate} currentUserId={user.id} />;
  }
  if (user.role === "ADMINISTRATOR" && path === "/admin/users") return <AdminUserManagement />;
  return <section className="zen-card" aria-labelledby="forbidden-heading"><p className="zen-eyebrow">Authenticated workspace</p><h1 id="forbidden-heading">Access not available</h1><p className="zen-lead">This route is not available for the current role.</p></section>;
}

export default function App() {
  const [path, setPath] = useState(currentPath);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authState, setAuthState] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);
  const authGeneration = useRef(0);
  const navigate = useCallback((nextPath: string) => { navigateTo(nextPath); setPath(new URL(nextPath, window.location.origin).pathname); }, []);

  const handleSessionExpired = useCallback(() => {
    authGeneration.current += 1;
    setSessionExpiredHandler(null);
    setLogoutError(null);
    setUser(null);
    setAuthState("unauthenticated");
    navigate("/login");
  }, [navigate]);

  const handleLogout = useCallback(async () => {
    if (logoutPending) return;
    authGeneration.current += 1;
    setLogoutPending(true);
    setLogoutError(null);
    try {
      await logout();
      setSessionExpiredHandler(null);
      setUser(null);
      setAuthState("unauthenticated");
      navigate("/login");
    } catch (error) {
      setLogoutError(error instanceof ApiClientError ? error.message : "Unable to sign out. Please try again.");
    } finally {
      setLogoutPending(false);
    }
  }, [logoutPending, navigate]);

  useEffect(() => {
    const restoreGeneration = authGeneration.current;
    setSessionExpiredHandler(null);
    try { window.sessionStorage.removeItem(REQUESTER_STORAGE_KEY); } catch { /* no storage identity in Lab 3 */ }
    const onPopState = () => setPath(currentPath());
    window.addEventListener("popstate", onPopState);
    void currentUser({ notifySessionExpiry: false }).then((result) => {
      if (authGeneration.current !== restoreGeneration) return;
      setSessionExpiredHandler(handleSessionExpired); setLogoutError(null); setUser(result.user); setAuthState("authenticated");
    }).catch(() => {
      if (authGeneration.current !== restoreGeneration) return;
      setUser(null); setAuthState("unauthenticated");
    });
    return () => { authGeneration.current += 1; setSessionExpiredHandler(null); window.removeEventListener("popstate", onPopState); };
  }, [handleSessionExpired]);

  useEffect(() => {
    if (!user) { if (isProtectedPath(path) && authState === "unauthenticated") navigate("/login"); return; }
    if (user.mustChangePassword && path !== "/change-password") navigate("/change-password");
    else if (!user.mustChangePassword && (path === "/login" || path === "/change-password" || path === "/select-requester")) navigate(landingPath(user));
  }, [authState, navigate, path, user]);

  if (path === "/" && !user) return <LegacyHealthPage />;
  if (path === "/login" && !user) return <LoginPage onSuccess={(result) => { authGeneration.current += 1; setSessionExpiredHandler(handleSessionExpired); setLogoutError(null); setUser(result.user); setAuthState("authenticated"); navigate(result.user.mustChangePassword ? "/change-password" : landingPath(result.user)); }} />;
  if (user?.mustChangePassword && path === "/change-password") return <ChangePasswordPage user={user} onSuccess={(next) => { setUser(next); navigate(landingPath(next)); }} onLogout={handleLogout} logoutError={logoutError} logoutPending={logoutPending} />;
  if (!user) return <div className="zen-page"><main className="zen-main"><p className="zen-state zen-state-info" role="status">Checking your session...</p></main></div>;
  return <AppShell path={path} user={user} navigate={navigate} onLogout={handleLogout} logoutError={logoutError} logoutPending={logoutPending} />;
}
