import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Category,
  Requester,
  checkSystem,
  fetchRequesters,
} from "./api.js";
import CreateTicketPage from "./CreateTicket.js";
import MyTickets from "./MyTickets.js";
import "./styles.css";

type UiState = "idle" | "loading" | "success" | "error";
type RequesterLoadState = "loading" | "success" | "error";

export const REQUESTER_STORAGE_KEY = "toktickit.requesterId";

const REQUESTER_LOAD_ERROR = "Unable to load Development Requesters.";

function currentPath(): string {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

function isLab2Route(path: string): boolean {
  return path === "/select-requester" || path === "/tickets" || path.startsWith("/tickets/");
}

function isProtectedRoute(path: string): boolean {
  return path === "/tickets" || path === "/tickets/new" || /^\/tickets\/[^/]+$/.test(path);
}

function parseRequesterId(rawValue: string): number | null {
  if (!/^\d+$/.test(rawValue)) {
    return null;
  }

  const requesterId = Number(rawValue);
  return Number.isSafeInteger(requesterId) && requesterId > 0 ? requesterId : null;
}

function readStoredRequesterId(): number | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(REQUESTER_STORAGE_KEY);
    if (rawValue === null) {
      return null;
    }

    const requesterId = parseRequesterId(rawValue);
    if (requesterId === null) {
      window.sessionStorage.removeItem(REQUESTER_STORAGE_KEY);
    }
    return requesterId;
  } catch {
    return null;
  }
}

function clearStoredRequesterId() {
  try {
    window.sessionStorage.removeItem(REQUESTER_STORAGE_KEY);
  } catch {
    // A storage failure is treated as having no selected requester.
  }
}

function storeRequesterId(requesterId: number) {
  window.sessionStorage.setItem(REQUESTER_STORAGE_KEY, String(requesterId));
}

function LegacyHealthPage() {
  const [state, setState] = useState<UiState>("idle");
  const [service, setService] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCheck() {
    setState("loading");
    setService(null);
    setCategories([]);
    setErrorMessage(null);

    try {
      const system = await checkSystem();
      setService(system.service);
      setCategories(system.categories);
      setState("success");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to connect to TokTickIT API.",
      );
      setState("error");
    }
  }

  return (
    <div className="container py-5" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-4">
        TokTickIT <span className="text-success">IT Service Desk</span>
      </h1>

      <button
        className="btn btn-success"
        onClick={handleCheck}
        disabled={state === "loading"}
      >
        {state === "loading" ? "Loading..." : "Check System"}
      </button>

      {state === "loading" && (
        <p className="mt-4" role="status">
          Loading...
        </p>
      )}

      {state === "success" && (
        <div className="mt-4" role="status">
          <p>System Status: Online</p>
          <p>Service: {service}</p>
          <h2 className="h5 mt-4">Supported Request Categories</h2>
          <ul aria-label="Supported Request Categories">
            {categories.map((category) => (
              <li key={category.id}>{category.name}</li>
            ))}
          </ul>
        </div>
      )}

      {state === "error" && (
        <div className="alert alert-danger mt-4" role="alert">
          <p className="mb-1">System Status: Offline</p>
          <p className="mb-0">{errorMessage}</p>
        </div>
      )}
    </div>
  );
}

interface NavigationProps {
  navigate: (path: string) => void;
}

function RequesterSelection({
  requesters,
  loadState,
  value,
  onChange,
  onContinue,
  onRetry,
}: {
  requesters: Requester[];
  loadState: RequesterLoadState;
  value: string;
  onChange: (value: string) => void;
  onContinue: () => void;
  onRetry: () => void;
}) {
  const hasSelection = value.length > 0;
  const selectDisabled = loadState !== "success" || requesters.length === 0;

  return (
    <div className="zen-page">
      <header className="zen-public-header">
        <a className="zen-brand" href="/" aria-label="TokTickIT home">
          <span className="zen-brand-mark" aria-hidden="true">
            T
          </span>
          <span>
            <strong>TokTickIT</strong>
            <small>IT Service Desk</small>
          </span>
        </a>
      </header>

      <main className="zen-main" id="main-content">
        <section className="zen-card zen-selection-card" aria-labelledby="requester-heading">
          <p className="zen-eyebrow">Lab 2 testing context</p>
          <h1 id="requester-heading">Select Development Requester</h1>
          <p className="zen-lead">
            Choose the Requester context for this browser tab. This is a testing mechanism,
            not authentication.
          </p>

          <div className="zen-field">
            <label htmlFor="development-requester">
              Development Requester <span className="zen-required" aria-hidden="true">*</span>
            </label>
            <select
              id="development-requester"
              name="requesterId"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              disabled={selectDisabled}
            >
              <option value="" disabled>
                {loadState === "loading" ? "Loading Requesters..." : "Choose a Requester"}
              </option>
              {requesters.map((requester) => (
                <option key={requester.id} value={requester.id}>
                  {requester.name} ({requester.email})
                </option>
              ))}
            </select>
          </div>

          {loadState === "loading" && (
            <p className="zen-state zen-state-info" role="status" aria-live="polite">
              Loading Development Requesters...
            </p>
          )}

          {loadState === "success" && requesters.length === 0 && (
            <p className="zen-state zen-state-info" role="status">
              No active Development Requesters are available.
            </p>
          )}

          {loadState === "error" && (
            <div className="zen-state zen-state-error" role="alert" aria-label="Requester loading error">
              <p>{REQUESTER_LOAD_ERROR}</p>
              <button className="zen-button zen-button-secondary" type="button" onClick={onRetry}>
                Retry
              </button>
            </div>
          )}

          <div className="zen-actions">
            <button
              className="zen-button zen-button-primary"
              type="button"
              onClick={onContinue}
              disabled={!hasSelection || selectDisabled}
            >
              Continue
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function AppShell({
  path,
  requester,
  navigate,
  onChangeRequester,
}: NavigationProps & {
  path: string;
  requester: Requester;
  onChangeRequester: () => void;
}) {
  const goTo = (event: React.MouseEvent<HTMLAnchorElement>, nextPath: string) => {
    event.preventDefault();
    navigate(nextPath);
  };

  return (
    <div className="zen-page">
      <header className="zen-app-header">
        <div className="zen-header-inner">
          <a className="zen-brand" href="/tickets" onClick={(event) => goTo(event, "/tickets")}>
            <span className="zen-brand-mark" aria-hidden="true">T</span>
            <span>
              <strong>TokTickIT</strong>
              <small>IT Service Desk</small>
            </span>
          </a>

          <nav className="zen-nav" aria-label="Primary navigation">
            <a
              href="/tickets"
              className={path === "/tickets" ? "is-active" : undefined}
              aria-current={path === "/tickets" ? "page" : undefined}
              onClick={(event) => goTo(event, "/tickets")}
            >
              My Tickets
            </a>
            <a
              href="/tickets/new"
              className={path === "/tickets/new" ? "is-active" : undefined}
              aria-current={path === "/tickets/new" ? "page" : undefined}
              onClick={(event) => goTo(event, "/tickets/new")}
            >
              Create Ticket
            </a>
          </nav>

          <div className="zen-identity" aria-label="Current Development Requester">
            <span className="zen-identity-label">Development Requester</span>
            <strong>{requester.name}</strong>
            <button className="zen-button zen-button-link" type="button" onClick={onChangeRequester}>
              Change Requester
            </button>
          </div>
        </div>
      </header>

      <main className="zen-main" id="main-content">
        <RoutePlaceholder path={path} requester={requester} navigate={navigate} />
      </main>
    </div>
  );
}

function RoutePlaceholder({
  path,
  requester,
  navigate,
}: {
  path: string;
  requester: Requester;
  navigate: (path: string) => void;
}) {
  if (path === "/tickets/new") {
    return <CreateTicketPage requester={requester} navigate={navigate} />;
  }

  if (path === "/tickets") {
    return <MyTickets requester={requester} navigate={navigate} />;
  }

  if (path.startsWith("/tickets/") && path !== "/tickets/new") {
    return (
      <section className="zen-card" aria-labelledby="ticket-detail-heading">
        <p className="zen-eyebrow">Requester workspace</p>
        <h1 id="ticket-detail-heading">Ticket Detail</h1>
        <p className="zen-lead">Ticket details will be added in the approved detail Issue.</p>
      </section>
    );
  }

  return (
    <section className="zen-card" aria-labelledby="my-tickets-heading">
      <p className="zen-eyebrow">Requester workspace</p>
      <h1 id="my-tickets-heading">My Tickets</h1>
      <p className="zen-lead">Your requester-owned tickets will appear here.</p>
    </section>
  );
}

function Lab2App({ path, navigate }: { path: string; navigate: (path: string) => void }) {
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [loadState, setLoadState] = useState<RequesterLoadState>("loading");
  const [selectedRequesterId, setSelectedRequesterId] = useState<number | null>(() =>
    readStoredRequesterId(),
  );
  const [selectionValue, setSelectionValue] = useState(() => {
    const storedRequesterId = readStoredRequesterId();
    return storedRequesterId === null ? "" : String(storedRequesterId);
  });
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");

    void fetchRequesters()
      .then((loadedRequesters) => {
        if (cancelled) {
          return;
        }
        setRequesters(loadedRequesters);
        setLoadState("success");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setRequesters([]);
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  useEffect(() => {
    if (isProtectedRoute(path) && readStoredRequesterId() === null) {
      navigate("/select-requester");
    }
  }, [navigate, path]);

  useEffect(() => {
    if (loadState !== "success") {
      return;
    }

    const storedRequesterId = readStoredRequesterId();
    const storedRequester = requesters.find((requester) => requester.id === storedRequesterId);

    if (storedRequester) {
      setSelectedRequesterId(storedRequester.id);
      setSelectionValue(String(storedRequester.id));
      if (path === "/select-requester") {
        navigate("/tickets");
      }
      return;
    }

    if (storedRequesterId !== null) {
      clearStoredRequesterId();
    }
    setSelectedRequesterId(null);
    setSelectionValue("");
    if (isProtectedRoute(path)) {
      navigate("/select-requester");
    }
  }, [loadState, navigate, path, requesters]);

  const selectedRequester = useMemo(
    () => requesters.find((requester) => requester.id === selectedRequesterId) ?? null,
    [requesters, selectedRequesterId],
  );

  function handleContinue() {
    const requesterId = parseRequesterId(selectionValue);
    if (requesterId === null) {
      return;
    }

    const requester = requesters.find((candidate) => candidate.id === requesterId);
    if (!requester) {
      return;
    }

    storeRequesterId(requester.id);
    setSelectedRequesterId(requester.id);
    navigate("/tickets");
  }

  function handleChangeRequester() {
    clearStoredRequesterId();
    setSelectedRequesterId(null);
    setSelectionValue("");
    setRequesters([]);
    setLoadState("loading");
    setRetryToken((token) => token + 1);
    window.dispatchEvent(new Event("toktickit:requester-change"));
    navigate("/select-requester");
  }

  if (path === "/select-requester" || loadState !== "success" || selectedRequester === null) {
    return (
      <RequesterSelection
        requesters={requesters}
        loadState={loadState}
        value={selectionValue}
        onChange={setSelectionValue}
        onContinue={handleContinue}
        onRetry={() => setRetryToken((token) => token + 1)}
      />
    );
  }

  return (
    <AppShell
      path={path}
      requester={selectedRequester}
      navigate={navigate}
      onChangeRequester={handleChangeRequester}
    />
  );
}

export default function App() {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const handlePopState = () => setPath(currentPath());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((nextPath: string) => {
    const nextUrl = new URL(nextPath, window.location.origin);
    const currentUrl = new URL(window.location.href);
    const currentLocation = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
    const nextLocation = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    if (currentLocation !== nextLocation) {
      window.history.pushState({}, "", nextPath);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
    // Keep route matching based on the pathname while allowing pages such as
    // My Tickets to persist their controls in the URL query string.
    setPath(nextUrl.pathname);
  }, []);

  if (!isLab2Route(path)) {
    return <LegacyHealthPage />;
  }

  return <Lab2App path={path} navigate={navigate} />;
}
