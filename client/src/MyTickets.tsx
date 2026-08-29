import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Category,
  RelatedSystem,
  Requester,
  TicketListOrder,
  TicketListPageSize,
  TicketListQuery,
  TicketListResponse,
  TicketListSort,
  fetchCategories,
  fetchRelatedSystems,
  fetchTickets,
} from "./api.js";

export const DEFAULT_TICKET_LIST_QUERY: TicketListQuery = {
  sort: "updatedAt",
  order: "desc",
  page: 1,
  pageSize: 10,
};

const SORT_OPTIONS: Array<{ value: TicketListSort; label: string }> = [
  { value: "updatedAt", label: "Updated date" },
  { value: "createdAt", label: "Created date" },
  { value: "ticketNumber", label: "Ticket Number" },
  { value: "summary", label: "Summary" },
  { value: "requestedPriority", label: "Requested Priority" },
];

const PAGE_SIZE_OPTIONS: TicketListPageSize[] = [10, 25, 50];
const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

interface MyTicketsProps {
  requester: Requester;
  navigate: (path: string) => void;
}

function positiveInteger(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parsePageSize(value: string | null): TicketListPageSize | undefined {
  if (value === "10" || value === "25" || value === "50") {
    return Number(value) as TicketListPageSize;
  }
  return undefined;
}

function parseUrlQuery(search: string): TicketListQuery {
  const params = new URLSearchParams(search);
  const sort = SORT_OPTIONS.some((option) => option.value === params.get("sort"))
    ? (params.get("sort") as TicketListSort)
    : DEFAULT_TICKET_LIST_QUERY.sort;
  const order: TicketListOrder = params.get("order") === "asc" ? "asc" : "desc";
  const page = positiveInteger(params.get("page")) ?? DEFAULT_TICKET_LIST_QUERY.page;
  const pageSize = parsePageSize(params.get("pageSize")) ?? DEFAULT_TICKET_LIST_QUERY.pageSize;
  const priority = PRIORITY_OPTIONS.includes(params.get("priority") as (typeof PRIORITY_OPTIONS)[number])
    ? (params.get("priority") as (typeof PRIORITY_OPTIONS)[number])
    : undefined;
  const status = params.get("status") === "NEW" ? "NEW" : undefined;
  const searchText = params.get("search")?.trim();

  return {
    ...(searchText ? { search: searchText.slice(0, 100) } : {}),
    ...(positiveInteger(params.get("categoryId")) === undefined
      ? {}
      : { categoryId: positiveInteger(params.get("categoryId")) }),
    ...(positiveInteger(params.get("relatedSystemId")) === undefined
      ? {}
      : { relatedSystemId: positiveInteger(params.get("relatedSystemId")) }),
    ...(priority ? { priority } : {}),
    ...(status ? { status } : {}),
    sort,
    order,
    page,
    pageSize,
  };
}

function toSearchParams(query: TicketListQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.categoryId !== undefined) params.set("categoryId", String(query.categoryId));
  if (query.relatedSystemId !== undefined) params.set("relatedSystemId", String(query.relatedSystemId));
  if (query.priority) params.set("priority", query.priority);
  if (query.status) params.set("status", query.status);
  params.set("sort", query.sort);
  params.set("order", query.order);
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  return `?${params.toString()}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isFiltered(query: TicketListQuery): boolean {
  return Boolean(
    query.search ||
      query.categoryId !== undefined ||
      query.relatedSystemId !== undefined ||
      query.priority ||
      query.status,
  );
}

function TicketLink({
  ticketNumber,
  navigate,
}: {
  ticketNumber: string;
  navigate: (path: string) => void;
}) {
  return (
    <a
      href={`/tickets/${encodeURIComponent(ticketNumber)}`}
      onClick={(event) => {
        event.preventDefault();
        navigate(`/tickets/${encodeURIComponent(ticketNumber)}`);
      }}
    >
      {ticketNumber}
    </a>
  );
}

function TicketPriorityBadge({ priority }: { priority: string }) {
  return <span className={`zen-priority-badge zen-priority-${priority.toLowerCase()}`}>{priority}</span>;
}

function TicketTable({
  result,
  navigate,
}: {
  result: TicketListResponse;
  navigate: (path: string) => void;
}) {
  return (
    <div className="zen-ticket-table-wrap">
      <table className="zen-ticket-table" aria-label="My Tickets">
        <caption className="sr-only">Requester-owned Tickets</caption>
        <thead>
          <tr>
            <th scope="col">Ticket Number</th>
            <th scope="col">Summary</th>
            <th scope="col">Category</th>
            <th scope="col">Related System</th>
            <th scope="col">Requested Priority</th>
            <th scope="col">Current Status</th>
            <th scope="col">Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((ticket) => (
            <tr key={ticket.id}>
              <td><TicketLink ticketNumber={ticket.ticketNumber} navigate={navigate} /></td>
              <td>{ticket.summary}</td>
              <td>{ticket.category.name}</td>
              <td>{ticket.relatedSystem.name}</td>
              <td><TicketPriorityBadge priority={ticket.requestedPriority} /></td>
              <td><span className="zen-status-badge">{ticket.status}</span></td>
              <td>{formatDate(ticket.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TicketCards({
  result,
  navigate,
}: {
  result: TicketListResponse;
  navigate: (path: string) => void;
}) {
  return (
    <section className="zen-ticket-cards" aria-label="Mobile ticket cards">
      {result.items.map((ticket) => (
        <article className="zen-ticket-card-item" key={ticket.id}>
          <div className="zen-ticket-card-topline">
            <TicketLink ticketNumber={ticket.ticketNumber} navigate={navigate} />
            <TicketPriorityBadge priority={ticket.requestedPriority} />
          </div>
          <h2>{ticket.summary}</h2>
          <dl>
            <div><dt>Category</dt><dd>{ticket.category.name}</dd></div>
            <div><dt>Related System</dt><dd>{ticket.relatedSystem.name}</dd></div>
            <div><dt>Status</dt><dd><span className="zen-status-badge">{ticket.status}</span></dd></div>
            <div><dt>Last Updated</dt><dd>{formatDate(ticket.updatedAt)}</dd></div>
          </dl>
          <a
            className="zen-button zen-button-secondary zen-card-open"
            href={`/tickets/${encodeURIComponent(ticket.ticketNumber)}`}
            onClick={(event) => {
              event.preventDefault();
              navigate(`/tickets/${encodeURIComponent(ticket.ticketNumber)}`);
            }}
          >
            Open Ticket
          </a>
        </article>
      ))}
    </section>
  );
}

export default function MyTickets({ requester, navigate }: MyTicketsProps) {
  const [query, setQuery] = useState<TicketListQuery>(() =>
    parseUrlQuery(typeof window === "undefined" ? "" : window.location.search),
  );
  const [draftSearch, setDraftSearch] = useState(query.search ?? "");
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [result, setResult] = useState<TicketListResponse | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "success" | "error">("loading");
  const [reloadToken, setReloadToken] = useState(0);

  const queryKey = useMemo(() => JSON.stringify(query), [query]);

  useEffect(() => {
    const onPopState = () => {
      const nextQuery = parseUrlQuery(window.location.search);
      setQuery(nextQuery);
      setDraftSearch(nextQuery.search ?? "");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");

    void Promise.all([fetchCategories(), fetchRelatedSystems(), fetchTickets(requester.id, query)])
      .then(([loadedCategories, loadedSystems, loadedTickets]) => {
        if (cancelled) return;
        setCategories(loadedCategories);
        setRelatedSystems(loadedSystems);
        setResult(loadedTickets);
        setLoadState("success");
      })
      .catch(() => {
        if (cancelled) return;
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [queryKey, reloadToken, requester.id, query]);

  function applyQuery(nextQuery: TicketListQuery) {
    const queryChanged = JSON.stringify(query) !== JSON.stringify(nextQuery);
    setQuery(nextQuery);
    setDraftSearch(nextQuery.search ?? "");
    navigate(`/tickets${toSearchParams(nextQuery)}`);
    if (!queryChanged) {
      setReloadToken((token) => token + 1);
    }
  }

  function updateQuery(changes: Partial<TicketListQuery>) {
    applyQuery({ ...query, ...changes });
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextSearch = draftSearch.trim().slice(0, 100);
    applyQuery({
      ...query,
      ...(nextSearch ? { search: nextSearch } : {}),
      ...(nextSearch ? {} : { search: undefined }),
      page: 1,
    });
  }

  function clearFilters() {
    const nextQuery = { ...DEFAULT_TICKET_LIST_QUERY };
    applyQuery(nextQuery);
  }

  const errorMessage = "Unable to load My Tickets.";
  const filtered = isFiltered(query);

  return (
    <section className="zen-card zen-list-card" aria-labelledby="my-tickets-heading">
      <div className="zen-list-heading">
        <div>
          <p className="zen-eyebrow">Requester workspace</p>
          <h1 id="my-tickets-heading">My Tickets</h1>
          <p className="zen-lead">Tickets created in the selected Development Requester context.</p>
        </div>
        <a
          className="zen-button zen-button-primary"
          aria-label="Create Ticket from My Tickets"
          href="/tickets/new"
          onClick={(event) => {
            event.preventDefault();
            navigate("/tickets/new");
          }}
        >
          Create Ticket
        </a>
      </div>

      <form className="zen-list-toolbar" onSubmit={handleSearchSubmit} aria-label="Ticket list filters">
        <div className="zen-search-row">
          <div className="zen-field zen-search-field">
            <label htmlFor="ticket-search">Search Tickets</label>
            <input
              id="ticket-search"
              className="zen-input"
              name="search"
              type="search"
              maxLength={100}
              value={draftSearch}
              onChange={(event) => setDraftSearch(event.target.value)}
              placeholder="Ticket Number, summary, or description"
            />
          </div>
          <button className="zen-button zen-button-primary" type="submit">Apply Filters</button>
          <button className="zen-button zen-button-secondary" type="button" onClick={clearFilters}>Clear Filters</button>
        </div>

        <div className="zen-filter-grid">
          <div className="zen-field">
            <label htmlFor="ticket-category-filter">Category</label>
            <select
              id="ticket-category-filter"
              value={query.categoryId === undefined ? "" : String(query.categoryId)}
              onChange={(event) => updateQuery({ categoryId: event.target.value ? Number(event.target.value) : undefined, page: 1 })}
            >
              <option value="">All Categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>

          <div className="zen-field">
            <label htmlFor="ticket-system-filter">Related System</label>
            <select
              id="ticket-system-filter"
              value={query.relatedSystemId === undefined ? "" : String(query.relatedSystemId)}
              onChange={(event) => updateQuery({ relatedSystemId: event.target.value ? Number(event.target.value) : undefined, page: 1 })}
            >
              <option value="">All Related Systems</option>
              {relatedSystems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
            </select>
          </div>

          <div className="zen-field">
            <label htmlFor="ticket-priority-filter">Requested Priority</label>
            <select
              id="ticket-priority-filter"
              value={query.priority ?? ""}
              onChange={(event) => updateQuery({ priority: event.target.value ? event.target.value as TicketListQuery["priority"] : undefined, page: 1 })}
            >
              <option value="">All Priorities</option>
              {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
            </select>
          </div>

          <div className="zen-field">
            <label htmlFor="ticket-status-filter">Status</label>
            <select
              id="ticket-status-filter"
              value={query.status ?? ""}
              onChange={(event) => updateQuery({ status: event.target.value ? "NEW" : undefined, page: 1 })}
            >
              <option value="">All Statuses</option>
              <option value="NEW">NEW</option>
            </select>
          </div>

          <div className="zen-field">
            <label htmlFor="ticket-sort-filter">Sort by</label>
            <select
              id="ticket-sort-filter"
              value={query.sort}
              onChange={(event) => updateQuery({ sort: event.target.value as TicketListSort, page: 1 })}
            >
              {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          <div className="zen-field">
            <label htmlFor="ticket-order-filter">Order</label>
            <select
              id="ticket-order-filter"
              value={query.order}
              onChange={(event) => updateQuery({ order: event.target.value as TicketListOrder, page: 1 })}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>

          <div className="zen-field">
            <label htmlFor="ticket-page-size-filter">Page size</label>
            <select
              id="ticket-page-size-filter"
              value={String(query.pageSize)}
              onChange={(event) => updateQuery({ pageSize: Number(event.target.value) as TicketListPageSize, page: 1 })}
            >
              {PAGE_SIZE_OPTIONS.map((pageSize) => <option key={pageSize} value={pageSize}>{pageSize} per page</option>)}
            </select>
          </div>
        </div>
      </form>

      {loadState === "loading" && (
        <p className="zen-state zen-state-info" role="status" aria-live="polite">Loading My Tickets...</p>
      )}

      {loadState === "error" && (
        <div className="zen-state zen-state-error" role="alert" aria-label="My Tickets loading error">
          <p>{errorMessage}</p>
          <button className="zen-button zen-button-secondary" type="button" onClick={() => setReloadToken((token) => token + 1)}>Retry</button>
        </div>
      )}

      {loadState === "success" && result && result.items.length === 0 && (
        <div className="zen-state zen-state-info" role="status">
          <p>{filtered ? "No Tickets match your filters." : "You have no Tickets yet."}</p>
          {filtered && (
            <button
              className="zen-button zen-button-secondary"
              type="button"
              aria-label="Clear filters from no-results state"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
          )}
          {!filtered && <a className="zen-button zen-button-primary" href="/tickets/new" onClick={(event) => { event.preventDefault(); navigate("/tickets/new"); }}>Create Ticket</a>}
        </div>
      )}

      {loadState === "success" && result && result.items.length > 0 && (
        <>
          <div className="zen-list-summary" role="status" aria-live="polite">
            <span>Showing {result.items.length} of {result.pagination.totalItems} Tickets</span>
            {result.pagination.totalPages > 0 && <span>Page {result.pagination.page} of {result.pagination.totalPages}</span>}
          </div>
          <TicketTable result={result} navigate={navigate} />
          <TicketCards result={result} navigate={navigate} />
          <nav className="zen-pagination" aria-label="Ticket list pagination">
            <button
              className="zen-button zen-button-secondary"
              type="button"
              disabled={!result.pagination.hasPreviousPage}
              onClick={() => updateQuery({ page: Math.max(1, query.page - 1) })}
            >
              Previous
            </button>
            <span aria-live="polite">Page {result.pagination.page} of {Math.max(1, result.pagination.totalPages)}</span>
            <button
              className="zen-button zen-button-secondary"
              type="button"
              disabled={!result.pagination.hasNextPage}
              onClick={() => updateQuery({ page: query.page + 1 })}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
