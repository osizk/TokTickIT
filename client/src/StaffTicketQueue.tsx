import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ApiClientError,
  Category,
  RelatedSystem,
  StaffAssignee,
  StaffTicket,
  StaffTicketOwner,
  StaffTicketQuery,
  StaffTicketResponse,
  StaffTicketSort,
  TicketListOrder,
  TicketListPageSize,
  TicketPriority,
  TicketStatus,
  fetchCategories,
  fetchRelatedSystems,
  fetchStaffAssignees,
  fetchStaffTickets,
} from "./api.js";

export const DEFAULT_STAFF_QUEUE_QUERY: StaffTicketQuery = {
  sort: "updatedAt",
  order: "desc",
  page: 1,
  pageSize: 10,
};

const PRIORITY_OPTIONS: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const STATUS_OPTIONS: TicketStatus[] = [
  "NEW",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_REQUESTER",
  "RESOLVED",
  "CLOSED",
  "REOPENED",
  "CANCELLED",
];
const SORT_OPTIONS: Array<{ value: StaffTicketSort; label: string }> = [
  { value: "updatedAt", label: "Updated date" },
  { value: "createdAt", label: "Created date" },
  { value: "ticketNumber", label: "Ticket Number" },
  { value: "summary", label: "Summary" },
  { value: "requestedPriority", label: "Requested Priority" },
  { value: "itPriority", label: "IT Priority" },
  { value: "status", label: "Status" },
  { value: "owner", label: "Assignee" },
];
const PAGE_SIZE_OPTIONS: TicketListPageSize[] = [10, 25, 50];

interface StaffTicketQueueProps {
  navigate: (path: string) => void;
}

function positiveInteger(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parsePageSize(value: string | null): TicketListPageSize | undefined {
  if (value === "10" || value === "25" || value === "50") return Number(value) as TicketListPageSize;
  return undefined;
}

function parseUrlQuery(search: string): StaffTicketQuery {
  const params = new URLSearchParams(search);
  const sortValue = params.get("sort");
  const sort = SORT_OPTIONS.some((option) => option.value === sortValue)
    ? sortValue as StaffTicketSort
    : DEFAULT_STAFF_QUEUE_QUERY.sort;
  const order: TicketListOrder = params.get("order") === "asc" ? "asc" : "desc";
  const page = positiveInteger(params.get("page")) ?? 1;
  const pageSize = parsePageSize(params.get("pageSize")) ?? 10;
  const requestedPriority = PRIORITY_OPTIONS.includes(params.get("requestedPriority") as TicketPriority)
    ? params.get("requestedPriority") as TicketPriority
    : undefined;
  const itPriority = PRIORITY_OPTIONS.includes(params.get("itPriority") as TicketPriority)
    ? params.get("itPriority") as TicketPriority
    : undefined;
  const status = STATUS_OPTIONS.includes(params.get("status") as TicketStatus)
    ? params.get("status") as TicketStatus
    : undefined;
  const rawOwner = params.get("owner");
  const owner: StaffTicketOwner | undefined = rawOwner === "me" || rawOwner === "unassigned"
    ? rawOwner
    : positiveInteger(rawOwner);
  const searchText = params.get("search")?.trim();
  const categoryId = positiveInteger(params.get("categoryId"));
  const relatedSystemId = positiveInteger(params.get("relatedSystemId"));
  return {
    ...(searchText ? { search: searchText.slice(0, 100) } : {}),
    ...(categoryId === undefined ? {} : { categoryId }),
    ...(relatedSystemId === undefined ? {} : { relatedSystemId }),
    ...(requestedPriority ? { requestedPriority } : {}),
    ...(itPriority ? { itPriority } : {}),
    ...(status ? { status } : {}),
    ...(owner === undefined ? {} : { owner }),
    sort,
    order,
    page,
    pageSize,
  };
}

function toSearchParams(query: StaffTicketQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.categoryId !== undefined) params.set("categoryId", String(query.categoryId));
  if (query.relatedSystemId !== undefined) params.set("relatedSystemId", String(query.relatedSystemId));
  if (query.requestedPriority) params.set("requestedPriority", query.requestedPriority);
  if (query.itPriority) params.set("itPriority", query.itPriority);
  if (query.status) params.set("status", query.status);
  if (query.owner !== undefined) params.set("owner", String(query.owner));
  params.set("sort", query.sort);
  params.set("order", query.order);
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  return `?${params.toString()}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function isFiltered(query: StaffTicketQuery): boolean {
  return Boolean(
    query.search || query.categoryId !== undefined || query.relatedSystemId !== undefined ||
    query.requestedPriority || query.itPriority || query.status || query.owner !== undefined,
  );
}

function PriorityBadge({ priority, label }: { priority: TicketPriority; label?: string }) {
  return <span className={`zen-priority-badge zen-priority-${priority.toLowerCase()}`}>{label ? `${label}: ` : ""}{priority}</span>;
}

function TicketLink({ ticketNumber, navigate }: { ticketNumber: string; navigate: (path: string) => void }) {
  const path = `/staff/tickets/${encodeURIComponent(ticketNumber)}`;
  return <a href={path} onClick={(event) => { event.preventDefault(); navigate(path); }}>{ticketNumber}</a>;
}

function TicketTable({ result, navigate }: { result: StaffTicketResponse; navigate: (path: string) => void }) {
  return (
    <div className="zen-ticket-table-wrap">
      <table className="zen-ticket-table zen-staff-table" aria-label="Staff Ticket Queue">
        <caption className="sr-only">Tickets available to IT Staff and Administrators</caption>
        <thead><tr>
          <th scope="col">Ticket Number</th><th scope="col">Summary</th><th scope="col">Requester</th>
          <th scope="col">Status</th><th scope="col">IT Priority</th><th scope="col">Requested Priority</th>
          <th scope="col">Assignee</th><th scope="col">Updated</th><th scope="col">Open</th>
        </tr></thead>
        <tbody>{result.items.map((ticket) => (
          <tr key={ticket.id}>
            <td><TicketLink ticketNumber={ticket.ticketNumber} navigate={navigate} /></td>
            <td><strong>{ticket.summary}</strong><small className="zen-table-secondary">{ticket.category.name} / {ticket.relatedSystem.name}</small></td>
            <td>{ticket.requester.name}<small className="zen-table-secondary">{ticket.requester.email}</small></td>
            <td><span className="zen-status-badge">{ticket.status}</span></td>
            <td><PriorityBadge priority={ticket.itPriority} /></td>
            <td><PriorityBadge priority={ticket.requestedPriority} /></td>
            <td>{ticket.ticketOwner?.name ?? "Unassigned"}</td>
            <td>{formatDate(ticket.updatedAt)}</td>
            <td><a className="zen-button zen-button-secondary zen-card-open" href={`/staff/tickets/${encodeURIComponent(ticket.ticketNumber)}`} onClick={(event) => { event.preventDefault(); navigate(`/staff/tickets/${encodeURIComponent(ticket.ticketNumber)}`); }}>Open</a></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function TicketCards({ result, navigate }: { result: StaffTicketResponse; navigate: (path: string) => void }) {
  return (
    <section className="zen-ticket-cards zen-staff-ticket-cards" aria-label="Mobile staff ticket cards">
      {result.items.map((ticket: StaffTicket) => (
        <article className="zen-ticket-card-item" key={ticket.id}>
          <div className="zen-ticket-card-topline"><TicketLink ticketNumber={ticket.ticketNumber} navigate={navigate} /><span className="zen-status-badge">{ticket.status}</span></div>
          <h2>{ticket.summary}</h2>
          <p className="zen-table-secondary">{ticket.category.name} / {ticket.relatedSystem.name}</p>
          <dl>
            <div><dt>Requester</dt><dd>{ticket.requester.name}</dd></div>
            <div><dt>IT Priority</dt><dd><PriorityBadge priority={ticket.itPriority} /></dd></div>
            <div><dt>Requested Priority</dt><dd><PriorityBadge priority={ticket.requestedPriority} /></dd></div>
            <div><dt>Assignee</dt><dd>{ticket.ticketOwner?.name ?? "Unassigned"}</dd></div>
            <div><dt>Updated</dt><dd>{formatDate(ticket.updatedAt)}</dd></div>
          </dl>
          <a className="zen-button zen-button-secondary zen-card-open" href={`/staff/tickets/${encodeURIComponent(ticket.ticketNumber)}`} onClick={(event) => { event.preventDefault(); navigate(`/staff/tickets/${encodeURIComponent(ticket.ticketNumber)}`); }}>Open Ticket</a>
        </article>
      ))}
    </section>
  );
}

export default function StaffTicketQueue({ navigate }: StaffTicketQueueProps) {
  const [query, setQuery] = useState<StaffTicketQuery>(() => parseUrlQuery(typeof window === "undefined" ? "" : window.location.search));
  const [draftSearch, setDraftSearch] = useState(query.search ?? "");
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [assignees, setAssignees] = useState<StaffAssignee[]>([]);
  const [result, setResult] = useState<StaffTicketResponse | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "success" | "error">("loading");
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const queryKey = useMemo(() => JSON.stringify(query), [query]);

  useEffect(() => {
    const onPopState = () => {
      const next = parseUrlQuery(window.location.search);
      setQuery(next);
      setDraftSearch(next.search ?? "");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    setLoadError(null);
    void Promise.all([fetchCategories(), fetchRelatedSystems(), fetchStaffAssignees(), fetchStaffTickets(query)])
      .then(([loadedCategories, loadedSystems, loadedAssignees, loadedTickets]) => {
        if (cancelled) return;
        setCategories(loadedCategories);
        setRelatedSystems(loadedSystems);
        setAssignees(loadedAssignees);
        setResult(loadedTickets);
        setLoadState("success");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error);
        setLoadState("error");
      });
    return () => { cancelled = true; };
  }, [query, queryKey, reloadToken]);

  function applyQuery(nextQuery: StaffTicketQuery) {
    const changed = JSON.stringify(query) !== JSON.stringify(nextQuery);
    setQuery(nextQuery);
    setDraftSearch(nextQuery.search ?? "");
    navigate(`/staff/tickets${toSearchParams(nextQuery)}`);
    if (!changed) setReloadToken((token) => token + 1);
  }

  function updateQuery(changes: Partial<StaffTicketQuery>) {
    applyQuery({ ...query, ...changes });
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSearch = draftSearch.trim().slice(0, 100);
    applyQuery({ ...query, ...(nextSearch ? { search: nextSearch } : { search: undefined }), page: 1 });
  }

  function handleNumericSelect(event: ChangeEvent<HTMLSelectElement>, key: "categoryId" | "relatedSystemId") {
    const value = positiveInteger(event.target.value);
    updateQuery({ [key]: value, page: 1 } as Partial<StaffTicketQuery>);
  }

  function clearFilters() {
    applyQuery({ ...DEFAULT_STAFF_QUEUE_QUERY });
  }

  if (loadState === "loading") {
    return <section className="zen-card zen-list-card zen-staff-queue-card" aria-labelledby="staff-queue-heading"><p className="zen-eyebrow">Operations workspace</p><h1 id="staff-queue-heading">Ticket Queue</h1><p className="zen-state zen-state-info" role="status">Loading Ticket Queue...</p></section>;
  }

  if (loadState === "error") {
    const forbidden = loadError instanceof ApiClientError && loadError.status === 403;
    return <section className="zen-card zen-list-card zen-staff-queue-card" aria-labelledby="staff-queue-heading"><p className="zen-eyebrow">Operations workspace</p><h1 id="staff-queue-heading">Ticket Queue</h1><div className="zen-state zen-state-error" role="alert" aria-label="Ticket queue loading error"><p>{forbidden ? "You do not have permission to view the Ticket Queue." : "Unable to load Ticket Queue."}</p>{!forbidden && <button className="zen-button zen-button-secondary" type="button" onClick={() => setReloadToken((token) => token + 1)}>Retry</button>}</div></section>;
  }

  if (!result) return null;
  const filtered = isFiltered(query);
  return (
    <section className="zen-card zen-list-card zen-staff-queue-card" aria-labelledby="staff-queue-heading">
      <div className="zen-list-heading"><div><p className="zen-eyebrow">Operations workspace</p><h1 id="staff-queue-heading">Ticket Queue</h1><p className="zen-lead">Tickets available to IT Staff and Administrators.</p></div></div>
      <form className="zen-list-toolbar" onSubmit={handleSearchSubmit} aria-label="Ticket Queue filters">
        <div className="zen-search-row"><div className="zen-search-field zen-field"><label htmlFor="staff-queue-search">Search Tickets</label><input id="staff-queue-search" className="zen-input" type="search" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} placeholder="Ticket Number, summary, requester" maxLength={100} /></div><button className="zen-button zen-button-primary" type="submit">Apply Filters</button><button className="zen-button zen-button-secondary" type="button" onClick={clearFilters}>Clear Filters</button></div>
        <div className="zen-filter-grid zen-staff-filter-grid">
          <div className="zen-field"><label htmlFor="staff-category">Category</label><select id="staff-category" value={query.categoryId ?? ""} onChange={(event) => handleNumericSelect(event, "categoryId")}><option value="">All Categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
          <div className="zen-field"><label htmlFor="staff-related-system">Related System</label><select id="staff-related-system" value={query.relatedSystemId ?? ""} onChange={(event) => handleNumericSelect(event, "relatedSystemId")}><option value="">All Related Systems</option>{relatedSystems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}</select></div>
          <div className="zen-field"><label htmlFor="staff-requested-priority">Requested Priority</label><select id="staff-requested-priority" value={query.requestedPriority ?? ""} onChange={(event) => updateQuery({ requestedPriority: event.target.value ? event.target.value as TicketPriority : undefined, page: 1 })}><option value="">All Requested Priorities</option>{PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></div>
          <div className="zen-field"><label htmlFor="staff-it-priority">IT Priority</label><select id="staff-it-priority" value={query.itPriority ?? ""} onChange={(event) => updateQuery({ itPriority: event.target.value ? event.target.value as TicketPriority : undefined, page: 1 })}><option value="">All IT Priorities</option>{PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></div>
          <div className="zen-field"><label htmlFor="staff-status">Status</label><select id="staff-status" value={query.status ?? ""} onChange={(event) => updateQuery({ status: event.target.value ? event.target.value as TicketStatus : undefined, page: 1 })}><option value="">All Statuses</option>{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
          <div className="zen-field"><label htmlFor="staff-assignee">Assignee</label><select id="staff-assignee" value={query.owner === undefined ? "" : String(query.owner)} onChange={(event) => updateQuery({ owner: event.target.value ? event.target.value === "me" || event.target.value === "unassigned" ? event.target.value : Number(event.target.value) : undefined, page: 1 })}><option value="">All Assignees</option><option value="unassigned">Unassigned</option><option value="me">Me</option>{assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}</select>{assignees.length === 0 && <span className="zen-help">No active assignees are available.</span>}</div>
          <div className="zen-field"><label htmlFor="staff-sort">Sort by</label><select id="staff-sort" value={query.sort} onChange={(event) => updateQuery({ sort: event.target.value as StaffTicketSort, page: 1 })}>{SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          <div className="zen-field"><label htmlFor="staff-order">Order</label><select id="staff-order" value={query.order} onChange={(event) => updateQuery({ order: event.target.value as TicketListOrder, page: 1 })}><option value="desc">Descending</option><option value="asc">Ascending</option></select></div>
          <div className="zen-field"><label htmlFor="staff-page-size">Page size</label><select id="staff-page-size" value={query.pageSize} onChange={(event) => updateQuery({ pageSize: Number(event.target.value) as TicketListPageSize, page: 1 })}>{PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} per page</option>)}</select></div>
        </div>
      </form>
      <div className="zen-list-summary"><span>{result.pagination.totalItems} {result.pagination.totalItems === 1 ? "Ticket" : "Tickets"}</span><span>Page {result.pagination.page} of {Math.max(1, result.pagination.totalPages)}</span></div>
      {result.items.length === 0 ? <div className="zen-state zen-state-info" role="status"><p>{filtered ? "No Tickets match your filters." : "There are no Tickets in the staff queue yet."}</p>{filtered && <button className="zen-button zen-button-secondary" type="button" onClick={clearFilters}>Clear Filters</button>}</div> : <><TicketTable result={result} navigate={navigate} /><TicketCards result={result} navigate={navigate} /></>}
      <nav className="zen-pagination" aria-label="Ticket Queue pagination"><button className="zen-button zen-button-secondary" type="button" disabled={!result.pagination.hasPreviousPage} onClick={() => updateQuery({ page: query.page - 1 })}>Previous</button><span aria-live="polite">Page {result.pagination.page} of {Math.max(1, result.pagination.totalPages)}</span><button className="zen-button zen-button-secondary" type="button" disabled={!result.pagination.hasNextPage} onClick={() => updateQuery({ page: query.page + 1 })}>Next</button></nav>
    </section>
  );
}
