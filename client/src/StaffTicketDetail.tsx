import { useEffect, useState } from "react";
import { ApiClientError, StaffTicket, fetchStaffTicket } from "./api.js";

interface StaffTicketDetailProps {
  ticketNumber: string;
  navigate: (path: string) => void;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function ReadOnlyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const id = `staff-ticket-detail-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className={multiline ? "zen-field zen-field-wide" : "zen-field"}>
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea id={id} className="zen-input zen-textarea zen-readonly" value={value} readOnly aria-readonly="true" />
      ) : (
        <input id={id} className="zen-input zen-readonly" value={value} readOnly aria-readonly="true" />
      )}
    </div>
  );
}

function StaffTicketFields({ ticket }: { ticket: StaffTicket }) {
  return (
    <div className="zen-form-grid zen-detail-fields">
      <ReadOnlyField label="Ticket Number" value={ticket.ticketNumber} />
      <ReadOnlyField label="Ticket Date" value={formatDate(ticket.createdAt)} />
      <ReadOnlyField label="Requester" value={`${ticket.requester.name} (${ticket.requester.email})`} />
      <ReadOnlyField label="Category" value={ticket.category.name} />
      <ReadOnlyField label="Related System" value={ticket.relatedSystem.name} />
      <ReadOnlyField label="Requested Priority" value={ticket.requestedPriority} />
      <ReadOnlyField label="IT Priority" value={ticket.itPriority} />
      <ReadOnlyField label="Current Status" value={ticket.status} />
      <ReadOnlyField label="Assignee" value={ticket.ticketOwner?.name ?? "Unassigned"} />
      <ReadOnlyField label="Last Updated" value={formatDate(ticket.updatedAt)} />
      <ReadOnlyField label="Summary" value={ticket.summary} multiline />
      <ReadOnlyField label="Description" value={ticket.description} multiline />
    </div>
  );
}

export default function StaffTicketDetail({ ticketNumber, navigate }: StaffTicketDetailProps) {
  const [ticket, setTicket] = useState<StaffTicket | null>(null);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setTicket(null);
    setError(null);
    void fetchStaffTicket(ticketNumber)
      .then((loaded) => {
        if (cancelled) return;
        setTicket(loaded);
        setState("success");
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason);
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [ticketNumber, retry]);

  const backLink = (
    <a className="zen-button zen-button-secondary" href="/staff/tickets" onClick={(event) => { event.preventDefault(); navigate("/staff/tickets"); }}>
      Back to Ticket Queue
    </a>
  );

  return (
    <section className="zen-card zen-detail-card" aria-labelledby="staff-ticket-detail-heading">
      <div className="zen-detail-heading">
        <div>
          <p className="zen-eyebrow">Operations workspace</p>
          <h1 id="staff-ticket-detail-heading">Staff Ticket Detail</h1>
          <p className="zen-lead">Review the Ticket selected from the shared staff queue.</p>
        </div>
        {backLink}
      </div>

      {state === "loading" && <p className="zen-state zen-state-info" role="status">Loading Staff Ticket Detail...</p>}
      {state === "error" && (
        <div className="zen-state zen-state-error" role="alert" aria-label="Staff Ticket detail loading error">
          <p>{error instanceof ApiClientError && error.status === 404 ? "Ticket was not found." : "Unable to load Staff Ticket."}</p>
          {!(error instanceof ApiClientError && error.status === 404) && <button className="zen-button zen-button-secondary" type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button>}
        </div>
      )}
      {state === "success" && ticket && <StaffTicketFields ticket={ticket} />}
    </section>
  );
}
