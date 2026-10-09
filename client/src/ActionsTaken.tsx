import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  ApiClientError,
  type ActionRevision,
  type ActionTaken as ActionRecord,
  type CreateActionTakenInput,
  type StaffAssignee,
  type TicketListPageSize,
  type UpdateActionTakenInput,
  createActionTaken,
  fetchActionRevisions,
  fetchActionsTaken,
  fetchStaffAssignees,
  updateActionTaken,
} from "./api.js";

interface ActionsTakenProps {
  ticketNumber: string;
  readOnly?: boolean;
  currentUserId?: number;
}

type ActionDraft = {
  description: string;
  assigneeUserId: string;
  result: string;
  followUpRequired: boolean;
  followUpNote: string;
  attachmentNotes: string;
};
type FieldErrors = Partial<Record<keyof ActionDraft, string>>;
type ConfirmAction = { kind: "complete"; action: ActionRecord } | { kind: "cancel"; action: ActionRecord };
type RevisionState = { open: boolean; loading: boolean; error: string | null; revisions: ActionRevision[] };

const emptyDraft = (): ActionDraft => ({ description: "", assigneeUserId: "", result: "", followUpRequired: false, followUpNote: "", attachmentNotes: "" });

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiClientError)) return fallback;
  if (error.status === 0) return "Unable to reach the server. Check your connection and retry.";
  if (error.status === 401) return "Your session has expired. Sign in again to continue.";
  if (error.status === 403) return "You do not have permission to view or change Actions Taken.";
  if (error.status === 404) return "Ticket or Action was not found.";
  if (error.code === "STALE_VERSION") return "Someone else changed this Action while you were editing. Your draft is preserved. Choose Reload current Action to review the latest version before saving.";
  if (error.code === "ASSIGNMENT_CONFLICT") return "The selected assignee is no longer active or eligible. Choose an active Staff member or Administrator.";
  if (error.code === "INVALID_ACTION_TRANSITION") return "That Action status change is not allowed. Refresh the Action and try again.";
  if (error.code === "ACTION_READ_ONLY") return "This Action or Ticket is read-only.";
  return error.message || fallback;
}

function createFieldErrors(draft: ActionDraft, assignees: StaffAssignee[], resultRequired = false): FieldErrors {
  const errors: FieldErrors = {};
  const description = draft.description.trim();
  const result = draft.result.trim();
  const note = draft.followUpNote.trim();
  const attachmentNotes = draft.attachmentNotes.trim();
  if (description.length < 5 || description.length > 2000) errors.description = "Enter a description between 5 and 2,000 characters.";
  if (!assignees.some((assignee) => String(assignee.id) === draft.assigneeUserId)) errors.assigneeUserId = "Choose an active Staff member or Administrator as the Action assignee.";
  if (result.length > 2000) errors.result = "Result cannot exceed 2,000 characters.";
  else if (resultRequired && result.length < 5) errors.result = "Enter a result of at least 5 characters to complete this Action.";
  else if (result.length > 0 && result.length < 5) errors.result = "Enter at least 5 characters, or leave Result blank.";
  if (note.length > 2000) errors.followUpNote = "Follow-up Note cannot exceed 2,000 characters.";
  else if (draft.followUpRequired && note.length < 5) errors.followUpNote = "Follow-up is required. Enter a note with at least 5 characters.";
  else if (note.length > 0 && note.length < 5) errors.followUpNote = "Enter at least 5 characters, or clear Follow-up Note.";
  if (attachmentNotes.length > 1000) errors.attachmentNotes = "Attachment Notes cannot exceed 1,000 characters.";
  return errors;
}

function toCreateInput(draft: ActionDraft, ticketVersion: number, clientRequestId: string): CreateActionTakenInput {
  return {
    clientRequestId,
    expectedTicketVersion: ticketVersion,
    description: draft.description.trim(),
    assigneeUserId: Number(draft.assigneeUserId),
    ...(draft.result.trim() ? { result: draft.result.trim() } : {}),
    followUpRequired: draft.followUpRequired,
    ...(draft.followUpNote.trim() ? { followUpNote: draft.followUpNote.trim() } : {}),
    ...(draft.attachmentNotes.trim() ? { attachmentNotes: draft.attachmentNotes.trim() } : {}),
  };
}

function fromAction(action: ActionRecord): ActionDraft {
  return {
    description: action.description,
    assigneeUserId: String(action.assignee.id),
    result: action.result ?? "",
    followUpRequired: action.followUpRequired,
    followUpNote: action.followUpNote ?? "",
    attachmentNotes: action.attachmentNotes ?? "",
  };
}

function identityLabel(identity: { name: string; email: string }): string {
  return `${identity.name} (${identity.email})`;
}

export default function ActionsTaken({ ticketNumber, readOnly = false, currentUserId }: ActionsTakenProps) {
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [ticketVersion, setTicketVersion] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TicketListPageSize>(25);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [listState, setListState] = useState<"loading" | "success" | "error">("loading");
  const [listError, setListError] = useState<string | null>(null);
  const [listRetry, setListRetry] = useState(0);
  const [assignees, setAssignees] = useState<StaffAssignee[]>([]);
  const [assigneeState, setAssigneeState] = useState<"loading" | "success" | "error">(readOnly ? "success" : "loading");
  const [assigneeRetry, setAssigneeRetry] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<ActionDraft>(emptyDraft);
  const [createErrors, setCreateErrors] = useState<FieldErrors>({});
  const [createError, setCreateError] = useState<string | null>(null);
  const [uncertainCreate, setUncertainCreate] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const createBusyRef = useRef(false);
  const createRequestId = useRef<string | null>(null);
  const retryCreatePayload = useRef<CreateActionTakenInput | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<ActionDraft>(emptyDraft);
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const editBusyRef = useRef(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [focusActionId, setFocusActionId] = useState<number | null>(null);
  const createHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const createButtonRef = useRef<HTMLButtonElement | null>(null);
  const editHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const actionHeadingRefs = useRef<Record<number, HTMLHeadingElement | null>>({});
  const editButtonRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const cancelDialogRef = useRef<HTMLTextAreaElement | null>(null);

  const loadActions = useCallback(async (requestedPage = page) => {
    setListState("loading");
    setListError(null);
    try {
      const result = await fetchActionsTaken(ticketNumber, requestedPage, pageSize);
      setActions(result.actions.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id));
      setTicketVersion(result.ticketVersion);
      setTotalItems(result.pagination.totalItems);
      setTotalPages(result.pagination.totalPages);
      setListState("success");
    } catch (error) {
      setListError(errorMessage(error, "Unable to load Actions Taken."));
      setListState("error");
    }
  }, [page, pageSize, ticketNumber]);

  useEffect(() => { void loadActions(page); }, [loadActions, listRetry, page]);

  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    setAssigneeState("loading");
    void fetchStaffAssignees().then((loaded) => {
      if (cancelled) return;
      setAssignees(loaded);
      setAssigneeState("success");
      if (currentUserId && loaded.some((candidate) => candidate.id === currentUserId)) {
        setCreateDraft((current) => current.assigneeUserId ? current : { ...current, assigneeUserId: String(currentUserId) });
      }
    }).catch(() => {
      if (!cancelled) setAssigneeState("error");
    });
    return () => { cancelled = true; };
  }, [assigneeRetry, currentUserId, readOnly]);

  useEffect(() => {
    if (createOpen) createHeadingRef.current?.focus();
  }, [createOpen]);
  useEffect(() => {
    if (editingId !== null) editHeadingRef.current?.focus();
  }, [editingId]);
  useEffect(() => {
    if (confirmAction?.kind === "cancel") cancelDialogRef.current?.focus();
  }, [confirmAction]);
  useEffect(() => {
    if (focusActionId === null || !actions.some((action) => action.id === focusActionId)) return;
    const targetId = focusActionId;
    setFocusActionId(null);
    window.setTimeout(() => actionHeadingRefs.current[targetId]?.focus(), 0);
  }, [actions, focusActionId]);
  useEffect(() => {
    const first = Object.keys(createErrors)[0] as keyof ActionDraft | undefined;
    if (first) document.getElementById(`create-${first}`)?.focus();
  }, [createErrors]);
  useEffect(() => {
    const first = Object.keys(editErrors)[0] as keyof ActionDraft | undefined;
    if (first) document.getElementById(`edit-${editingId}-${first}`)?.focus();
  }, [editErrors, editingId]);

  function newRequestId(): string {
    if (!createRequestId.current) createRequestId.current = crypto.randomUUID();
    return createRequestId.current;
  }

  function openCreate() {
    createRequestId.current = crypto.randomUUID();
    retryCreatePayload.current = null;
    setUncertainCreate(false);
    setCreateDraft({ ...emptyDraft(), assigneeUserId: currentUserId && assignees.some((assignee) => assignee.id === currentUserId) ? String(currentUserId) : "" });
    setCreateErrors({});
    setCreateError(null);
    setSuccess(null);
    setCreateOpen(true);
  }

  function updateCreateDraft(next: ActionDraft) {
    setCreateDraft(next);
    setCreateErrors({});
    if (!uncertainCreate) createRequestId.current = crypto.randomUUID();
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (createBusyRef.current) return;
    const fieldErrors = createFieldErrors(createDraft, assignees);
    if (Object.keys(fieldErrors).length > 0) {
      setCreateErrors(fieldErrors);
      setCreateError("Fix the errors shown under the fields, then choose Save Action again.");
      return;
    }
    const payload = retryCreatePayload.current ?? toCreateInput(createDraft, ticketVersion, newRequestId());
    createBusyRef.current = true;
    setCreateBusy(true);
    setCreateError(null);
    setSuccess(null);
    try {
      const saved = await createActionTaken(ticketNumber, payload);
      setTicketVersion(saved.ticketVersion);
      setRevisionStates({});
      setFocusActionId(saved.action.id);
      retryCreatePayload.current = null;
      createRequestId.current = null;
      setUncertainCreate(false);
      setCreateOpen(false);
      setCreateDraft(emptyDraft());
      setCreateErrors({});
      const nextPage = totalItems === 0 ? 1 : Math.ceil((totalItems + 1) / pageSize);
      setPage(nextPage);
      if (nextPage === page) await loadActions(nextPage);
      else setListState("loading");
      setSuccess("Action saved.");
    } catch (error) {
      const apiError = error instanceof ApiClientError ? error : null;
      if (apiError?.fieldErrors) setCreateErrors(apiError.fieldErrors as FieldErrors);
      if (!apiError || apiError.status === 0 || apiError.status >= 500 || apiError.code === "IDEMPOTENCY_KEY_REUSED") {
        retryCreatePayload.current = payload;
        setUncertainCreate(true);
        setCreateError("We couldn't confirm whether the Action was saved. Your details are locked to prevent a duplicate. Choose Retry Save to safely check the same request.");
      } else {
        setCreateError(apiError?.fieldErrors ? "Fix the errors listed below, then choose Save Action again." : errorMessage(error, "Unable to save Action."));
        if (apiError.code === "STALE_VERSION") setListRetry((value) => value + 1);
      }
    } finally {
      createBusyRef.current = false;
      setCreateBusy(false);
    }
  }

  function openEdit(action: ActionRecord) {
    setEditingId(action.id);
    setEditDraft(fromAction(action));
    setEditErrors({});
    setEditError(null);
    setMutationError(null);
    setSuccess(null);
  }

  function closeEdit() {
    if (editBusyRef.current) return;
    const id = editingId;
    setEditingId(null);
    setEditErrors({});
    setEditError(null);
    if (id !== null) window.setTimeout(() => editButtonRefs.current[id]?.focus(), 0);
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>, action: ActionRecord) {
    event.preventDefault();
    if (editBusyRef.current) return;
    const fieldErrors = createFieldErrors(editDraft, assignees, action.status === "COMPLETED");
    if (action.status === "COMPLETED") delete fieldErrors.assigneeUserId;
    if (Object.keys(fieldErrors).length > 0) {
      setEditErrors(fieldErrors);
      setEditError("Fix the errors shown under the fields, then choose Save Action again.");
      return;
    }
    const payload: UpdateActionTakenInput = {
      expectedTicketVersion: ticketVersion,
      expectedActionVersion: action.version,
      description: editDraft.description.trim(),
      ...(action.status === "COMPLETED" ? {} : { assigneeUserId: Number(editDraft.assigneeUserId) }),
      result: editDraft.result.trim(),
      followUpRequired: editDraft.followUpRequired,
      followUpNote: editDraft.followUpNote.trim(),
      attachmentNotes: editDraft.attachmentNotes.trim(),
    };
    editBusyRef.current = true;
    setEditBusy(true);
    setEditError(null);
    setMutationError(null);
    setSuccess(null);
    try {
      const saved = await updateActionTaken(ticketNumber, action.id, payload);
      setTicketVersion(saved.ticketVersion);
      setRevisionStates({});
      setEditingId(null);
      setSuccess("Action updated.");
      await loadActions(page);
      setFocusActionId(action.id);
    } catch (error) {
      const apiError = error instanceof ApiClientError ? error : null;
      if (apiError?.fieldErrors) setEditErrors(apiError.fieldErrors as FieldErrors);
      setEditError(apiError?.fieldErrors ? "Fix the errors listed below, then choose Save Action again." : errorMessage(error, "Unable to update Action."));
    } finally {
      editBusyRef.current = false;
      setEditBusy(false);
    }
  }

  async function reloadCurrentAction() {
    if (editingId === null) return;
    setEditError(null);
    try {
      const result = await fetchActionsTaken(ticketNumber, page, pageSize);
      setActions(result.actions);
      setTicketVersion(result.ticketVersion);
      const current = result.actions.find((action) => action.id === editingId);
      if (!current) {
        setEditingId(null);
        setMutationError("This Action is no longer available. Refresh the Ticket Detail.");
        return;
      }
      setEditDraft(fromAction(current));
      setEditErrors({});
      setSuccess("Current Action loaded. Review the refreshed values before saving.");
    } catch (error) {
      setEditError(errorMessage(error, "Unable to reload current Action."));
    }
  }

  async function changeStatus(action: ActionRecord, status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED", cancellationReason?: string) {
    if (editBusyRef.current) return;
    editBusyRef.current = true;
    setEditBusy(true);
    setMutationError(null);
    setSuccess(null);
    try {
      const saved = await updateActionTaken(ticketNumber, action.id, {
        expectedTicketVersion: ticketVersion,
        expectedActionVersion: action.version,
        status,
        ...(status === "COMPLETED" && action.result ? { result: action.result } : {}),
        ...(cancellationReason ? { cancellationReason } : {}),
      });
      setTicketVersion(saved.ticketVersion);
      setRevisionStates({});
      setConfirmAction(null);
      setCancelReason("");
      setSuccess(status === "IN_PROGRESS" ? "Action started." : status === "COMPLETED" ? "Action completed." : "Action cancelled.");
      await loadActions(page);
      setFocusActionId(action.id);
    } catch (error) {
      setMutationError(errorMessage(error, "Unable to update Action."));
    } finally {
      editBusyRef.current = false;
      setEditBusy(false);
    }
  }

  function confirmCompletion(action: ActionRecord) {
    if (!action.result || action.result.trim().length < 5 || action.result.trim().length > 2000) {
      setMutationError("Before completing this Action, edit it and enter a Result of 5 to 2,000 characters.");
      return;
    }
    setMutationError(null);
    setConfirmAction({ kind: "complete", action });
  }

  async function confirmCancellation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmAction?.kind !== "cancel" || editBusyRef.current) return;
    const reason = cancelReason.trim();
    if (reason.length < 5 || reason.length > 250) {
      setCancelError("Enter a cancellation reason between 5 and 250 characters.");
      return;
    }
    setCancelError(null);
    await changeStatus(confirmAction.action, "CANCELLED", reason);
  }

  async function loadRevisions(actionId: number) {
    setRevisionStates((states) => ({ ...states, [actionId]: { open: true, loading: true, error: null, revisions: states[actionId]?.revisions ?? [] } }));
    try {
      const result = await fetchActionRevisions(ticketNumber, actionId);
      setRevisionStates((current) => ({ ...current, [actionId]: { open: true, loading: false, error: null, revisions: result.revisions } }));
    } catch (error) {
      setRevisionStates((current) => ({ ...current, [actionId]: { ...current[actionId], open: true, loading: false, error: errorMessage(error, "Unable to load Action history."), revisions: [] } }));
    }
  }

  const [revisionStates, setRevisionStates] = useState<Record<number, RevisionState>>({});
  function toggleRevisions(actionId: number) {
    const current = revisionStates[actionId];
    if (current?.open) {
      setRevisionStates((states) => ({ ...states, [actionId]: { ...current, open: false } }));
    } else if (current && !current.error) {
      setRevisionStates((states) => ({ ...states, [actionId]: { ...current, open: true } }));
    } else {
      void loadRevisions(actionId);
    }
  }

  function renderFields(draft: ActionDraft, setDraft: (next: ActionDraft) => void, errors: FieldErrors, disabled: boolean, allowAssignee = true, prefix = "create", resultRequired = false) {
    const fieldId = (name: keyof ActionDraft) => `${prefix}-${name}`;
    const errorId = (name: keyof ActionDraft) => `${fieldId(name)}-error`;
    return <div className="zen-form-grid action-taken-form-grid">
      <p className="zen-help action-field-key"><span className="action-required-symbol" aria-hidden="true">*</span> Required. Fields marked (optional) may be left blank.</p>
      <div className="zen-field zen-field-wide">
        <label className="action-required-label" htmlFor={fieldId("description")}>Description</label>
        <textarea id={fieldId("description")} className="zen-input zen-textarea" value={draft.description} maxLength={2000} disabled={disabled} required aria-required="true" onChange={(event) => setDraft({ ...draft, description: event.target.value })} aria-invalid={Boolean(errors.description)} aria-describedby={`${fieldId("description")}-help${errors.description ? ` ${errorId("description")}` : ""}`} />
        <span id={`${fieldId("description")}-help`} className="zen-help">Enter 5 to 2,000 characters.</span>
        {errors.description && <p id={errorId("description")} className="zen-field-error" role="alert">{errors.description}</p>}
      </div>
      {allowAssignee && <div className="zen-field">
        <label className="action-required-label" htmlFor={fieldId("assigneeUserId")}>Assignee</label>
        <select id={fieldId("assigneeUserId")} className="zen-input" value={draft.assigneeUserId} disabled={disabled || assigneeState !== "success"} required aria-required="true" onChange={(event) => setDraft({ ...draft, assigneeUserId: event.target.value })} aria-invalid={Boolean(errors.assigneeUserId)} aria-describedby={`${fieldId("assigneeUserId")}-help${errors.assigneeUserId ? ` ${errorId("assigneeUserId")}` : ""}`}>
          <option value="">Choose an active Staff member or Administrator</option>
          {assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name} ({assignee.role.replace("_", " ")})</option>)}
        </select>
        {assigneeState === "loading" && <span className="zen-help" role="status">Loading eligible assignees...</span>}
        {assigneeState === "error" && <div className="zen-state zen-state-error" role="alert"><p>Unable to load eligible assignees.</p><button className="zen-button zen-button-secondary" type="button" onClick={() => setAssigneeRetry((value) => value + 1)}>Retry assignees</button></div>}
        {errors.assigneeUserId && <p id={errorId("assigneeUserId")} className="zen-field-error" role="alert">{errors.assigneeUserId}</p>}
        <span id={`${fieldId("assigneeUserId")}-help`} className="zen-help">Choose an active Staff member or Administrator. This is the Action assignee, not the Ticket Owner.</span>
      </div>}
      <div className="zen-field">
        <label className={resultRequired ? "action-required-label" : undefined} htmlFor={fieldId("result")}>Result {!resultRequired && <span className="action-optional-label">(optional)</span>}</label>
        <textarea id={fieldId("result")} className="zen-input zen-textarea" value={draft.result} maxLength={2000} disabled={disabled} required={resultRequired} aria-required={resultRequired} onChange={(event) => setDraft({ ...draft, result: event.target.value })} aria-invalid={Boolean(errors.result)} aria-describedby={`${fieldId("result")}-help${errors.result ? ` ${errorId("result")}` : ""}`} />
        <span id={`${fieldId("result")}-help`} className="zen-help">{resultRequired ? "Enter 5 to 2,000 characters; every completed Action needs a Result." : "Optional until completion. If provided, enter 5 to 2,000 characters."}</span>
        {errors.result && <p id={errorId("result")} className="zen-field-error" role="alert">{errors.result}</p>}
      </div>
      <div className="zen-field">
        <label className="zen-checkbox-label" htmlFor={fieldId("followUpRequired")}><input id={fieldId("followUpRequired")} type="checkbox" checked={draft.followUpRequired} disabled={disabled} aria-describedby={`${fieldId("followUpRequired")}-help`} onChange={(event) => setDraft({ ...draft, followUpRequired: event.target.checked })} /> Follow-up required</label>
        <span id={`${fieldId("followUpRequired")}-help`} className="zen-help">If selected, a Follow-up Note is required.</span>
      </div>
      {(draft.followUpRequired || draft.followUpNote) && <div className="zen-field">
        <label className={draft.followUpRequired ? "action-required-label" : undefined} htmlFor={fieldId("followUpNote")}>Follow-up Note {!draft.followUpRequired && <span className="action-optional-label">(optional)</span>}</label>
        <textarea id={fieldId("followUpNote")} className="zen-input zen-textarea" value={draft.followUpNote} maxLength={2000} disabled={disabled} required={draft.followUpRequired} aria-required={draft.followUpRequired} onChange={(event) => setDraft({ ...draft, followUpNote: event.target.value })} aria-invalid={Boolean(errors.followUpNote)} aria-describedby={`${fieldId("followUpNote")}-help${errors.followUpNote ? ` ${errorId("followUpNote")}` : ""}`} />
        <span id={`${fieldId("followUpNote")}-help`} className="zen-help">{draft.followUpRequired ? "Required because Follow-up required is selected; enter 5 to 2,000 characters." : "Optional. If entered, use 5 to 2,000 characters."}</span>
        {errors.followUpNote && <p id={errorId("followUpNote")} className="zen-field-error" role="alert">{errors.followUpNote}</p>}
      </div>}
      <div className="zen-field">
        <label htmlFor={fieldId("attachmentNotes")}>Attachment Notes <span className="action-optional-label">(optional)</span></label>
        <input id={fieldId("attachmentNotes")} className="zen-input" value={draft.attachmentNotes} maxLength={1000} disabled={disabled} aria-required="false" onChange={(event) => setDraft({ ...draft, attachmentNotes: event.target.value })} aria-invalid={Boolean(errors.attachmentNotes)} aria-describedby={`${fieldId("attachmentNotes")}-help${errors.attachmentNotes ? ` ${errorId("attachmentNotes")}` : ""}`} />
        <span id={`${fieldId("attachmentNotes")}-help`} className="zen-help">Optional; up to 1,000 characters. Enter filenames or references only, never storage paths.</span>
        {errors.attachmentNotes && <p id={errorId("attachmentNotes")} className="zen-field-error" role="alert">{errors.attachmentNotes}</p>}
      </div>
    </div>;
  }

  return <section className="zen-comment-section actions-taken" aria-labelledby="actions-taken-heading">
    <div className="zen-section-heading"><div><p className="zen-eyebrow">Public work record</p><h2 id="actions-taken-heading">Actions Taken</h2></div>{!readOnly && <button ref={createButtonRef} className="zen-button zen-button-primary" type="button" onClick={openCreate} disabled={createOpen || editingId !== null}>Create Action</button>}</div>
    {listState === "loading" && <p className="zen-state zen-state-info" role="status">Loading Actions Taken...</p>}
    {listState === "error" && <div className="zen-state zen-state-error" role="alert"><p>{listError}</p><button className="zen-button zen-button-secondary" type="button" onClick={() => setListRetry((value) => value + 1)}>Retry Actions</button></div>}
    {listState === "success" && totalItems === 0 && <p className="zen-state zen-state-info" role="status">No Actions Taken have been recorded for this Ticket.</p>}
    {listState === "success" && actions.length > 0 && <>
      <p className="zen-help">{totalItems} Action{totalItems === 1 ? "" : "s"}. Assignees are responsible for their Action; Ticket Owner remains separate.</p>
      <ol className="action-taken-list" aria-label="Ticket Actions Taken">
        {actions.map((action) => {
          const revision = revisionStates[action.id];
          const editing = editingId === action.id;
          return <li className="action-taken-card" key={action.id}>
            <div className="action-taken-record">
              <div className="action-taken-heading"><h3 id={`action-heading-${action.id}`} ref={(element) => { actionHeadingRefs.current[action.id] = element; }} tabIndex={-1}>{action.description}</h3><span className="zen-status-badge">{action.status}</span></div>
              <dl className="action-taken-meta">
                <div><dt>Action Date</dt><dd>{formatDate(action.createdAt)}</dd></div>
                <div><dt>Assignee</dt><dd>{identityLabel(action.assignee)}</dd></div>
                <div><dt>Created by</dt><dd>{identityLabel(action.createdBy)}</dd></div>
                <div><dt>Performed by</dt><dd>{action.performedBy ? identityLabel(action.performedBy) : "Not completed"}</dd></div>
                <div><dt>Completed</dt><dd>{formatDate(action.completedAt)}</dd></div>
                <div><dt>Follow-up required</dt><dd>{action.followUpRequired ? "Yes" : "No"}</dd></div>
                <div><dt>Follow-up Note</dt><dd>{action.followUpNote ?? "Not recorded"}</dd></div>
                <div><dt>Attachment Notes</dt><dd>{action.attachmentNotes ?? "Not recorded"}</dd></div>
                <div><dt>Updated</dt><dd>{formatDate(action.updatedAt)}</dd></div>
                <div className="action-taken-wide"><dt>Result</dt><dd>{action.result ?? "Not recorded"}</dd></div>
                {action.cancellationReason && <div className="action-taken-wide"><dt>Cancellation reason</dt><dd>{action.cancellationReason}; cancelled {formatDate(action.cancelledAt)}</dd></div>}
              </dl>
              <button className="zen-button zen-button-link" type="button" aria-expanded={Boolean(revision?.open)} onClick={() => toggleRevisions(action.id)}>{revision?.open ? "Hide revision history" : "Show revision history"}</button>
              {!readOnly && <div className="action-taken-actions">
                {action.status !== "CANCELLED" && <button ref={(element) => { editButtonRefs.current[action.id] = element; }} className="zen-button zen-button-secondary" type="button" onClick={() => openEdit(action)} disabled={editBusy}>Edit Action</button>}
                {action.status === "OPEN" && <button className="zen-button zen-button-secondary" type="button" onClick={() => void changeStatus(action, "IN_PROGRESS")} disabled={editBusy}>Start Work</button>}
                {(action.status === "OPEN" || action.status === "IN_PROGRESS") && <><button className="zen-button zen-button-primary" type="button" onClick={() => confirmCompletion(action)} disabled={editBusy}>Complete Action</button><button className="zen-button zen-button-link" type="button" onClick={() => { setCancelReason(""); setCancelError(null); setConfirmAction({ kind: "cancel", action }); }} disabled={editBusy}>Cancel Action</button></>}
              </div>}
            </div>
            {editing && <form className="action-taken-editor" aria-label={`Edit Action ${action.id}`} onSubmit={(event) => void submitEdit(event, action)} noValidate>
              <h4 ref={editHeadingRef} tabIndex={-1}>Edit Action</h4>
              {renderFields(editDraft, setEditDraft, editErrors, editBusy, action.status !== "COMPLETED", `edit-${action.id}`, action.status === "COMPLETED")}
              {editError && <div className="zen-state zen-state-error" role="alert"><p>{editError}</p>{editError.includes("latest version") && <button className="zen-button zen-button-secondary" type="button" onClick={() => void reloadCurrentAction()}>Reload current Action</button>}</div>}
              <div className="zen-form-actions"><button className="zen-button zen-button-secondary" type="button" onClick={closeEdit} disabled={editBusy}>Cancel edit</button><button className="zen-button zen-button-primary" type="submit" disabled={editBusy || (action.status !== "COMPLETED" && assigneeState !== "success")}>{editBusy ? "Saving..." : "Save Action"}</button></div>
            </form>}
            {revision?.open && <div className="action-revision-history" aria-label={`Revision history for Action ${action.id}`}>
              {revision.loading ? <p className="zen-state zen-state-info" role="status">Loading Action history...</p> : revision.error ? <div className="zen-state zen-state-error" role="alert"><p>{revision.error}</p><button className="zen-button zen-button-secondary" type="button" onClick={() => void loadRevisions(action.id)}>Retry history</button></div> : revision.revisions.length === 0 ? <p className="zen-state zen-state-info" role="status">No Action revisions have been recorded.</p> : <ol className="action-revision-list" aria-label="Action revision history">{revision.revisions.map((item) => <li key={item.id}><h4>Revision {item.revisionNumber}</h4><p>Changed {formatDate(item.changedAt)} by {identityLabel(item.actor)}</p><dl><div><dt>Description</dt><dd>{item.snapshot.description}</dd></div><div><dt>Result</dt><dd>{item.snapshot.result ?? "Not recorded"}</dd></div><div><dt>Status</dt><dd>{item.snapshot.status}</dd></div><div><dt>Follow-up required</dt><dd>{item.snapshot.followUpRequired ? "Yes" : "No"}</dd></div><div><dt>Follow-up Note</dt><dd>{item.snapshot.followUpNote ?? "Not recorded"}</dd></div><div><dt>Attachment Notes</dt><dd>{item.snapshot.attachmentNotes ?? "Not recorded"}</dd></div><div><dt>Cancellation reason</dt><dd>{item.snapshot.cancellationReason ?? "Not recorded"}</dd></div></dl></li>)}</ol>}
            </div>}
          </li>;
        })}
      </ol>
      {totalPages > 0 && <div className="action-taken-pagination"><label htmlFor="actions-page-size">Actions per page</label><select id="actions-page-size" className="zen-input" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value) as TicketListPageSize); setPage(1); }}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select><span>Page {page} of {totalPages}</span><button className="zen-button zen-button-secondary" type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>Previous Actions</button><button className="zen-button zen-button-secondary" type="button" onClick={() => setPage((value) => value + 1)} disabled={page >= totalPages}>Next Actions</button></div>}
    </>}
    {createOpen && !readOnly && <form className="action-taken-editor" aria-label="Create Action form" onSubmit={(event) => void submitCreate(event)} noValidate>
      <h3 ref={createHeadingRef} tabIndex={-1}>Create Action</h3>
      {renderFields(createDraft, updateCreateDraft, createErrors, createBusy || uncertainCreate, true, "create")}
      {createError && <div className="zen-state zen-state-error" role="alert"><p>{createError}</p>{uncertainCreate && <button className="zen-button zen-button-secondary" type="button" onClick={(event) => event.currentTarget.closest("form")?.requestSubmit()} disabled={createBusy}>Retry Save</button>}</div>}
      <div className="zen-form-actions"><button className="zen-button zen-button-secondary" type="button" onClick={() => { if (!uncertainCreate) { setCreateOpen(false); setCreateErrors({}); setCreateError(null); window.setTimeout(() => createButtonRef.current?.focus(), 0); } }} disabled={createBusy || uncertainCreate}>Cancel</button><button className="zen-button zen-button-primary" type="submit" disabled={createBusy || uncertainCreate || assigneeState !== "success"}>{createBusy ? "Saving..." : "Save Action"}</button></div>
    </form>}
    {success && <p className="zen-state zen-state-success" role="status">{success}</p>}
    {mutationError && <p className="zen-state zen-state-error" role="alert">{mutationError}</p>}
    {!readOnly && !createOpen && assigneeState === "error" && <div className="zen-state zen-state-error" role="alert"><p>Unable to load eligible assignees.</p><button className="zen-button zen-button-secondary" type="button" onClick={() => setAssigneeRetry((value) => value + 1)}>Retry assignees</button></div>}
    {confirmAction?.kind === "complete" && <div className="zen-modal-backdrop"><div className="zen-removal-dialog" role="dialog" aria-modal="true" aria-labelledby="complete-action-heading"><h3 id="complete-action-heading">Complete Action?</h3><p>Completing records the Result, your name as the performer, and the completion time.</p><div className="zen-form-actions"><button className="zen-button zen-button-secondary" type="button" onClick={() => setConfirmAction(null)} disabled={editBusy}>Keep working</button><button className="zen-button zen-button-primary" type="button" onClick={() => void changeStatus(confirmAction.action, "COMPLETED")} disabled={editBusy}>{editBusy ? "Saving..." : "Confirm completion"}</button></div></div></div>}
    {confirmAction?.kind === "cancel" && <div className="zen-modal-backdrop"><div className="zen-removal-dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-action-heading"><h3 id="cancel-action-heading">Cancel Action?</h3><p>The Action will be marked CANCELLED. Its reason will remain visible in the Action history.</p><form onSubmit={(event) => void confirmCancellation(event)} noValidate><div className="zen-field"><label className="action-required-label" htmlFor="action-cancellation-reason">Cancellation reason</label><textarea id="action-cancellation-reason" ref={cancelDialogRef} className="zen-input zen-textarea" value={cancelReason} maxLength={250} required aria-required="true" onChange={(event) => setCancelReason(event.target.value)} aria-invalid={Boolean(cancelError)} aria-describedby={cancelError ? "action-cancellation-help action-cancellation-error" : "action-cancellation-help"} /><span id="action-cancellation-help" className="zen-help">Required; enter 5 to 250 characters.</span>{cancelError && <p id="action-cancellation-error" className="zen-field-error" role="alert">{cancelError}</p>}</div><div className="zen-form-actions"><button className="zen-button zen-button-secondary" type="button" onClick={() => setConfirmAction(null)} disabled={editBusy}>Keep Action</button><button className="zen-button zen-button-primary" type="submit" disabled={editBusy}>{editBusy ? "Saving..." : "Confirm cancellation"}</button></div></form></div></div>}
  </section>;
}
