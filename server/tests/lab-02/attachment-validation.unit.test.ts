import { describe, expect, it } from "vitest";
import { MAX_ATTACHMENT_BYTES, validateAttachment } from "../../src/attachment-validation.js";

describe("Attachment validation", () => {
  it("accepts matching PDF, JPEG, PNG, and WEBP signatures", () => {
    const cases = [
      {
        name: "notes.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.7\nexample"),
      },
      {
        name: "photo.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
      },
      {
        name: "screen.png",
        mimeType: "image/png",
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      },
      {
        name: "screen.webp",
        mimeType: "image/webp",
        buffer: Buffer.from("RIFF1234WEBPdata"),
      },
    ];

    for (const candidate of cases) {
      expect(validateAttachment(candidate)).toMatchObject({
        originalName: candidate.name,
        mimeType: candidate.mimeType,
        sizeBytes: candidate.buffer.length,
      });
    }
  });

  it("allows exactly 5 MiB and rejects larger or mismatched files", () => {
    const exactPdf = Buffer.alloc(MAX_ATTACHMENT_BYTES);
    Buffer.from("%PDF-1.7\n").copy(exactPdf);
    expect(
      validateAttachment({
        name: "large.pdf",
        mimeType: "application/pdf",
        buffer: exactPdf,
      }).sizeBytes,
    ).toBe(MAX_ATTACHMENT_BYTES);

    expect(() =>
      validateAttachment({
        name: "too-large.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.alloc(MAX_ATTACHMENT_BYTES + 1),
      }),
    ).toThrow(/5 MiB/);

    expect(() =>
      validateAttachment({
        name: "spoofed.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("not a PDF"),
      }),
    ).toThrow(/signature/i);

    expect(() =>
      validateAttachment({
        name: "photo.png",
        mimeType: "image/jpeg",
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      }),
    ).toThrow(/MIME|extension/i);
  });
});
