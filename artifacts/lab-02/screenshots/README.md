# Lab 2 Issue 18 Screenshot Evidence

These screenshots were captured by `cd client && npx playwright test` on 2026-08-29. Each viewport runs the same requester-owned Ticket and Attachment lifecycle. The images are evidence for the responsive and visual requirements in `docs/lab-02/ui-spec.md`.

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
