import { useEffect, useState } from "react";
import {
  fetchTicketWorkflowEvents,
  type ResolutionGate,
  type ResolutionIndication,
  type TicketStatus,
  type TicketWorkflowEvent,
  type TicketWorkflowHistory,
} from "./api.js";

interface TicketWorkflowProps {
  ticketNumber: string;
  status: TicketStatus;
  workflowVersion: number;
  resolutionIndication: ResolutionIndication | null;
  resolutionGate?: ResolutionGate;
}

const GATE_MESSAGES: Record<ResolutionGate["unmetConditions"][number], string> = {
  OWNER_REQUIRED: "Assign an eligible Ticket Owner.",
  OWNER_INELIGIBLE: "The Ticket Owner must be active IT Staff or an Administrator.",
  COMPLETED_ACTION_REQUIRED: "Complete at least one Action with a valid Result.",
  UNFINISHED_ACTIONS: "Finish or cancel all open Actions.",
  FOLLOW_UP_REQUIRED: "Complete or clear follow-up on completed Actions.",
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function WorkflowEventList({ events }: { events: TicketWorkflowEvent[] }) {
  if (!events.length) return <p className="zen-state zen-state-info" role="status">No status changes have been recorded for this Ticket.</p>;
  return (
    <ol className="zen-comment-list" aria-label="Ticket status history">
      {events.map((event) => <li key={event.id}>
        <div><strong>{event.fromStatus} → {event.toStatus}</strong><span>{formatDate(event.createdAt)}</span></div>
        <p>By {event.actor.name} · Workflow version {event.workflowVersion}</p>
        {event.reason && <p>Reason: {event.reason}</p>}
      </li>)}
    </ol>
  );
}

export default function TicketWorkflow({ ticketNumber, status, workflowVersion, resolutionIndication, resolutionGate }: TicketWorkflowProps) {
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [history, setHistory] = useState<TicketWorkflowHistory | null>(null);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    void fetchTicketWorkflowEvents(ticketNumber, page).then((result) => {
      if (!cancelled) { setHistory(result); setState("success"); }
    }).catch(() => {
      if (!cancelled) { setHistory(null); setState("error"); }
    });
    return () => { cancelled = true; };
  }, [ticketNumber, page, retry, workflowVersion]);

  return (
    <section className="zen-comment-section" aria-labelledby="ticket-workflow-heading">
      <div className="zen-section-heading"><div><p className="zen-eyebrow">Status and audit history</p><h2 id="ticket-workflow-heading">Ticket Workflow</h2></div></div>
      <p role="status">Current Ticket status: {status}</p>
      <p>Workflow version {workflowVersion}</p>
      {resolutionIndication && <p className="zen-state zen-state-info" role="status">Requester indicated the problem appears resolved. Ticket status has not changed.</p>}
      {resolutionGate && resolutionGate.unmetConditions.length > 0 && <div className="zen-state zen-state-info">
        <p>Resolution prerequisites:</p>
        <ul aria-label="Resolution prerequisites">{resolutionGate.unmetConditions.map((condition) => <li key={condition}>{GATE_MESSAGES[condition]}</li>)}</ul>
      </div>}
      <h3>Ticket Status History</h3>
      {state === "loading" && <p className="zen-state zen-state-info" role="status">Loading Ticket status history...</p>}
      {state === "error" && <div className="zen-state zen-state-error" role="alert"><p>Unable to load Ticket status history.</p><button className="zen-button zen-button-secondary" type="button" onClick={() => setRetry((value) => value + 1)}>Retry history</button></div>}
      {state === "success" && history && <>
        <WorkflowEventList events={history.events} />
        {history.pagination.totalPages > 1 && <div className="zen-inline-actions" aria-label="Ticket status history pagination">
          <button className="zen-button zen-button-secondary" type="button" disabled={!history.pagination.hasPreviousPage} onClick={() => setPage((value) => value - 1)}>Previous history page</button>
          <span>Page {history.pagination.page} of {history.pagination.totalPages}</span>
          <button className="zen-button zen-button-secondary" type="button" disabled={!history.pagination.hasNextPage} onClick={() => setPage((value) => value + 1)}>Next history page</button>
        </div>}
      </>}
    </section>
  );
}
