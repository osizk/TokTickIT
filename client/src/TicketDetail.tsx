import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import {
  ApiClientError,
  Requester,
  TicketAttachment,
  TicketDetail as TicketDetailData,
  addTicketAttachment,
  downloadTicketAttachment,
  fetchTicket,
  fetchTicketAttachments,
  removeTicketAttachment,
} from "./api.js";

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

interface TicketDetailProps {
  requester: Requester;
  ticketNumber: string;
  navigate: (path: string) => void;
}

type LoadState = "loading" | "success" | "error";

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

function validateAttachmentMetadata(file: File): string | null {
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

async function validateAttachmentSignature(file: File): Promise<string | null> {
  try {
    const bytes = await readFileBytes(file);
    return signatureMatches(extensionFor(file.name), bytes)
      ? null
      : "Attachment content does not match its declared file signature.";
  } catch {
    return "Attachment content could not be read.";
  }
}

function readFileBytes(file: File): Promise<Uint8Array> {
  const fileWithArrayBuffer = file as File & { arrayBuffer?: () => Promise<ArrayBuffer> };
  if (typeof fileWithArrayBuffer.arrayBuffer === "function") {
    return fileWithArrayBuffer.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error("Attachment content could not be read."));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Attachment content could not be read."));
    reader.readAsArrayBuffer(file);
  });
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KiB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
}

function actionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiClientError) {
    if (error.code === "ATTACHMENT_LIMIT_REACHED") {
      return "This Ticket already has five active attachments.";
    }
    if (error.code === "ATTACHMENT_ALREADY_REMOVED") {
      return "This Attachment has already been removed. Refresh the Attachment list.";
    }
    return error.message;
  }
  return fallback;
}

function ReadOnlyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const id = `ticket-detail-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
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

export default function TicketDetail({ requester, ticketNumber, navigate }: TicketDetailProps) {
  const [ticket, setTicket] = useState<TicketDetailData | null>(null);
  const [ticketState, setTicketState] = useState<LoadState>("loading");
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [attachmentState, setAttachmentState] = useState<LoadState>("loading");
  const [ticketRetry, setTicketRetry] = useState(0);
  const [attachmentRetry, setAttachmentRetry] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [removalTarget, setRemovalTarget] = useState<TicketAttachment | null>(null);
  const [removalReason, setRemovalReason] = useState("");
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const removalReasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    setTicketState("loading");
    setTicket(null);
    void fetchTicket(requester.id, ticketNumber)
      .then((loaded) => {
        if (cancelled) return;
        setTicket(loaded);
        setTicketState("success");
      })
      .catch(() => {
        if (cancelled) return;
        setTicketState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [requester.id, ticketNumber, ticketRetry]);

  useEffect(() => {
    let cancelled = false;
    setAttachmentState("loading");
    void fetchTicketAttachments(requester.id, ticketNumber)
      .then((loaded) => {
        if (cancelled) return;
        setAttachments(loaded);
        setAttachmentState("success");
      })
      .catch(() => {
        if (cancelled) return;
        setAttachments([]);
        setAttachmentState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [requester.id, ticketNumber, attachmentRetry]);

  useEffect(() => {
    if (removalTarget) {
      removalReasonRef.current?.focus();
    }
  }, [removalTarget]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(null);
    setFileError(null);
    setUploadError(null);
    setUploadSuccess(null);
    if (!file) return;
    const metadataError = validateAttachmentMetadata(file);
    if (metadataError) {
      setFileError(metadataError);
      input.value = "";
      return;
    }
    const signatureError = await validateAttachmentSignature(file);
    if (signatureError) {
      setFileError(signatureError);
      input.value = "";
      return;
    }
    setSelectedFile(file);
  }

  async function handleUpload() {
    if (!selectedFile || uploading) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const uploaded = await addTicketAttachment(requester.id, ticketNumber, selectedFile);
      setAttachments((current) => [...current, uploaded]);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadSuccess("Attachment uploaded successfully.");
    } catch (error) {
      setUploadError(actionErrorMessage(error, "Unable to upload Attachment."));
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(attachment: TicketAttachment) {
    setDownloadError(null);
    try {
      const blob = await downloadTicketAttachment(requester.id, ticketNumber, attachment.id);
      const createObjectUrl = typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : null;
      if (!createObjectUrl) {
        throw new Error("download unavailable");
      }
      const link = document.createElement("a");
      link.href = createObjectUrl;
      link.download = attachment.originalName;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(createObjectUrl);
    } catch (error) {
      setDownloadError(actionErrorMessage(error, "Unable to download Attachment."));
    }
  }

  function openRemoval(attachment: TicketAttachment) {
    setRemovalTarget(attachment);
    setRemovalReason("");
    setRemovalError(null);
  }

  function closeRemoval() {
    if (removing) return;
    setRemovalTarget(null);
    setRemovalReason("");
    setRemovalError(null);
  }

  function handleRemovalKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeRemoval();
    }
  }

  async function handleRemove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!removalTarget || removing) return;
    const reason = removalReason.trim();
    if (reason.length < 5 || reason.length > 250) {
      setRemovalError("Removal reason must be 5–250 characters after trimming.");
      return;
    }
    setRemoving(true);
    setRemovalError(null);
    try {
      const removed = await removeTicketAttachment(requester.id, ticketNumber, removalTarget.id, reason);
      setAttachments((current) => current.map((attachment) => (attachment.id === removed.id ? removed : attachment)));
      setRemovalTarget(null);
      setRemovalReason("");
    } catch (error) {
      setRemovalError(actionErrorMessage(error, "Unable to remove Attachment."));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section className="zen-card zen-detail-card" aria-labelledby="ticket-detail-heading">
      <div className="zen-detail-heading">
        <div>
          <p className="zen-eyebrow">Requester workspace</p>
          <h1 id="ticket-detail-heading">Ticket Detail</h1>
          <p className="zen-lead">Review your Ticket and manage its supporting Attachments.</p>
        </div>
        <button className="zen-button zen-button-secondary" type="button" onClick={() => navigate("/tickets")}>Back to My Tickets</button>
      </div>

      {ticketState === "loading" && <p className="zen-state zen-state-info" role="status">Loading Ticket Detail...</p>}
      {ticketState === "error" && (
        <div className="zen-state zen-state-error" role="alert" aria-label="Ticket detail loading error">
          <p>Unable to load Ticket.</p>
          <button className="zen-button zen-button-secondary" type="button" onClick={() => setTicketRetry((value) => value + 1)}>Retry</button>
        </div>
      )}
      {ticketState === "success" && ticket && (
        <div className="zen-form-grid zen-detail-fields">
          <ReadOnlyField label="Ticket Number" value={ticket.ticketNumber} />
          <ReadOnlyField label="Ticket Date" value={formatDate(ticket.createdAt)} />
          <ReadOnlyField label="Requester" value={`${ticket.requester.name} (${ticket.requester.email})`} />
          <ReadOnlyField label="Category" value={ticket.category.name} />
          <ReadOnlyField label="Related System" value={ticket.relatedSystem.name} />
          <ReadOnlyField label="Requested Priority" value={ticket.requestedPriority} />
          <ReadOnlyField label="Current Status" value={ticket.status} />
          <ReadOnlyField label="Summary" value={ticket.summary} multiline />
          <ReadOnlyField label="Description" value={ticket.description} multiline />
        </div>
      )}

      <section className="zen-attachment-section" aria-labelledby="ticket-attachments-heading">
        <div className="zen-section-heading">
          <div>
            <p className="zen-eyebrow">Supporting evidence</p>
            <h2 id="ticket-attachments-heading">Attachments</h2>
          </div>
          <span className="zen-help">JPEG, PNG, WEBP, or PDF · 5 MiB each</span>
        </div>

        {attachmentState === "loading" && <p className="zen-state zen-state-info" role="status">Loading Attachments...</p>}
        {attachmentState === "error" && (
          <div className="zen-state zen-state-error" role="alert" aria-label="Attachment loading error">
            <p>Unable to load Attachments.</p>
            <button className="zen-button zen-button-secondary" type="button" onClick={() => setAttachmentRetry((value) => value + 1)}>Retry</button>
          </div>
        )}
        {attachmentState === "success" && attachments.length === 0 && (
          <p className="zen-state zen-state-info" role="status">No Attachments have been added.</p>
        )}
        {attachmentState === "success" && attachments.length > 0 && (
          <ul className="zen-detail-attachment-list" aria-label="Ticket Attachments">
            {attachments.map((attachment) => (
              <li key={attachment.id} className={attachment.removedAt ? "is-removed" : undefined}>
                <div className="zen-attachment-meta">
                  <strong>{attachment.originalName}</strong>
                  <span>{attachment.mimeType} · {formatBytes(attachment.sizeBytes)} · Uploaded {formatDate(attachment.uploadedAt)}</span>
                  {attachment.removedAt && (
                    <span className="zen-attachment-removed">
                      Removed {formatDate(attachment.removedAt)} · Reason: {attachment.removalReason ?? "Not provided"}
                    </span>
                  )}
                </div>
                {!attachment.removedAt && (
                  <div className="zen-attachment-actions">
                    <button className="zen-button zen-button-secondary" type="button" onClick={() => void handleDownload(attachment)}>Download</button>
                    <button className="zen-button zen-button-link" type="button" onClick={() => openRemoval(attachment)}>Remove</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="zen-attachment-upload">
          <div className="zen-field">
            <label htmlFor="ticket-detail-attachment">Add Attachment</label>
            <input
              id="ticket-detail-attachment"
              ref={fileInputRef}
              className="zen-input zen-file-input"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
              onChange={(event) => void handleFileChange(event)}
              disabled={uploading}
              aria-describedby={fileError ? "ticket-detail-attachment-error" : undefined}
            />
            {fileError && <p id="ticket-detail-attachment-error" className="zen-field-error" role="alert">{fileError}</p>}
          </div>
          {selectedFile && <p className="zen-help">Ready to upload: {selectedFile.name}</p>}
          <button className="zen-button zen-button-primary" type="button" onClick={() => void handleUpload()} disabled={!selectedFile || uploading}>
            {uploading ? "Uploading Attachment..." : "Upload Attachment"}
          </button>
        </div>
        {uploadError && <p className="zen-field-error" role="alert">{uploadError}</p>}
        {uploadSuccess && <p className="zen-state zen-state-success" role="status">{uploadSuccess}</p>}
        {downloadError && <p className="zen-field-error" role="alert">{downloadError}</p>}
      </section>

      {removalTarget && (
        <div className="zen-modal-backdrop" onKeyDown={handleRemovalKeyDown}>
          <div className="zen-removal-dialog" role="dialog" aria-modal="true" aria-labelledby="remove-attachment-heading">
            <h2 id="remove-attachment-heading">Remove Attachment?</h2>
            <p>“{removalTarget.originalName}” will be hidden from downloads but its audit metadata will be retained.</p>
            <form onSubmit={(event) => void handleRemove(event)}>
              <div className="zen-field">
                <label htmlFor="removal-reason">Removal reason</label>
                <textarea
                  id="removal-reason"
                  ref={removalReasonRef}
                  className="zen-input zen-textarea zen-removal-reason"
                  value={removalReason}
                  maxLength={250}
                  onChange={(event) => setRemovalReason(event.target.value)}
                  aria-describedby={removalError ? "removal-reason-error" : undefined}
                />
                <span className="zen-help">5–250 characters after trimming.</span>
                {removalError && <p id="removal-reason-error" className="zen-field-error" role="alert">{removalError}</p>}
              </div>
              <div className="zen-form-actions">
                <button className="zen-button zen-button-secondary" type="button" onClick={closeRemoval} disabled={removing}>Cancel</button>
                <button className="zen-button zen-button-primary" type="submit" disabled={removing || removalReason.trim().length < 5 || removalReason.trim().length > 250}>
                  {removing ? "Removing Attachment..." : "Confirm Removal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
