import path from "node:path";

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const MIME_BY_EXTENSION = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
} as const;

export interface AttachmentCandidate {
  name: string | null | undefined;
  mimeType: string | null | undefined;
  buffer: Buffer;
}

export interface ValidatedAttachment {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  extension: keyof typeof MIME_BY_EXTENSION;
}

export class AttachmentValidationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: 413 | 415,
    public readonly code: "ATTACHMENT_TOO_LARGE" | "UNSUPPORTED_ATTACHMENT",
  ) {
    super(message);
    this.name = "AttachmentValidationError";
  }
}

function hasSignature(extension: keyof typeof MIME_BY_EXTENSION, buffer: Buffer): boolean {
  if (extension === ".jpg" || extension === ".jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (extension === ".png") {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  if (extension === ".webp") {
    return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }

  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

export function validateAttachment(candidate: AttachmentCandidate): ValidatedAttachment {
  if (candidate.buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new AttachmentValidationError("Each attachment must be no larger than 5 MiB.", 413, "ATTACHMENT_TOO_LARGE");
  }

  const originalName = candidate.name ?? "";
  const extension = path.extname(originalName).toLowerCase() as keyof typeof MIME_BY_EXTENSION;
  const expectedMimeType = MIME_BY_EXTENSION[extension];
  const mimeType = candidate.mimeType?.toLowerCase() ?? "";

  if (
    originalName.length === 0 ||
    /[\\/]/.test(originalName) ||
    path.basename(originalName) !== originalName ||
    !expectedMimeType ||
    mimeType !== expectedMimeType
  ) {
    throw new AttachmentValidationError("Attachment extension and MIME type are not supported or do not agree.", 415, "UNSUPPORTED_ATTACHMENT");
  }

  if (!hasSignature(extension, candidate.buffer)) {
    throw new AttachmentValidationError("Attachment content does not match its declared signature.", 415, "UNSUPPORTED_ATTACHMENT");
  }

  return {
    originalName,
    mimeType: expectedMimeType,
    sizeBytes: candidate.buffer.length,
    extension,
  };
}
