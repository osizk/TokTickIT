# Lab 2 Responsive Screenshot Evidence

These screenshots were refreshed by the Issue #19 release audit on 2026-08-30 with `CI=1`, an explicit isolated schema, and `npx.cmd playwright test`. Each viewport runs the same requester-owned Ticket and Attachment lifecycle. The images are evidence for the responsive and visual requirements in `docs/lab-02/ui-spec.md`.

| Screenshot | Caption and requirement proved |
|---|---|
| `create-ticket/desktop.png` | Desktop Create Ticket form showing the Zen Green shell, labeled fields, required markers, read-only generated-field placeholders, attachment row, visible focus, and primary/secondary actions. Proves FR-05/06/16 and AC-20/21. |
| `create-ticket/tablet.png` | Tablet Create Ticket form showing the two-column layout and readable full-width Summary/Description fields without clipping. Proves AC-21/22. |
| `create-ticket/mobile.png` | Mobile Create Ticket form showing stacked fields, touch-friendly controls, readable attachment selection, and no horizontal page scroll. Proves FR-16 and AC-21/22. |
| `my-tickets/desktop.png` | Desktop My Tickets owned-list state showing the searchable/filterable toolbar, a readable Ticket table, and the active shell. Proves FR-09/10 and AC-10/11/21. |
| `my-tickets/tablet.png` | Tablet My Tickets owned-list state showing the responsive two-column filter grid, readable controls, and the Ticket table at the intermediate breakpoint. Proves AC-10/11/21/22. |
| `my-tickets/mobile.png` | Mobile My Tickets owned-list state showing stacked controls, touch-sized buttons, and the responsive Ticket card with an explicit Open action. Proves FR-09/10 and AC-10/11/21/22. |
| `ticket-detail/desktop.png` | Desktop Ticket Detail showing read-only owned fields, attachment metadata, active actions, and the soft-removed audit row without a download action. Proves FR-11–14 and AC-13/15–18/21. |
| `ticket-detail/tablet.png` | Tablet Ticket Detail showing readable detail fields and attachment actions within the intermediate layout. Proves AC-13/15–18 and AC-21/22. |
| `ticket-detail/mobile.png` | Mobile Ticket Detail showing stacked read-only fields, readable attachment metadata, removed-state audit text, active Download/Remove actions, and the upload panel. Proves FR-11–16 and AC-13/15–18/21/22. |

## Issue 19 submission-state evidence

These state screenshots were captured by `e2e/lab-02/release-evidence-states.spec.ts` at desktop, tablet, and mobile viewport sizes.

| Screenshot | Caption and requirement proved |
|---|---|
| `release-states/{desktop,tablet,mobile}/requester-loading.png` | Requester selection while active Requesters are loading; Continue is unavailable. Proves FR-01/02 and AC-01/02. |
| `release-states/{desktop,tablet,mobile}/requester-empty.png` | Safe empty requester state when no active Requester is returned. Proves AC-02. |
| `release-states/{desktop,tablet,mobile}/requester-failure.png` | Safe requester API failure state with Retry and no leaked server details. Proves AC-02/23. |
| `release-states/{desktop,tablet,mobile}/create-initial.png` | Initial Create Ticket form with read-only generated fields, required markers, and attachment guidance. Proves FR-05/06 and AC-05/20. |
| `release-states/{desktop,tablet,mobile}/create-validation.png` | Strict client validation messages after an empty submission, with focus/error treatment. Proves BR-08/09 and AC-07/20. |
| `release-states/{desktop,tablet,mobile}/create-invalid-attachment.png` | Invalid PDF signature error while valid field values remain available. Proves BR-12 and AC-08. |
| `release-states/{desktop,tablet,mobile}/create-api-failure.png` | Safe API failure with entered Summary and Description preserved for correction/retry. Proves AC-09/20. |
| `release-states/{desktop,tablet,mobile}/create-submitting.png` | Disabled `Submitting Ticket...` state during the one multipart request. Proves duplicate-submission prevention in AC-09/20. |
| `release-states/{desktop,tablet,mobile}/create-success.png` | Successful response showing the backend-created Ticket Number, Ticket Date, and `NEW` status. Proves AC-05/06. |
