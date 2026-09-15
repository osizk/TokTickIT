# Lab 3 Zen Green UI Specification

## 1. Purpose and visual foundation

This document defines the user-facing contract for the authenticated Lab 3 increment. It extends the Lab 2 Zen Green system without adding a staff dashboard, analytics, email workflow, or other excluded features. Backend authorization remains authoritative; hiding a navigation item is not an authorization control.

| Token | Value | Use |
|---|---|---|
| Primary green | `#006B3C` | Primary actions, active navigation, headings |
| Secondary green | `#0B7A46` | Hover/focus, secondary actions, links |
| Pale green | `#EAF6EF` | Information/success surfaces and badges |
| Page background | `#F5F7F6` | Application background |
| Card | `#FFFFFF` | Forms, tables, detail sections |
| Text | `#16332A` | Body and heading text |
| Error | `#B42318` | Validation and failure states |
| Warning | `#8A5A00` | Pending or destructive confirmation states |

Use the existing system font stack, an 8px spacing rhythm, readable line height, and a maximum content width that keeps forms and tables scannable. Do not expose database IDs, storage paths, password hashes, session values, or internal note text to Requesters.

## 2. Routes and authenticated shell

| Route | Available roles | Purpose |
|---|---|---|
| `/login` | Unauthenticated | Email/password login |
| `/change-password` | Authenticated users with `mustChangePassword` | Mandatory first-login or reset password change |
| `/tickets` | Requester | Owned Ticket list, search/filter/sort/page |
| `/tickets/new` | Requester | Create a Ticket and upload permitted attachments |
| `/tickets/:ticketNumber` | Requester | Owned detail, comments, resolution indication, attachment lifecycle |
| `/staff/tickets` | IT Staff, Administrator | Shared Ticket Queue |
| `/staff/tickets/:ticketNumber` | IT Staff, Administrator | Staff Ticket detail and operations |
| `/admin/users` | Administrator | Minimal User Management |

The authenticated shell contains the TokTickIT mark, the current user's display name and role, role-permitted navigation links, and Logout. The old `/select-requester` route, Change Requester control, requester `sessionStorage`, and `X-Requester-Id` ownership context are removed. A guarded route redirects unauthenticated users to `/login`, redirects a user who must change their password to `/change-password`, and shows a safe `403` state for an authenticated wrong-role route.

## 3. Shared interaction and accessibility rules

- Every input has a visible label; errors use `aria-invalid` and `aria-describedby` and are announced through a polite status region.
- Keyboard users can reach every link, button, select, dialog, table action, and pagination control in a logical order. Focus is always visible with a high-contrast outline and is not removed on mouse interaction.
- Buttons show a disabled/busy state during submission. Login, password change, Ticket creation, comments, notes, assignment, status changes, and User mutations cannot be submitted twice while pending.
- Destructive or state-changing operations use a keyboard-accessible confirmation dialog with a clear Cancel action. Focus is trapped while open and returns to the invoking control after close.
- Status, role, priority, assignment, and activation badges use text and color/shape together; color alone never conveys meaning.
- Loading uses a labelled progress indicator; empty, no-results, forbidden, not-found, conflict, and safe-failure states explain the next action without exposing internals.
- Touch targets are at least 44px high, tables do not force page-wide horizontal scrolling, and mobile cards expose the same information and actions as desktop rows.
- Server validation is rendered next to the relevant field where possible and summarized at the top of a form. User-provided comments and notes are rendered as text, never as HTML.

## 4. Screen specifications

### 4.1 Login

Show a centered card with Email, Password, Show password, and Sign in. Initial loading has a labelled progress state; invalid credentials and inactive accounts use the same safe message. On success, route to Change Password when required, otherwise to the role's landing screen. Preserve entered email after a failure but never preserve the password. A rate-limit response explains that the user should wait without revealing the attempt count or account existence.

### 4.2 Change Password

Show Current password, New password, Confirm new password, a password-policy hint, and Save password. The form validates required fields, policy boundaries, current-password correctness, difference from the old password, and matching confirmation. A successful change rotates/revokes the old session as specified by the API and routes to the correct landing screen. Back/navigation cannot bypass the guard while `mustChangePassword` remains true.

### 4.3 Requester continuity (`/tickets`, `/tickets/new`, `/tickets/:ticketNumber`)

Preserve the Lab 2 My Tickets table/phone-card presentation, URL query controls, loading/empty/no-results/failure states, strict Ticket validation, atomic attachment feedback, safe ownership errors, and protected download/removal behavior. Replace the selector identity with the authenticated shell identity. Ticket detail adds a Public Comments timeline and a `Problem appears resolved` indication that does not change status. A Requester never sees Internal Notes, staff assignment controls, IT Priority, or staff-only status actions.

### 4.4 Staff Ticket Queue

The desktop queue is a labelled table with Ticket Number, Summary, Requester, Status, IT Priority, Requested Priority, Assignee, Updated, and an Open action. Controls include Search, status, IT Priority, assignee (`Unassigned` included), sort, order, page size (10/25/50), Apply, Clear, and pagination. Defaults are the API defaults. The page distinguishes no Tickets in the permitted scope from a filtered no-results state and includes loading, safe-failure Retry, forbidden, and empty-assignee states. On mobile each row becomes a card with the same fields and a prominent Open action; controls stack without page scrolling.

### 4.5 Staff Ticket Detail

Show immutable Ticket identity, requester, category/system, requested priority, IT Priority, status, assignment, dates, description, active/removed Attachment metadata, Public Comments, and an Internal Notes panel. Priority controls use only `LOW`, `MEDIUM`, `HIGH`, and `URGENT`; Requested Priority is read-only after creation, while IT Priority can be changed only by permitted staff. Staff actions are explicit: Claim, Assign/Reassign, Unassign, change IT Priority, and change Status. Reassignment, unassignment, cancellation, and status transitions requiring confirmation use dialogs that state the consequence. Comments and notes are append-only, labelled textareas with character guidance, author/time display, and separate visibility treatment. Requesters and staff receive safe not-found/forbidden states according to the API contract.

### 4.6 Administrator User Management

The page is intentionally a simple list and editor, not a dashboard. Show Search, optional Role filter, a User table/cards with Name, Email, Role, Status, and Edit. The create/edit form supports one role, active/inactive state, and (for create or reset) an initial password. An initial password is never shown after submission. Duplicate email, invalid role, self-deactivation, last-active-Administrator protection, and safe server failures are rendered clearly. If deactivation or demotion to `REQUESTER` would affect a User who owns Tickets, keep the form open, show the safe `USER_OWNS_TICKETS` conflict, and leave the User and Ticket state unchanged. A successful role or activation change may revoke the affected User's sessions; show the resulting session-expired state rather than claiming the old role remains active. Deactivation replaces deletion; no bulk/import/export/history controls are included.

## 5. State and responsive contract

Every screen defines the following observable states: initial loading; successful data; empty ownership/queue state; filtered no-results state where filtering exists; validation error; conflict/rate-limit error; forbidden/not-found; retryable API failure; and success feedback. State changes preserve the user's route/query where safe and return focus to the triggering control.

Breakpoints are exact and shared with Lab 2: desktop `>= 992px`, tablet `768–991px`, and mobile `< 768px`. Desktop uses a two-column detail layout where helpful, tablet reduces columns and wraps controls, and mobile stacks sections and converts tables to cards. At every width the page itself has no horizontal scroll; long Ticket Numbers, emails, comments, and notes wrap safely.

## 6. Visual and accessibility checklist

- [ ] Zen Green tokens and typography are consistent with Lab 2.
- [ ] Login and Change Password are readable, keyboard-operable, and show visible focus.
- [ ] Role-specific navigation and authenticated identity are visible without exposing forbidden controls.
- [ ] Requester list/create/detail retains Lab 2 behavior and adds comments/resolution indication.
- [ ] Queue and detail show assignment, priorities, statuses, comments, notes, and attachment continuity.
- [ ] Admin User Management stays minimal and excludes deletion, bulk actions, import/export, and dashboards.
- [ ] Loading, empty, no-results, retry, validation, forbidden, not-found, conflict, and success states are captured.
- [ ] Desktop, tablet, and mobile screenshots have readable text, 44px touch targets, visible focus, and no page-wide horizontal scrolling.
