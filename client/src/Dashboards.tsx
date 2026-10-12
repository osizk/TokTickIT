import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiClientError,
  type DashboardTicketLink,
  type RequesterDashboard as RequesterDashboardData,
  type StaffDashboard as StaffDashboardData,
  type StaffDashboardTicketLink,
  fetchRequesterDashboard,
  fetchStaffDashboard,
} from "./api.js";

type DashboardProps = { navigate: (path: string) => void };
type LoadState = "loading" | "refreshing" | "success" | "error";

function useDashboard<T>(fetchDashboard: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<unknown>(null);
  const hasResponse = useRef(false);
  const refresh = useCallback(async () => {
    setState(hasResponse.current ? "refreshing" : "loading");
    setError(null);
    try {
      setData(await fetchDashboard());
      hasResponse.current = true;
      setState("success");
    } catch (reason) {
      setData(null);
      hasResponse.current = false;
      setError(reason);
      setState("error");
    }
  }, [fetchDashboard]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { data, state, error, refresh };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(date);
}

function listPath(path: string, filters: Record<string, string>): string {
  const query = new URLSearchParams(filters);
  return `${path}?${query.toString()}`;
}

function DashboardLink({ href, navigate, children, className }: { href: string; navigate: (path: string) => void; children: React.ReactNode; className?: string }) {
  return <a className={className} href={href} onClick={(event) => { event.preventDefault(); navigate(href); }}>{children}</a>;
}

function DashboardMetric({ label, value, href, navigate }: { label: string; value: number; href: string; navigate: (path: string) => void }) {
  return <DashboardLink className="dashboard-metric" href={href} navigate={navigate}><span>{label}</span><strong>{value}</strong></DashboardLink>;
}

function DashboardFrame({ title, roleLabel, lead, navigate, state, error, refresh, children }: {
  title: string; roleLabel: string; lead: string; navigate: (path: string) => void; state: LoadState; error: unknown; refresh: () => void; children: React.ReactNode;
}) {
  const forbidden = error instanceof ApiClientError && error.status === 403;
  const busy = state === "loading" || state === "refreshing";
  return <section className="zen-card dashboard-card" aria-labelledby="dashboard-heading">
    <div className="dashboard-heading"><div><p className="zen-eyebrow">{roleLabel} workspace</p><h1 id="dashboard-heading">{title}</h1><p className="zen-lead">{lead}</p></div><button className="zen-button zen-button-secondary dashboard-refresh" type="button" onClick={refresh} disabled={busy}>{state === "loading" ? "Loading..." : state === "refreshing" ? "Refreshing..." : "Refresh dashboard"}</button></div>
    {state === "loading" && <p className="zen-state zen-state-info" role="status">Loading {title}...</p>}
    {state === "refreshing" && <p className="zen-state zen-state-info" role="status">Refreshing dashboard; showing the last successful response.</p>}
    {state === "error" && <div className="zen-state zen-state-error" role="alert"><p>{forbidden ? "You do not have permission to view this dashboard." : title === "Requester Dashboard" ? "Unable to load your dashboard." : "Unable to load the Staff dashboard."}</p>{!forbidden && <button className="zen-button zen-button-secondary" type="button" onClick={refresh}>Retry</button>}</div>}
    {(state === "success" || state === "refreshing") && children}
  </section>;
}

function RequesterTicketRows({ tickets, navigate }: { tickets: DashboardTicketLink[]; navigate: (path: string) => void }) {
  return <ul className="dashboard-ticket-list">{tickets.map((ticket) => <li key={ticket.id}>
    <DashboardLink className="dashboard-ticket-link" href={`/tickets/${encodeURIComponent(ticket.ticketNumber)}`} navigate={navigate}>
      <strong>{ticket.ticketNumber}</strong><span>{ticket.summary}</span><span className="zen-status-badge">{ticket.status}</span><span className={`zen-priority-badge zen-priority-${ticket.requestedPriority.toLowerCase()}`}>{ticket.requestedPriority}</span><time dateTime={ticket.updatedAt}>{formatDate(ticket.updatedAt)}</time>
    </DashboardLink>
  </li>)}</ul>;
}

export function RequesterDashboard({ navigate }: DashboardProps) {
  const { data, state, error, refresh } = useDashboard<RequesterDashboardData>(fetchRequesterDashboard);
  const recentHref = data ? listPath("/tickets", { updatedSince: data.recentWindow.from, updatedBefore: data.recentWindow.through }) : "/tickets";
  const metrics = data ? [
    { label: "Active Tickets", value: data.metrics.activeTicketCount, href: listPath("/tickets", { statusGroup: "active" }) },
    { label: "Waiting for you", value: data.metrics.waitingForRequesterCount, href: listPath("/tickets", { status: "WAITING_FOR_REQUESTER" }) },
    { label: "Resolved", value: data.metrics.resolvedCount, href: listPath("/tickets", { status: "RESOLVED" }) },
    { label: "Closed", value: data.metrics.closedCount, href: listPath("/tickets", { status: "CLOSED" }) },
  ] : [];
  const empty = data && Object.values(data.metrics).every((count) => count === 0) && data.recentTickets.length === 0 && data.attentionTickets.length === 0;

  return <DashboardFrame title="Requester Dashboard" roleLabel="Requester" lead="A concise view of your Tickets and the updates that need your attention." navigate={navigate} state={state} error={error} refresh={() => void refresh()}>
    {data && <div className="dashboard-content">
      <div className="dashboard-window"><span>Recent activity window: previous 7 days</span><span>Updated {formatDate(data.generatedAt)} (Asia/Bangkok)</span></div>
      <div className="dashboard-metric-grid" aria-label="Requester Ticket metrics">{metrics.map((metric) => <DashboardMetric key={metric.label} {...metric} navigate={navigate} />)}</div>
      {empty && <div className="zen-state zen-state-info dashboard-empty" role="status"><p>You have no Tickets yet.</p><DashboardLink className="zen-button zen-button-primary" href="/tickets/new" navigate={navigate}>Create Ticket</DashboardLink></div>}
      <div className="dashboard-panel-grid">
        <section className="dashboard-panel" aria-labelledby="requester-attention-heading"><div className="dashboard-panel-heading"><h2 id="requester-attention-heading">Tickets needing your response</h2><DashboardLink href="/tickets?status=WAITING_FOR_REQUESTER" navigate={navigate}>View all</DashboardLink></div>
          {data.attentionTickets.length ? <RequesterTicketRows tickets={data.attentionTickets} navigate={navigate} /> : <p className="zen-state zen-state-info" role="status">No Tickets are waiting for your response.</p>}
        </section>
        <section className="dashboard-panel" aria-labelledby="requester-recent-heading"><div className="dashboard-panel-heading"><h2 id="requester-recent-heading">Recent Tickets</h2><DashboardLink href={recentHref} navigate={navigate}>View recent Tickets</DashboardLink></div>
          {data.recentTickets.length ? <RequesterTicketRows tickets={data.recentTickets} navigate={navigate} /> : <p className="zen-state zen-state-info" role="status">No recent Ticket activity in the last 7 days.</p>}
        </section>
      </div>
    </div>}
  </DashboardFrame>;
}

function StaffTicketRows({ tickets, navigate }: { tickets: StaffDashboardTicketLink[]; navigate: (path: string) => void }) {
  return <ul className="dashboard-ticket-list">{tickets.map((ticket) => <li key={ticket.id}>
    <DashboardLink className="dashboard-ticket-link" href={`/staff/tickets/${encodeURIComponent(ticket.ticketNumber)}`} navigate={navigate}>
      <strong>{ticket.ticketNumber}</strong><span>{ticket.summary}</span><span>{ticket.requester.name}</span><span className="zen-status-badge">{ticket.status}</span><span className={`zen-priority-badge zen-priority-${ticket.itPriority.toLowerCase()}`}>IT Priority: {ticket.itPriority}</span><span>{ticket.ticketOwner?.name ?? "Unassigned"}</span><time dateTime={ticket.updatedAt}>{formatDate(ticket.updatedAt)}</time>
    </DashboardLink>
  </li>)}</ul>;
}

export function StaffDashboard({ navigate }: DashboardProps) {
  const { data, state, error, refresh } = useDashboard<StaffDashboardData>(fetchStaffDashboard);
  const recentHref = data ? listPath("/staff/tickets", { updatedSince: data.recentWindow.from, updatedBefore: data.recentWindow.through }) : "/staff/tickets";
  const metrics = data ? [
    { label: "Unassigned active Tickets", value: data.metrics.unassignedActiveTicketCount, href: listPath("/staff/tickets", { statusGroup: "active", owner: "unassigned" }) },
    { label: "My owned active Tickets", value: data.metrics.myOwnedActiveTicketCount, href: listPath("/staff/tickets", { statusGroup: "active", owner: "me" }) },
    { label: "Urgent active Tickets", value: data.metrics.urgentActiveTicketCount, href: listPath("/staff/tickets", { statusGroup: "active", itPriority: "URGENT" }) },
    { label: "Tickets with my active Actions", value: data.metrics.ticketsWithMyActiveActionsCount, href: listPath("/staff/tickets", { statusGroup: "active", actionAssignee: "me" }) },
  ] : [];
  const statuses = data ? Object.entries(data.statusCounts) as Array<[keyof StaffDashboardData["statusCounts"], number]> : [];
  const priorities = data ? Object.entries(data.itPriorityCounts) as Array<[keyof StaffDashboardData["itPriorityCounts"], number]> : [];
  const anyData = data && Object.values(data.metrics).some((count) => count > 0);

  return <DashboardFrame title="Staff Dashboard" roleLabel="Operations" lead="Operational work at a glance, scoped to your current Staff session." navigate={navigate} state={state} error={error} refresh={() => void refresh()}>
    {data && <div className="dashboard-content">
      <div className="dashboard-window"><span>Active Tickets: NEW, OPEN, IN_PROGRESS, WAITING_FOR_REQUESTER, REOPENED</span><span>Recent activity: previous 7 days · Updated {formatDate(data.generatedAt)} (Asia/Bangkok)</span></div>
      <div className="dashboard-metric-grid" aria-label="Staff Ticket metrics">{metrics.map((metric) => <DashboardMetric key={metric.label} {...metric} navigate={navigate} />)}</div>
      <div className="dashboard-panel-grid dashboard-panel-grid-wide">
        <section className="dashboard-panel" aria-labelledby="staff-status-heading"><h2 id="staff-status-heading">Tickets by status</h2><ul className="dashboard-summary-list">{statuses.map(([status, count]) => <li key={status}><DashboardLink href={listPath("/staff/tickets", { status })} navigate={navigate}><span className="zen-status-badge">{status}</span><strong>{count}</strong></DashboardLink></li>)}</ul></section>
        <section className="dashboard-panel" aria-labelledby="staff-priority-heading"><h2 id="staff-priority-heading">Active Tickets by IT Priority</h2><ul className="dashboard-summary-list">{priorities.map(([priority, count]) => <li key={priority}><DashboardLink href={listPath("/staff/tickets", { statusGroup: "active", itPriority: priority })} navigate={navigate}><span className={`zen-priority-badge zen-priority-${priority.toLowerCase()}`}>{priority}</span><strong>{count}</strong></DashboardLink></li>)}</ul></section>
      </div>
      <div className="dashboard-panel-grid">
        <section className="dashboard-panel" aria-labelledby="staff-actions-heading"><div className="dashboard-panel-heading"><h2 id="staff-actions-heading">Actions assigned to you</h2><DashboardLink href={listPath("/staff/tickets", { statusGroup: "active", actionAssignee: "me" })} navigate={navigate}>View matching Tickets</DashboardLink></div>
          {data.myActions.length ? <ul className="dashboard-ticket-list">{data.myActions.map((action) => <li key={action.id}><DashboardLink className="dashboard-action-link" href={`/staff/tickets/${encodeURIComponent(action.ticketNumber)}#action-heading-${action.id}`} navigate={navigate}><strong>{action.description}</strong><span>{action.ticketNumber} · {action.ticketSummary}</span><span className="zen-status-badge">{action.status}</span><time dateTime={action.updatedAt}>{formatDate(action.updatedAt)}</time></DashboardLink></li>)}</ul> : <p className="zen-state zen-state-info" role="status">No active Actions are assigned to you.</p>}
        </section>
        <section className="dashboard-panel" aria-labelledby="staff-recent-heading"><div className="dashboard-panel-heading"><h2 id="staff-recent-heading">Recent Tickets</h2><DashboardLink href={recentHref} navigate={navigate}>View recent Tickets</DashboardLink></div>
          {data.recentTickets.length ? <StaffTicketRows tickets={data.recentTickets} navigate={navigate} /> : <p className="zen-state zen-state-info" role="status">No Ticket activity in the last 7 days.</p>}
        </section>
        <section className="dashboard-panel" aria-labelledby="staff-urgent-heading"><div className="dashboard-panel-heading"><h2 id="staff-urgent-heading">Urgent active Tickets</h2><DashboardLink href={listPath("/staff/tickets", { statusGroup: "active", itPriority: "URGENT" })} navigate={navigate}>View all</DashboardLink></div>
          {data.urgentTickets.length ? <StaffTicketRows tickets={data.urgentTickets} navigate={navigate} /> : <p className="zen-state zen-state-info" role="status">No urgent active Tickets.</p>}
        </section>
      </div>
      {!anyData && <p className="zen-state zen-state-info dashboard-empty" role="status">There is no active Staff work right now.</p>}
    </div>}
  </DashboardFrame>;
}
