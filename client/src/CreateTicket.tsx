import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import {
  ApiClientError,
  Category,
  RelatedSystem,
  Requester,
  TicketPriority,
  createTicket,
  fetchCategories,
  fetchRelatedSystems,
} from "./api.js";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

const PRIORITIES: TicketPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

interface CreateTicketPageProps {
  requester: Requester;
  navigate: (path: string) => void;
}

interface FormValues {
  categoryId: string;
  relatedSystemId: string;
  requestedPriority: TicketPriority | "";
  summary: string;
  description: string;
}

type ReferenceState = "loading" | "ready" | "error";

function extensionFor(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot < 0 ? "" : fileName.slice(lastDot).toLowerCase();
}

function signatureMatches(extension: string, bytes: Uint8Array): boolean {
  if (extension === ".jpg" || extension === ".jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (extension === ".png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((byte, index) => bytes[index] === byte);
  }
  if (extension === ".webp") {
    return (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
}

function metadataError(file: File): string | null {
  const extension = extensionFor(file.name);
  const expectedMime = MIME_BY_EXTENSION[extension];
  if (!expectedMime || file.type.toLowerCase() !== expectedMime) {
    return "Attachments must use a supported extension and matching MIME type (JPG, PNG, WEBP, or PDF).";
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return "Each attachment must be no larger than 5 MiB.";
  }
  return null;
}

async function signatureError(file: File): Promise<string | null> {
  const extension = extensionFor(file.name);
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return signatureMatches(extension, bytes)
      ? null
      : "Attachment content does not match its declared file signature.";
  } catch {
    return "Attachment content could not be read.";
  }
}

function formatTicketDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

export default function CreateTicketPage({ requester, navigate }: CreateTicketPageProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedSystems, setRelatedSystems] = useState<RelatedSystem[]>([]);
  const [referenceState, setReferenceState] = useState<ReferenceState>("loading");
  const [formValues, setFormValues] = useState<FormValues>({
    categoryId: "",
    relatedSystemId: "",
    requestedPriority: "",
    summary: "",
    description: "",
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdTicket, setCreatedTicket] = useState<Awaited<ReturnType<typeof createTicket>>["ticket"] | null>(null);
  const submittingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadReferences = useCallback(async () => {
    setReferenceState("loading");
    try {
      const [loadedCategories, loadedSystems] = await Promise.all([
        fetchCategories(),
        fetchRelatedSystems(),
      ]);
      setCategories(loadedCategories);
      setRelatedSystems(loadedSystems);
      setReferenceState("ready");
    } catch {
      setCategories([]);
      setRelatedSystems([]);
      setReferenceState("error");
    }
  }, []);

  useEffect(() => {
    void loadReferences();
  }, [loadReferences]);

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setFormValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setFormError(null);
  }

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (incoming.length === 0) return;

    if (attachments.length + incoming.length > MAX_ATTACHMENTS) {
      setFileError("A Ticket may include at most five active attachments.");
      return;
    }

    const invalid = incoming.find((file) => metadataError(file));
    if (invalid) {
      setFileError(metadataError(invalid));
      return;
    }

    setAttachments((current) => [...current, ...incoming]);
    setFileError(null);
    setFormError(null);
  }

  function removeAttachment(index: number) {
    setAttachments((current) => current.filter((_, attachmentIndex) => attachmentIndex !== index));
    setFileError(null);
  }

  function focusFirstError(errors: Record<string, string>) {
    const firstField = Object.keys(errors)[0];
    if (firstField) {
      document.getElementById(firstField)?.focus();
    }
  }

  async function validateForm(): Promise<Record<string, string>> {
    const errors: Record<string, string> = {};
    const summary = formValues.summary.trim();
    const description = formValues.description.trim();

    if (!formValues.categoryId) errors.categoryId = "Category is required.";
    if (!formValues.relatedSystemId) errors.relatedSystemId = "Related System is required.";
    if (!formValues.requestedPriority) errors.requestedPriority = "Requested Priority is required.";
    if (summary.length < 5 || summary.length > 120) {
      errors.summary = "Summary must be 5–120 characters after trimming.";
    }
    if (description.length < 10 || description.length > 5000) {
      errors.description = "Description must be 10–5000 characters after trimming.";
    }
    if (attachments.length > MAX_ATTACHMENTS) {
      errors.attachments = "A Ticket may include at most five active attachments.";
    }

    for (const file of attachments) {
      const error = metadataError(file) ?? (await signatureError(file));
      if (error) {
        errors.attachments = error;
        break;
      }
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || submitting || referenceState !== "ready") return;

    // Lock synchronously before validation yields so two rapid activations
    // cannot both pass the client-side guard.
    submittingRef.current = true;
    setSubmitting(true);

    setFormError(null);
    setCreatedTicket(null);
    const errors = await validateForm();
    setFieldErrors(errors);
    setFileError(errors.attachments ?? null);
    if (Object.keys(errors).length > 0) {
      submittingRef.current = false;
      setSubmitting(false);
      focusFirstError(errors);
      return;
    }

    try {
      const result = await createTicket(requester.id, {
        categoryId: Number(formValues.categoryId),
        relatedSystemId: Number(formValues.relatedSystemId),
        requestedPriority: formValues.requestedPriority as TicketPriority,
        summary: formValues.summary.trim(),
        description: formValues.description.trim(),
        attachments,
      });
      setCreatedTicket(result.ticket);
    } catch (error) {
      if (error instanceof ApiClientError) {
        setFieldErrors(error.fieldErrors ?? {});
        setFormError(error.message);
        focusFirstError(error.fieldErrors ?? {});
      } else {
        setFormError("Unable to create Ticket.");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const errorId = (field: keyof FormValues) => (fieldErrors[field] ? `${field}-error` : undefined);

  return (
    <section className="zen-card zen-ticket-card" aria-labelledby="create-ticket-heading">
      <p className="zen-eyebrow">Requester workspace</p>
      <h1 id="create-ticket-heading">Create Ticket</h1>
      <p className="zen-lead">Describe the issue and attach supporting evidence for the IT Service Desk.</p>

      {referenceState === "loading" && (
        <p className="zen-state zen-state-info" role="status" aria-live="polite">
          Loading Categories and Related Systems...
        </p>
      )}
      {referenceState === "error" && (
        <div className="zen-state zen-state-error" role="alert" aria-label="Reference data loading error">
          <p>Unable to load Ticket reference data.</p>
          <button className="zen-button zen-button-secondary" type="button" onClick={() => void loadReferences()}>
            Retry
          </button>
        </div>
      )}

      {createdTicket && (
        <div className="zen-state zen-state-success" role="status" aria-live="polite">
          <h2>Ticket created successfully</h2>
          <p>
            Ticket Number: <strong>{createdTicket.ticketNumber}</strong>
          </p>
          <p>Ticket Date: {formatTicketDate(createdTicket.createdAt)}</p>
          <p>Current Status: {createdTicket.status}</p>
          <button className="zen-button zen-button-secondary" type="button" onClick={() => navigate(`/tickets/${createdTicket.ticketNumber}`)}>
            View Ticket
          </button>
        </div>
      )}

      {formError && (
        <div className="zen-state zen-state-error" role="alert">
          <p>{formError}</p>
        </div>
      )}

      <form noValidate onSubmit={handleSubmit} aria-busy={submitting}>
        <div className="zen-form-grid">
          <div className="zen-field">
            <label htmlFor="requester">Requester</label>
            <input id="requester" className="zen-input zen-readonly" value={`${requester.name} (${requester.email})`} readOnly />
          </div>
          <div className="zen-field">
            <label htmlFor="ticket-number">Ticket Number</label>
            <input id="ticket-number" className="zen-input zen-readonly" value={createdTicket?.ticketNumber ?? "Assigned on submission"} readOnly />
          </div>
          <div className="zen-field">
            <label htmlFor="ticket-date">Ticket Date</label>
            <input id="ticket-date" className="zen-input zen-readonly" value={createdTicket ? formatTicketDate(createdTicket.createdAt) : "Assigned on submission"} readOnly />
          </div>
          <div className="zen-field">
            <label htmlFor="ticket-status">Current Status</label>
            <input id="ticket-status" className="zen-input zen-readonly" value={createdTicket?.status ?? "NEW after submission"} readOnly />
          </div>

          <div className="zen-field">
            <label htmlFor="categoryId">
              Category <span className="zen-required" aria-hidden="true">*</span>
            </label>
            <select
              id="categoryId"
              value={formValues.categoryId}
              onChange={(event) => updateField("categoryId", event.target.value)}
              disabled={referenceState !== "ready"}
              aria-invalid={Boolean(fieldErrors.categoryId)}
              aria-describedby={errorId("categoryId")}
            >
              <option value="">Choose a Category</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            {fieldErrors.categoryId && <p id="categoryId-error" className="zen-field-error" role="alert">{fieldErrors.categoryId}</p>}
          </div>

          <div className="zen-field">
            <label htmlFor="relatedSystemId">
              Related System <span className="zen-required" aria-hidden="true">*</span>
            </label>
            <select
              id="relatedSystemId"
              value={formValues.relatedSystemId}
              onChange={(event) => updateField("relatedSystemId", event.target.value)}
              disabled={referenceState !== "ready"}
              aria-invalid={Boolean(fieldErrors.relatedSystemId)}
              aria-describedby={errorId("relatedSystemId")}
            >
              <option value="">Choose a Related System</option>
              {relatedSystems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
            </select>
            {fieldErrors.relatedSystemId && <p id="relatedSystemId-error" className="zen-field-error" role="alert">{fieldErrors.relatedSystemId}</p>}
          </div>

          <div className="zen-field">
            <label htmlFor="requestedPriority">
              Requested Priority <span className="zen-required" aria-hidden="true">*</span>
            </label>
            <select
              id="requestedPriority"
              value={formValues.requestedPriority}
              onChange={(event) => updateField("requestedPriority", event.target.value as FormValues["requestedPriority"])}
              aria-invalid={Boolean(fieldErrors.requestedPriority)}
              aria-describedby={errorId("requestedPriority")}
            >
              <option value="">Choose a Priority</option>
              {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
            </select>
            {fieldErrors.requestedPriority && <p id="requestedPriority-error" className="zen-field-error" role="alert">{fieldErrors.requestedPriority}</p>}
          </div>

          <div className="zen-field zen-field-wide">
            <label htmlFor="summary">
              Summary <span className="zen-required" aria-hidden="true">*</span>
            </label>
            <input
              id="summary"
              className="zen-input"
              value={formValues.summary}
              minLength={5}
              maxLength={120}
              onChange={(event) => updateField("summary", event.target.value)}
              aria-invalid={Boolean(fieldErrors.summary)}
              aria-describedby={errorId("summary")}
            />
            <span className="zen-help">5–120 characters</span>
            {fieldErrors.summary && <p id="summary-error" className="zen-field-error" role="alert">{fieldErrors.summary}</p>}
          </div>

          <div className="zen-field zen-field-wide">
            <label htmlFor="description">
              Description <span className="zen-required" aria-hidden="true">*</span>
            </label>
            <textarea
              id="description"
              className="zen-input zen-textarea"
              value={formValues.description}
              minLength={10}
              maxLength={5000}
              rows={7}
              onChange={(event) => updateField("description", event.target.value)}
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={errorId("description")}
            />
            <span className="zen-help">10–5000 characters</span>
            {fieldErrors.description && <p id="description-error" className="zen-field-error" role="alert">{fieldErrors.description}</p>}
          </div>

          <div className="zen-field zen-field-wide">
            <label htmlFor="attachments">Attachments</label>
            <input
              id="attachments"
              ref={fileInputRef}
              className="zen-input zen-file-input"
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleAttachmentChange}
              aria-invalid={Boolean(fileError)}
              aria-describedby={fileError ? "attachments-error" : undefined}
            />
            <span className="zen-help">Optional. JPG, PNG, WEBP, or PDF; maximum 5 files, 5 MiB each.</span>
            {fileError && <p id="attachments-error" className="zen-field-error" role="alert">{fileError}</p>}
            {attachments.length > 0 && (
              <ul className="zen-file-list" aria-label="Selected attachments">
                {attachments.map((file, index) => (
                  <li key={`${file.name}-${file.lastModified}-${index}`}>
                    <span>{file.name} ({Math.ceil(file.size / 1024)} KiB)</span>
                    <button className="zen-button zen-button-link" type="button" onClick={() => removeAttachment(index)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="zen-form-actions">
          <button className="zen-button zen-button-secondary" type="button" onClick={() => navigate("/tickets")}>
            Cancel
          </button>
          <button className="zen-button zen-button-primary" type="submit" disabled={submitting || referenceState !== "ready"}>
            {submitting ? "Submitting Ticket..." : "Submit Ticket"}
          </button>
        </div>
      </form>
    </section>
  );
}
