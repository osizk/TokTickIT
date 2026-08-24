# Lab 2 Zen Green UI Specification

## 1. Foundation

Use a quiet near-white page background (`#F5F7F6`), white surfaces with restrained borders/shadows, dark charcoal-green text, and a consistent centered content width. Tokens:

| Token | Value | Use |
|---|---|---|
| Primary green | `#006B3C` | Header, primary actions, strong emphasis |
| Secondary green | `#0B7A46` | Active navigation, links, focus accents, hover |
| Pale green | `#EAF6EF` | Selection, success, subtle section emphasis |
| Error | Dark red | Border/message; never error color alone |
| Warning | Amber | Warning callouts/badges only |
| Surface | White | Cards and form containers |
| Read-only | Soft gray-green or warm ivory | Generated/read-only fields |

Use readable system sans-serif typography, labels above controls, consistent control height, restrained spacing, and a taller Description field. Description may be resized only when the layout remains usable.

## 2. Accessibility and Components

- Every control has a visible label or an accessible name.
- Required controls show a red asterisk and a nearby text validation message.
- Invalid controls use `aria-invalid` and `aria-describedby`.
- Focus indicators remain visible for keyboard users.
- Status, success, warning, and error messages use semantic roles and text, not color alone.
- Buttons contain visible text; icon-only controls require an accessible label and tooltip.
- Disabled controls are visually distinct and not activatable.
- Submit shows a busy label and is disabled while the request is in flight.
- Confirmation interactions return focus appropriately and support Escape/cancel.
- Interactive targets remain touch-friendly on mobile.

Reusable components should include the application shell, field/control wrapper, validation message, state panel, badge, pagination, attachment row, confirmation dialog, and responsive Ticket table/card.

## 3. Routes and Shell

Routes:

- `/select-requester`: testing-context selection; no requester-owned data.
- `/tickets`: My Tickets.
- `/tickets/new`: Create Ticket.
- `/tickets/:ticketNumber`: owned Ticket Detail.

The shell shows TokTickIT identity, active navigation for My Tickets/Create Ticket, the selected Requester name, and Change Requester. If `sessionStorage` is absent/invalid/inactive, requester-owned routes redirect to selection.

## 4. Development Requester Selection

Show a short message that the selector is a Lab 2 testing mechanism, not authentication. Fetch active Requesters from PostgreSQL and provide:

- loading state while fetching;
- empty state with explanation when none are active;
- safe API-failure state with Retry;
- labeled keyboard-accessible dropdown;
- Continue disabled until a choice exists;
- visible focus and clear success navigation.

On startup, validate the stored ID against the active response. Clear invalid/inactive IDs. Change Requester clears all requester-specific state and starts selection again.

## 5. Create Ticket

Group fields as follows:

1. Read-only Requester, Ticket Number placeholder, and Ticket Date placeholder.
2. Classification: Category, Related System, Requested Priority.
3. Summary and Description with sufficient width.
4. Attachment picker and selected-file rows.
5. Primary Submit and secondary navigation actions.

States: initial, reference-data loading, reference-data failure/empty, field validation, invalid Attachment, submitting, success, and safe API failure. Failed submission retains fields and selected files. Success displays the backend Ticket Number and links to Detail/My Tickets.

## 6. My Tickets

Controls include search, Category/System/Priority/Status filters, sort field/order, page size, Clear Filters, and Create Ticket. Persist control state in URL query parameters. Default sort is updated date descending with stable ID tie-breaker.

Desktop uses a table showing Ticket Number, Summary, Category, Related System, Requested Priority, Current Status, and Last Updated. Mobile uses readable cards with the same identifying data and an explicit Open action. Show distinct loading, API failure, no-owned-Tickets, and no-results states.

## 7. Ticket Detail and Attachments

Ticket fields are read-only: Ticket Number, Ticket Date, Requester, Category, Related System, Requested Priority, Current Status, Summary, and Description. Do not show excluded IT Staff, comments, resolution, or later-workflow fields.

The Attachment section shows independent loading/error states, active metadata, an add-file control, upload busy/error/success state, active Download actions, and removed rows with original metadata, removal audit information, and no Download/Preview action. Soft removal requires confirmation and a 5–250 character reason.

## 8. Responsive Rules

- Desktop (`>=992px`): centered multi-column form/detail layout and table.
- Tablet (`768–991px`): two columns where practical; keep Summary/Description readable.
- Mobile (`<768px`): stack fields, use cards, keep buttons touch-friendly, and allow no horizontal page scroll.
- At all widths, prevent clipped labels, overlap, hidden actions, truncated unreadable names, and detached error messages.

## 9. Visual Evidence

Capture readable screenshots at desktop, tablet, and mobile for:

```text
artifacts/lab-02/screenshots/create-ticket/
artifacts/lab-02/screenshots/my-tickets/
artifacts/lab-02/screenshots/ticket-detail/
```

Each screenshot receives a caption describing what it shows and which requirement it proves. Compare against this specification, not memory of the reference image.
