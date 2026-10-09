# Lab 4 UI Specification

Draft engineering contract, Issue #55; approval pending. Requirements and exact backend contracts: [specification.md](specification.md), [api-spec.md](api-spec.md). Mockups in the labsheet provide visual direction, not permission for extra features. Reuse React, current routing/shell/forms/styles; do not add a chart, dialog, router, or component framework.

## 1. Routes, navigation, and role identity

| Route | User and purpose |
| --- | --- |
| `/login`, `/change-password` | Preserve login, session restoration, live password guidance and mandatory gate. |
| `/dashboard` | Requester landing/dashboard; session-mapped ownership only. |
| `/tickets`, `/tickets/new`, `/tickets/:ticketNumber` | Preserve Requester list/create/detail; owned detail gains read-only Actions/history. |
| `/staff/dashboard` | Staff/Admin normal landing/dashboard. |
| `/staff/tickets`, `/staff/tickets/:ticketNumber` | Preserve shared queue/detail; detail gains Actions and workflow gate/history. |
| `/admin/users` | Administrator only; preserve existing adjacent/modal editing, filters and safety. |

Requester navigation: Dashboard, My Tickets, Create Ticket. Staff: Dashboard, Ticket Queue. Administrator: Dashboard, Ticket Queue, User Management. Header shows actual authenticated name/role and Logout. Preserve requested permitted deep links after restoration/login; otherwise use the role dashboard. Guard all protected routes, including new dashboards and change-password. A protected 401 clears session state and redirects to Login; role403 shows safe forbidden feedback with a valid workspace link. Logout failures retain the signed-in workspace with Retry, rather than falsely claiming sign-out. Ignore stale restore results after successful login. Never revive `/select-requester` or sessionStorage identity selection.

## 2. Visual system and responsive rules

Reuse Zen Green: primary `#006B3C`, secondary `#0B7A46`, pale green `#EAF6EF`, page `#F5F7F6`, white cards, main text `#16332A`, error `#B42318`, warning `#8A5A00`. Use existing tokenized typography, spacing, borders and focus treatment; labels/status text accompany colors. Authentication fields stay aligned with equal input heights; helpful text must not shift adjacent controls unexpectedly.

Mobile <768px; tablet 768–991px; desktop ≥992px. Verify 767/768/991/992 boundaries plus screenshots at 390×844, 900×1000 and 1440×1000. Desktop dashboard uses a compact metric grid and bounded lists; tablet reduces columns; mobile stacks cards/actions. Wide data tables become labeled cards where needed. No horizontal page scrolling, clipped fields, overlapping controls, inaccessible native selects, or shrunken unreadable text. Native select menus opening upward near viewport edges is platform behavior, not a required custom-dropdown replacement.

Use semantic headings, labels and button/link roles; visible focus; keyboard reachability; touch-friendly targets (aim ≥44px). Error text associates with fields using aria-describedby/aria-invalid. Announce save results/errors via polite status or alert as appropriate; do not announce every keystroke noisily. Busy controls are disabled without trapping focus. Focus the first invalid field on failed validation, the updated Action heading after save, the selected Action editor on Edit, and its Edit button after Cancel. Maintain usable reading order when stacking.

## 3. Staff/Admin dashboard

Display four linked metrics: unassigned active Tickets, my-owned active Tickets, urgent active Tickets, distinct Tickets with my active Actions. Show labeled eight-status and four-IT-priority summaries, current-user assigned active Actions, recent Tickets and urgent active Tickets. Each section is capped at five entries. Action row shows actual Action description/status, Ticket Number/summary and updated date; link opens the relevant Staff Ticket and focuses the Action. Ticket rows show Number/summary/Requester/status/priority/Owner/date and Open detail. Do not substitute a Ticket list for the required current-user Actions section.

Explain active states and the recent seven-day window concisely, displaying Asia/Bangkok dates. Metric and summary links use the exact shared predicates in api-spec. Refresh manually and on route entry/return from successful relevant mutation; no background polling required. Counts/lists update together from one response. Links preserve URL controls on destination and show filtered list totals/pagination. No fake trends/charts or duplicated bulk collections.

States: loading with accessible status; all-zero metrics with genuine empty sections; safe failure with Retry and no invented counts; forbidden/password-expired routing; populated bounded lists. Retain a previous response during refresh only with a visible refreshing/stale indicator, never present it as a fresh successful response after failure.

## 4. Requester dashboard

Show own active, waiting-for-Requester, currently resolved and currently closed counts, plus attention and recent Ticket lists. Link metrics to owned My Tickets filters; attention is WAITING_FOR_REQUESTER. Recent means Ticket.updatedAt within the displayed seven-day window, not undocumented attachment/comment activity or a fabricated resolution timestamp. Keep this a concise summary, not a copy of My Tickets search/filter/table controls. Links open owned detail. Explain zero and loading/failure/Retry states; switching accounts clears cached role/owned data. Direct Requester query injection or unauthorized routes must not expose other Tickets.

## 5. Actions Taken on Ticket detail

### Read presentation

Keep existing Ticket identity, Owner/priority/status controls, Public Comments, Internal Notes, and attachment behavior. Add an Actions section with all states, stable oldest-created-first order, pagination (default25;10/25/50) and optional expandable revision history. Show Action Date, description, Result, assignee, creator, completion performer/date, Follow-up Required/Note, Attachment Notes, status and cancellation metadata. Date means backend creation time; performer is unset until completion. Attachment Notes are plain filenames/reference notes, not private storage paths or a new upload control. All displayed Action fields and revision snapshots are public; staff-private information belongs in Internal Notes.

Requester detail displays the same owned public records/history read-only: no Create/Edit/Assign/Complete/Cancel controls or Internal Notes. Staff/Admin controls do not depend on being Owner. Empty section says “No Actions Taken have been recorded for this Ticket.” It must not create a fake legacy record.

### Create and edit

On create/edit forms, show a red `*` beside each required field and write `(optional)` beside every field that may be left blank; include the key `* Required. Fields marked (optional) may be left blank.` Description and Assignee are required. Result is optional until completion; then it is required and must contain 5-2,000 characters. Follow-up Note is required (5-2,000 characters) only while Follow-up Required is selected; otherwise an entered note is optional. Attachment Notes are optional (up to 1,000 characters). Cancellation reason is required (5-250 characters) and follows the same red-asterisk convention. Keep native `required` and `aria-required` consistent with the visible labels, and associate each inline error with the field and a plain-language correction.

Create form fields: Description; Assignee (active Staff/Admin, defaults current actor); optional Result; Follow-up Required checkbox; conditional Follow-up Note; optional Attachment Notes. Explain limits next to relevant fields, not “use configured policy.” Action Date/creator/status are read-only backend metadata. Show explicit Create, Cancel and busy “Saving…” controls. Generate a UUID for each new intended creation and retain it across an uncertain retry.

Edit opens inline adjacent to that Action, not below a long unrelated list. Populate current values/versions, move focus, show Save/Cancel, and preserve draft after validation/server/network failure. Load eligible assignees with loading/error/Retry; disabled save until a valid choice. Reassignment must not update Ticket Owner. Completed Actions permit narrative/result/follow-up corrections only; cancelled/terminal records display read-only reason. No generic Delete Action.

Lifecycle buttons are explicit: Start Work, Complete, Cancel Action. Confirm completion with valid Result; cancellation asks for a 5–250-character reason and confirmation. Completed performer/date stay unchanged after correction. Cancellation history remains visible. Follow-up Note is required when checked and any nonempty note is 5–2000 characters; clearing the checkbox may retain its optional note. Apply trimmed boundaries specified in BR-06 on frontend and backend.

On STALE_VERSION, retain the unsaved draft, explain another change occurred, and offer Reload current record; never silently overwrite. Reload requires explicit user choice because it may replace draft values. On uncertain creation failure, Retry uses the same key and body; changing the intended draft after a timeout requires first reconciling the original request or treating it as a clearly separate creation. Disable duplicate submits. No optimistic success before server commit. Success refreshes Action/history/versions/gate and invalidates dashboard data; failed writes leave prior committed UI consistent.

## 6. Ticket workflow and resolution gate

Show current status, legal targets from the backend, version, and public unmet resolution prerequisites. Gates require eligible Owner, at least one completed Action with valid Result, zero unfinished Actions, and no completed Action requiring follow-up. Status disabled by gate explains what needs work; no vague “Unable” message without a safe actionable reason. Keep backend validation authoritative if stale UI/direct API bypasses controls.

Confirm RESOLVED/CLOSED/REOPENED/CANCELLED; Ticket cancellation additionally collects reason and explains unfinished Actions will be cancelled. Reopening clears the advisory indication. Show indication separately: “Requester indicated the problem appears resolved”; do not relabel Ticket RESOLVED or promise automatic closure. Legacy resolved zero-Action Tickets explain the reopen/work/gate route. Terminal Tickets show read-only Actions until permitted reopening. Render immutable workflow history oldest-first and revisions by number; corrections never replace previous entries.

## 7. Shared states, safe messages, and continuity

Every new data section covers loading, real empty, populated, safe failure/Retry, 401, 403, 404, validation, busy/success and conflict as applicable. Filtered no-results belongs to the existing destination queue/My Tickets; dashboards without filters do not need invented search/no-results controls. Never expose raw errors in user UI. Distinguish network retry, expired login, permission denial, missing resource and stale conflict. Preserve old forms, live password rule feedback, failed logout behavior, attachment limits/removal protection, append-only comments/notes, and User Management filter reapplication after mutation.

Admin rejection for unfinished assigned Actions tells the Administrator to reassign/finish that work first. Existing self/last-active-Administrator and owned-Ticket checks remain; the UI must not claim a last-Administrator test was demonstrated when only self-deactivation was tested. Role/security restrictions require direct API evidence as well as hidden controls.

## 8. Real visual evidence and checklist

Store approved genuine screenshots under `artifacts/lab-04/screenshots/staff-dashboard/`, `artifacts/lab-04/screenshots/requester-dashboard/`, and `artifacts/lab-04/screenshots/actions-taken/`. At desktop/tablet/mobile capture Staff dashboard, Requester dashboard, and Actions/workflow detail. Also inspect affected inherited pages. Preserve current screenshots until intentionally recaptured; do not replace evidence with generated/mock images. Commit only deliberately selected sanitized evidence, never transient reports/output.

Capture multi-Action list/create/assign/edit/complete/cancel, inactive assignee, conditional validation, safe conflict/failure, owned Requester read-only view, resolution gate and legal transition/history, accurate dashboard zero/nonzero/drill-downs, role/ownership API denial and representative inherited workflows. Captions state both what is visible and the requirement it proves. Crop/split long details into readable labeled figures instead of shrinking a full page.

Visual/manual checks are **planned**, not performed in Issue #55: consistent Zen Green; all responsive sizes/boundaries; no page overflow; readable badges/text; keyboard/focus/labels/error associations; touch controls; announcements; drafts/retry/duplicate protection; broken-link/console inspection; no secrets; real figures and working links. Record actual results in [tests.md](tests.md).
