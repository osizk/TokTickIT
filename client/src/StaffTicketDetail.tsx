import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ApiClientError,
  InternalNote,
  PublicComment,
  StaffAssignee,
  StaffTicket,
  TicketAttachment,
  TicketPriority,
  TicketStatus,
  addInternalNote,
  addPublicComment,
  downloadTicketAttachment,
  fetchInternalNotes,
  fetchStaffAssignees,
  fetchStaffTicket,
  fetchTicketAttachments,
  fetchTicketComments,
  updateStaffTicketAssignment,
  updateStaffTicketPriority,
  updateStaffTicketStatus,
} from "./api.js";

interface StaffTicketDetailProps {
  ticketNumber: string;
  navigate: (path: string) => void;
  currentUserId?: number;
}

type LoadState = "loading" | "success" | "error";
type ConfirmAction = { kind: "assignment"; ownerUserId: number | null } | { kind: "status"; status: TicketStatus };

const PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const STATUSES: TicketStatus[] = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"];
const CONFIRM_STATUSES = new Set<TicketStatus>(["RESOLVED", "CLOSED", "REOPENED", "CANCELLED"]);

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    if (error.code === "ASSIGNMENT_CONFLICT") return "The selected owner is no longer active or eligible. Refresh and try again.";
    if (error.code === "INVALID_STATUS_TRANSITION") return "That status transition is not allowed from the current status.";
    return error.message;
  }
  return fallback;
}

function ReadOnlyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const id = `staff-ticket-detail-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className={multiline ? "zen-field zen-field-wide" : "zen-field"}>
      <label htmlFor={id}>{label}</label>
      {multiline ? <textarea id={id} className="zen-input zen-textarea zen-readonly" value={value} readOnly aria-readonly="true" /> : <input id={id} className="zen-input zen-readonly" value={value} readOnly aria-readonly="true" />}
    </div>
  );
}

function CommentList({ comments, label }: { comments: PublicComment[]; label: string }) {
  if (comments.length === 0) return <p className="zen-state zen-state-info" role="status">No Public Comments yet.</p>;
  return (
    <ol className="zen-comment-list" aria-label={label}>
      {comments.map((comment) => <li key={comment.id}><div><strong>{comment.author.name}</strong><span>{formatDate(comment.createdAt)}</span></div><p>{comment.content}</p></li>)}
    </ol>
  );
}

function NoteList({ notes }: { notes: InternalNote[] }) {
  if (notes.length === 0) return <p className="zen-state zen-state-info" role="status">No Internal Notes yet.</p>;
  return (
    <ol className="zen-comment-list zen-note-list" aria-label="Internal Note timeline">
      {notes.map((note) => <li key={note.id}><div><strong>{note.author.name}</strong><span>{formatDate(note.createdAt)}</span></div><p>{note.content}</p></li>)}
    </ol>
  );
}

function ConfirmationDialog({ action, onCancel, onConfirm, busy }: { action: ConfirmAction; onCancel: () => void; onConfirm: () => void; busy: boolean }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { cancelRef.current?.focus(); }, []);
  const title = action.kind === "assignment" ? (action.ownerUserId === null ? "Unassign Ticket?" : "Confirm reassignment") : `Change status to ${action.status}?`;
  const consequence = action.kind === "assignment" ? "This changes the Ticket Owner and may affect queue responsibility." : "This changes the formal Ticket status and may not be reversible without another permitted transition.";
  return <div className="zen-modal-backdrop" role="presentation"><div className="zen-removal-dialog" role="dialog" aria-modal="true" aria-labelledby="staff-confirm-heading"><h2 id="staff-confirm-heading">{title}</h2><p>{consequence}</p><div className="zen-form-actions"><button ref={cancelRef} className="zen-button zen-button-secondary" type="button" onClick={onCancel} disabled={busy}>Cancel</button><button className="zen-button zen-button-primary" type="button" onClick={onConfirm} disabled={busy}>{busy ? "Saving..." : "Confirm"}</button></div></div></div>;
}

function AttachmentList({ attachments, onDownload }: { attachments: TicketAttachment[]; onDownload: (attachment: TicketAttachment) => void }) {
  if (attachments.length === 0) return <p className="zen-state zen-state-info" role="status">No Attachments have been added.</p>;
  return (
    <ul className="zen-detail-attachment-list" aria-label="Staff Ticket Attachments">
      {attachments.map((attachment) => <li key={attachment.id} className={attachment.removedAt ? "is-removed" : undefined}>
        <div className="zen-attachment-meta"><strong>{attachment.originalName}</strong><span>{attachment.mimeType} · {formatBytes(attachment.sizeBytes)} · Uploaded {formatDate(attachment.uploadedAt)}</span>{attachment.removedAt && <span className="zen-attachment-removed">Removed {formatDate(attachment.removedAt)} · Reason: {attachment.removalReason ?? "Not provided"}</span>}</div>
        {!attachment.removedAt && <div className="zen-attachment-actions"><button className="zen-button zen-button-secondary" type="button" onClick={() => onDownload(attachment)}>Download</button></div>}
      </li>)}
    </ul>
  );
}

export default function StaffTicketDetail({ ticketNumber, navigate, currentUserId }: StaffTicketDetailProps) {
  const [ticket, setTicket] = useState<StaffTicket | null>(null);
  const [ticketState, setTicketState] = useState<LoadState>("loading");
  const [ticketError, setTicketError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);
  const [assignees, setAssignees] = useState<StaffAssignee[]>([]);
  const [selectedOwner, setSelectedOwner] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<TicketPriority>("LOW");
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus>("NEW");
  const [actionState, setActionState] = useState<"idle" | "saving">("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmAction | null>(null);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [attachmentState, setAttachmentState] = useState<LoadState>("loading");
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [commentState, setCommentState] = useState<LoadState>("loading");
  const [commentText, setCommentText] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [noteState, setNoteState] = useState<LoadState>("loading");
  const [noteText, setNoteText] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSubmitting, setNoteSubmitting] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTicketState("loading"); setTicket(null); setTicketError(null);
    void fetchStaffTicket(ticketNumber).then((loaded) => {
      if (cancelled) return;
      setTicket(loaded); setSelectedOwner(loaded.ticketOwner ? String(loaded.ticketOwner.id) : ""); setSelectedPriority(loaded.itPriority); setSelectedStatus(loaded.status); setTicketState("success");
    }).catch((error: unknown) => { if (!cancelled) { setTicketError(error); setTicketState("error"); } });
    return () => { cancelled = true; };
  }, [ticketNumber, retry]);

  useEffect(() => {
    let cancelled = false;
    void fetchStaffAssignees().then((loaded) => { if (!cancelled) setAssignees(loaded); }).catch(() => { if (!cancelled) setAssignees([]); });
    return () => { cancelled = true; };
  }, [ticketNumber, retry]);

  useEffect(() => {
    let cancelled = false;
    setAttachmentState("loading");
    void fetchTicketAttachments(ticketNumber).then((loaded) => { if (!cancelled) { setAttachments(loaded); setAttachmentState("success"); } }).catch(() => { if (!cancelled) { setAttachments([]); setAttachmentState("error"); } });
    return () => { cancelled = true; };
  }, [ticketNumber, retry]);

  useEffect(() => {
    let cancelled = false;
    setCommentState("loading");
    void fetchTicketComments(ticketNumber).then((loaded) => { if (!cancelled) { setComments(loaded); setCommentState("success"); } }).catch(() => { if (!cancelled) { setComments([]); setCommentState("error"); } });
    return () => { cancelled = true; };
  }, [ticketNumber, retry]);

  useEffect(() => {
    let cancelled = false;
    setNoteState("loading");
    void fetchInternalNotes(ticketNumber).then((loaded) => { if (!cancelled) { setNotes(loaded); setNoteState("success"); } }).catch(() => { if (!cancelled) { setNotes([]); setNoteState("error"); } });
    return () => { cancelled = true; };
  }, [ticketNumber, retry]);

  async function saveAssignment(ownerUserId: number | null, confirm = false) {
    if (!ticket || actionState === "saving") return;
    setActionState("saving"); setActionError(null); setActionSuccess(null);
    try { const updated = await updateStaffTicketAssignment(ticketNumber, ownerUserId, confirm); setTicket(updated); setSelectedOwner(updated.ticketOwner ? String(updated.ticketOwner.id) : ""); setActionSuccess("Ticket assignment updated."); setConfirmation(null); }
    catch (error) { setActionError(errorMessage(error, "Unable to update Ticket assignment.")); }
    finally { setActionState("idle"); }
  }

  function submitAssignment() {
    const ownerUserId = selectedOwner ? Number(selectedOwner) : null;
    if (ticket?.ticketOwner && ticket.ticketOwner.id !== ownerUserId) setConfirmation({ kind: "assignment", ownerUserId });
    else void saveAssignment(ownerUserId);
  }

  function claimTicket() {
    if (!currentUserId || !ticket || actionState === "saving") return;
    setSelectedOwner(String(currentUserId));
    if (ticket.ticketOwner && ticket.ticketOwner.id !== currentUserId) setConfirmation({ kind: "assignment", ownerUserId: currentUserId });
    else void saveAssignment(currentUserId);
  }

  function unassignTicket() {
    if (!ticket || actionState === "saving") return;
    setSelectedOwner("");
    if (ticket.ticketOwner) setConfirmation({ kind: "assignment", ownerUserId: null });
    else void saveAssignment(null);
  }

  async function savePriority() {
    if (!ticket || actionState === "saving") return;
    setActionState("saving"); setActionError(null); setActionSuccess(null);
    try { const updated = await updateStaffTicketPriority(ticketNumber, selectedPriority); setTicket(updated); setSelectedPriority(updated.itPriority); setActionSuccess("IT Priority updated."); }
    catch (error) { setActionError(errorMessage(error, "Unable to update IT Priority.")); }
    finally { setActionState("idle"); }
  }

  function submitStatus() {
    if (!ticket || ticket.status === selectedStatus || actionState === "saving") return;
    if (CONFIRM_STATUSES.has(selectedStatus)) setConfirmation({ kind: "status", status: selectedStatus });
    else void saveStatus(selectedStatus);
  }

  async function saveStatus(status: TicketStatus, confirm = false) {
    if (!ticket || actionState === "saving") return;
    setActionState("saving"); setActionError(null); setActionSuccess(null);
    try { const updated = await updateStaffTicketStatus(ticketNumber, status, confirm); setTicket(updated); setSelectedStatus(updated.status); setConfirmation(null); setActionSuccess("Ticket status updated."); }
    catch (error) { setActionError(errorMessage(error, "Unable to update Ticket status.")); }
    finally { setActionState("idle"); }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = commentText.trim();
    if (commentSubmitting) return;
    if (content.length < 1 || content.length > 2000) { setCommentError("Comment must be 1–2,000 characters after trimming."); return; }
    setCommentError(null); setActionError(null);
    setCommentSubmitting(true);
    try { const created = await addPublicComment(ticketNumber, content); setComments((current) => [...current, created]); setCommentText(""); setCommentState("success"); }
    catch (error) { setCommentError(errorMessage(error, "Unable to add Public Comment.")); }
    finally { setCommentSubmitting(false); }
  }

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = noteText.trim();
    if (noteSubmitting) return;
    if (content.length < 1 || content.length > 2000) { setNoteError("Note must be 1–2,000 characters after trimming."); return; }
    setNoteError(null); setActionError(null);
    setNoteSubmitting(true);
    try { const created = await addInternalNote(ticketNumber, content); setNotes((current) => [...current, created]); setNoteText(""); setNoteState("success"); }
    catch (error) { setNoteError(errorMessage(error, "Unable to add Internal Note.")); }
    finally { setNoteSubmitting(false); }
  }

  async function handleDownload(attachment: TicketAttachment) {
    setDownloadError(null);
    try { const blob = await downloadTicketAttachment(ticketNumber, attachment.id); const url = typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : null; if (!url) throw new Error("download unavailable"); const link = document.createElement("a"); link.href = url; link.download = attachment.originalName; link.rel = "noopener"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); }
    catch (error) { setDownloadError(errorMessage(error, "Unable to download Attachment.")); }
  }

  const backLink = <a className="zen-button zen-button-secondary" href="/staff/tickets" onClick={(event) => { event.preventDefault(); navigate("/staff/tickets"); }}>Back to Ticket Queue</a>;
  return (
    <section className="zen-card zen-detail-card" aria-labelledby="staff-ticket-detail-heading">
      <div className="zen-detail-heading"><div><p className="zen-eyebrow">Operations workspace</p><h1 id="staff-ticket-detail-heading">Staff Ticket Detail</h1><p className="zen-lead">Review and operate on the Ticket selected from the shared queue.</p></div>{backLink}</div>
      {ticketState === "loading" && <p className="zen-state zen-state-info" role="status">Loading Staff Ticket Detail...</p>}
      {ticketState === "error" && <div className="zen-state zen-state-error" role="alert" aria-label="Staff Ticket detail loading error"><p>{ticketError instanceof ApiClientError && ticketError.status === 404 ? "Ticket was not found." : "Unable to load Staff Ticket."}</p>{!(ticketError instanceof ApiClientError && ticketError.status === 404) && <button className="zen-button zen-button-secondary" type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button>}</div>}
      {ticketState === "success" && ticket && <>
        <div className="zen-form-grid zen-detail-fields"><ReadOnlyField label="Ticket Number" value={ticket.ticketNumber} /><ReadOnlyField label="Ticket Date" value={formatDate(ticket.createdAt)} /><ReadOnlyField label="Requester" value={`${ticket.requester.name} (${ticket.requester.email})`} /><ReadOnlyField label="Category" value={ticket.category.name} /><ReadOnlyField label="Related System" value={ticket.relatedSystem.name} /><ReadOnlyField label="Requested Priority" value={ticket.requestedPriority} /><ReadOnlyField label="Resolution Indication" value={ticket.resolutionIndication ? `Indicated ${formatDate(ticket.resolutionIndication.indicatedAt)} by ${ticket.resolutionIndication.indicatedBy.name}` : "Not indicated"} /><ReadOnlyField label="Last Updated" value={formatDate(ticket.updatedAt)} /><ReadOnlyField label="Summary" value={ticket.summary} multiline /><ReadOnlyField label="Description" value={ticket.description} multiline /></div>
        <section className="zen-operations-section" aria-labelledby="staff-actions-heading"><div className="zen-section-heading"><div><p className="zen-eyebrow">Staff controls</p><h2 id="staff-actions-heading">Ticket Operations</h2></div><span className="zen-help">All changes are checked by the server.</span></div>
          <div className="zen-form-grid zen-operation-grid">
            <div className="zen-field"><label htmlFor="staff-assignment">Assignee</label><select id="staff-assignment" value={selectedOwner} onChange={(event) => setSelectedOwner(event.target.value)}><option value="">Unassigned</option>{assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name} ({assignee.role.replace("_", " ")})</option>)}</select><div className="zen-inline-actions"><button className="zen-button zen-button-secondary" type="button" onClick={claimTicket} disabled={!currentUserId || actionState === "saving" || ticket.ticketOwner?.id === currentUserId}>Claim</button><button className="zen-button zen-button-primary" type="button" onClick={submitAssignment} disabled={actionState === "saving"}>{actionState === "saving" ? "Saving..." : "Assign / Reassign"}</button><button className="zen-button zen-button-link" type="button" onClick={unassignTicket} disabled={actionState === "saving" || !ticket.ticketOwner}>Unassign</button></div></div>
            <div className="zen-field"><label htmlFor="staff-it-priority">IT Priority</label><select id="staff-it-priority" value={selectedPriority} onChange={(event) => setSelectedPriority(event.target.value as TicketPriority)}>{PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select><button className="zen-button zen-button-primary zen-control-button" type="button" onClick={() => void savePriority()} disabled={actionState === "saving" || selectedPriority === ticket.itPriority}>Save IT Priority</button></div>
            <div className="zen-field"><label htmlFor="staff-status">Status</label><select id="staff-status" value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value as TicketStatus)}>{STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select><button className="zen-button zen-button-primary zen-control-button" type="button" onClick={submitStatus} disabled={actionState === "saving" || selectedStatus === ticket.status}>Save Status</button></div>
          </div>
          {actionError && <p className="zen-field-error" role="alert">{actionError}</p>}{actionSuccess && <p className="zen-state zen-state-success" role="status">{actionSuccess}</p>}
        </section>
      </>}

      <section className="zen-comment-section" aria-labelledby="staff-public-comments-heading"><div className="zen-section-heading"><div><p className="zen-eyebrow">Requester-visible communication</p><h2 id="staff-public-comments-heading">Public Comments</h2></div></div>{commentState === "loading" && <p className="zen-state zen-state-info" role="status">Loading Public Comments...</p>}{commentState === "error" && <p className="zen-state zen-state-error" role="alert">Unable to load Public Comments.</p>}{commentState === "success" && <CommentList comments={comments} label="Public Comment timeline" />}<form className="zen-comment-form" onSubmit={(event) => void submitComment(event)}><div className="zen-field"><label htmlFor="staff-public-comment">Add Public Comment</label><textarea id="staff-public-comment" className="zen-input zen-textarea" value={commentText} maxLength={2000} onChange={(event) => setCommentText(event.target.value)} /><span className="zen-help">1–2,000 characters. Comments are append-only and visible to the Requester.</span>{commentError && <p className="zen-field-error" role="alert">{commentError}</p>}</div><button className="zen-button zen-button-primary" type="submit" disabled={commentSubmitting || commentText.trim().length < 1 || commentText.trim().length > 2000}>{commentSubmitting ? "Posting Comment..." : "Post Public Comment"}</button></form></section>

      <section className="zen-comment-section zen-internal-notes" aria-labelledby="staff-internal-notes-heading"><div className="zen-section-heading"><div><p className="zen-eyebrow">Staff-only communication</p><h2 id="staff-internal-notes-heading">Internal Notes</h2></div><span className="zen-help">Never shown to Requesters.</span></div>{noteState === "loading" && <p className="zen-state zen-state-info" role="status">Loading Internal Notes...</p>}{noteState === "error" && <p className="zen-state zen-state-error" role="alert">Unable to load Internal Notes.</p>}{noteState === "success" && <NoteList notes={notes} />}<form className="zen-comment-form" onSubmit={(event) => void submitNote(event)}><div className="zen-field"><label htmlFor="staff-internal-note">Add Internal Note</label><textarea id="staff-internal-note" className="zen-input zen-textarea" value={noteText} maxLength={2000} onChange={(event) => setNoteText(event.target.value)} /><span className="zen-help">1–2,000 characters. Notes are append-only and staff-only.</span>{noteError && <p className="zen-field-error" role="alert">{noteError}</p>}</div><button className="zen-button zen-button-primary" type="submit" disabled={noteSubmitting || noteText.trim().length < 1 || noteText.trim().length > 2000}>{noteSubmitting ? "Posting Note..." : "Post Internal Note"}</button></form></section>

      <section className="zen-attachment-section" aria-labelledby="staff-ticket-attachments-heading"><div className="zen-section-heading"><div><p className="zen-eyebrow">Supporting evidence</p><h2 id="staff-ticket-attachments-heading">Attachments</h2></div><span className="zen-help">Active and removed metadata is retained; staff can download active files.</span></div>{attachmentState === "loading" && <p className="zen-state zen-state-info" role="status">Loading Attachments...</p>}{attachmentState === "error" && <p className="zen-state zen-state-error" role="alert">Unable to load Attachments.</p>}{attachmentState === "success" && <AttachmentList attachments={attachments} onDownload={(attachment) => void handleDownload(attachment)} />}{downloadError && <p className="zen-field-error" role="alert">{downloadError}</p>}</section>
      {confirmation && <ConfirmationDialog action={confirmation} onCancel={() => setConfirmation(null)} onConfirm={() => { if (confirmation.kind === "assignment") void saveAssignment(confirmation.ownerUserId, true); else void saveStatus(confirmation.status, true); }} busy={actionState === "saving"} />}
    </section>
  );
}
