# Lab 2 REST API Specification

## 1. Conventions

- Base path: `/api`.
- JSON responses use ISO UTC timestamps.
- Requester-scoped operations require `X-Requester-Id`.
- The header is a spoofable Lab 2 testing context and is not authentication.
- Never accept `requesterId` in a Ticket body or multipart field.
- Missing and cross-requester resources return the same safe `404`.
- Errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "fieldErrors": {
      "summary": "Summary is required."
    }
  }
}
```

## 2. Reference Endpoints

### `GET /api/categories`

Returns active Categories in stable ID order. Preserve the existing array response:

```json
[{ "id": 1, "name": "Hardware" }]
```

### `GET /api/related-systems`

Returns active Related Systems in stable ID/name order:

```json
[{ "id": 1, "name": "Campus Wi-Fi" }]
```

### `GET /api/requesters`

Returns active Development Requesters only:

```json
[{ "id": 1, "name": "Amina Rahman", "email": "amina@example.test" }]
```

Reference failures return `500` with `{ "error": { "code": "REFERENCE_DATA_UNAVAILABLE", "message": "..." } }`; internal database details are never returned. No inactive Requester is returned.

## 3. Ticket Shapes

List item:

```json
{
  "id": 1,
  "ticketNumber": "TKT-2026-000001",
  "summary": "Campus Wi-Fi disconnects",
  "category": { "id": 4, "name": "Network" },
  "relatedSystem": { "id": 2, "name": "Campus Wi-Fi" },
  "requestedPriority": "HIGH",
  "status": "NEW",
  "createdAt": "2026-08-22T10:00:00.000Z",
  "updatedAt": "2026-08-22T10:00:00.000Z"
}
```

Detail additionally includes Requester, Description, Ticket Date (`createdAt`), and Attachment metadata. Attachment metadata never includes a storage path or stored filename:

```json
{
  "id": 1,
  "originalName": "wifi-error.png",
  "mimeType": "image/png",
  "sizeBytes": 2048,
  "uploadedAt": "2026-08-22T10:01:00.000Z",
  "removedAt": null,
  "removalReason": null,
  "removedByRequesterId": null
}
```

## 4. `POST /api/tickets`

Headers: `X-Requester-Id`, `Content-Type: multipart/form-data`.

Multipart text fields:

- `categoryId`: positive integer;
- `relatedSystemId`: positive integer;
- `requestedPriority`: `LOW|MEDIUM|HIGH|URGENT`;
- `summary`: trimmed 5–120 characters;
- `description`: trimmed 10–5000 characters;
- repeated `attachments`: zero-to-five files.

The request is atomic according to `specification.md`: validate all input, stage files, begin a database transaction, allocate the annual Ticket Number, create records, move staged files to final UUID paths, and commit only after all operations succeed. On failure, roll back and compensate files.

Success: `201` with `{ "ticket": <detail>, "attachments": [...] }`.

Errors: `400` validation/context/reference, `413` oversized file, `415` unsupported or signature-mismatched file, `500` safe unexpected failure.

## 5. `GET /api/tickets`

Requires `X-Requester-Id`.

Query parameters:

- `search`: Ticket Number, Summary, or Description; max 100 characters;
- `categoryId`, `relatedSystemId`: positive integers;
- `priority`: requested priority enum;
- `status`: `NEW`;
- `sort`: `updatedAt|createdAt|ticketNumber|summary|requestedPriority`;
- `order`: `asc|desc`;
- `page`: positive integer, default `1`;
- `pageSize`: `10|25|50`, default `10`.

Default order is `updatedAt desc`, then `id desc`. Invalid parameters return `400`. A valid page beyond the end returns an empty item list.

Success:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 0,
    "totalPages": 0,
    "hasPreviousPage": false,
    "hasNextPage": false
  }
}
```

## 6. `GET /api/tickets/:ticketNumber`

Requires `X-Requester-Id`. Returns `200` with `{ "ticket": <owned detail> }` or safe `404` for missing/cross-owner resources. The detail contains Ticket Number, Ticket Date (`createdAt`), Requester, Category, Related System, Requested Priority, Current Status, Summary, Description, `createdAt`, and `updatedAt`; it does not expose internal requester IDs or Attachment storage fields.

## 7. Attachment Endpoints

### `GET /api/tickets/:ticketNumber/attachments`

Requires ownership. Returns `200` with `{ "attachments": [...] }` containing all active and removed metadata. Stored paths/names are omitted.

### `POST /api/tickets/:ticketNumber/attachments`

Requires ownership. Multipart field: one `file`. Enforce type/signature, exact 5 MiB limit, active-count limit, filesystem compensation, and database metadata creation. Success is `201` with `{ "attachment": <metadata> }`; use `404`, `409`, `413`, `415`, and safe `500` as documented.

### `GET /api/tickets/:ticketNumber/attachments/:attachmentId/download`

Requires ownership and active Attachment. Return `200` with safe content type, `Content-Disposition`, `X-Content-Type-Options: nosniff`, and no public storage access. Missing, cross-owner, and removed Attachments return safe `404`.

### `DELETE /api/tickets/:ticketNumber/attachments/:attachmentId`

Requires ownership and JSON body:

```json
{ "removalReason": "No longer needed for troubleshooting." }
```

Validate 5–250 trimmed characters. Success is `200` with retained metadata and removal audit fields. Missing/cross-owner is `404`; already removed or active conflicts are `409`; invalid reason is `400`.

Success returns `{ "attachment": <metadata with removedAt, removalReason, and removedByRequesterId> }`.

## 8. Status and Error Matrix

| Status | Use |
|---:|---|
| 200 | Retrieval, download, or soft removal |
| 201 | Ticket or Attachment created |
| 400 | Missing/malformed context, invalid fields, invalid query, invalid removal reason |
| 404 | Inactive/unavailable Requester, missing resource, ownership mismatch, removed download |
| 409 | Attachment capacity or already-removed conflict |
| 413 | File larger than 5 MiB |
| 415 | Unsupported type or extension/MIME/signature mismatch |
| 500 | Safe unexpected server failure |

All unexpected errors are logged server-side without returning internal details.
