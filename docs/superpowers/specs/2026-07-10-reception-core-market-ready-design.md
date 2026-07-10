# Reception Core Market-Ready Design

## Context

GroupStay is already a substantial hotel operations application. It supports individual and group reservations, room planning, guests and Alloggiati Web workflows, room assignments, menus, employee administration, compliance, files, printing, and a daily agenda. The current automated baseline is 52 passing tests.

The audit also found that the product is not yet ready to be sold as a general PMS:

- reservation lifecycle rules differ between group and individual bookings;
- availability logic is duplicated and does not consistently account for maintenance or capacity;
- room occupancy, serviceability, and housekeeping are conflated;
- desktop navigation omits existing primary pages;
- the advertised global search is non-functional;
- the frontend still depends on a 4,800-line glue file, global modules, 22 modal overlays, and 14 cascading stylesheets;
- sensitive credentials, a bearer token, and decrypted operational data can be stored in browser storage;
- dynamic user-controlled values reach unsafe HTML sinks;
- public registration is incompatible with the current single-property credentials and ownership model;
- the Aruba-specific Mail feature is unused by the product owner and creates disproportionate complexity;
- the deployment is already at the hard limit of 12 public serverless route files.

This design defines the first bounded product release: a professional reception workspace for independent Italian hotels with roughly 20-100 rooms. Later commercial, multi-tenant, and integration work remains deliberately separate.

## Product Decisions

- Target customer: an independent Italian hotel with 20-100 rooms, handling both individual guests and groups.
- Primary user: a receptionist performing high-frequency daily operations.
- Primary devices: desktop and tablet with equal functional coverage; mobile supports quick operational actions.
- Visual direction: sober, information-dense, and operational rather than decorative or card-heavy.
- Delivery strategy: an end-to-end Reception Core vertical slice, followed by separate product cycles.
- Current account boundary: one account represents one property.
- Mail: remove the Aruba mail feature completely from the current product.
- Frontend approach: incrementally improve the existing vanilla JavaScript application; do not rewrite it in a framework during this release.
- Serverless constraint: never add a new public file route under `api/`; the maximum remains 12.
- Explicit user constraint: do not use `uncodixfy`.

## Goals

1. Make the core reception workflow consistent, safe, fast, and understandable.
2. Provide one source of truth for availability and reservation lifecycle rules.
3. Separate room occupancy, service status, and housekeeping status.
4. Make all primary sections discoverable on desktop, tablet, and mobile.
5. Implement real client-side global search and reliable hash routing.
6. Replace the current visual inconsistency with a restrained operational system.
7. Reduce modal dependence and make long workflows easier to review and complete.
8. Remove unused Mail code, credentials, dependencies, database initialization, and tests.
9. Remove the most serious browser-side security risks.
10. Replace Mail-heavy test coverage with tests for booking, lifecycle, routing, search, accessibility contracts, and tenant-safe API behavior.

## Non-Goals

The following do not belong to this release:

- true multi-property tenancy, organizations, memberships, invitations, or staff roles;
- rate plans, seasonal restrictions, yield management, or channel inventory;
- folios, deposits, payments, invoicing, or tourist-tax accounting;
- channel manager, payment gateway, fiscal, or provider-independent messaging integrations;
- complete CRM, guest deduplication, loyalty, or marketing automation;
- advanced executive metrics such as ADR, RevPAR, pickup, and demand forecasting;
- a framework migration or a full rewrite of every secondary module;
- a redesign of the server architecture beyond the hardening and small data changes needed by Reception Core.

Secondary areas such as employees, management, menus, and compliance remain functional. They receive the common shell and base visual tokens, but deep workflow redesigns require later specifications.

## Information Architecture

### Primary navigation

The primary navigation order is:

1. `Oggi` (`#/oggi`)
2. `Planning` (`#/planning`)
3. `Prenotazioni` (`#/prenotazioni`)
4. `Ospiti` (`#/ospiti`)
5. `Camere` (`#/camere`)

Secondary navigation contains:

- `Gestione` (`#/gestione`)
- `Sicurezza` (`#/sicurezza`)
- `Impostazioni` (`#/impostazioni`), implemented as a dedicated page rather than another long modal

Mail is absent from all navigation, settings, shortcuts, details, and empty states.

### Device behavior

- Desktop uses a persistent, grouped sidebar. Every primary section is one click away.
- Tablet uses a collapsible sidebar without removing features or hiding essential context.
- Mobile uses four primary destinations plus `Altro`; any section is reachable in no more than two taps.
- Navigation writes the selected page to `location.hash`.
- Browser back, forward, refresh, and direct links restore the correct page.
- Unknown hashes fall back to `#/oggi` without leaving an empty shell.

### Global search

`Ctrl+K` and `Cmd+K` open a real command/search panel. Search operates on the already-loaded property dataset and does not require a new API route.

The first version searches:

- reservation/group name, organizer, email, phone, and reservation identifier;
- guest first name, last name, document number, email, and phone;
- room number and room type.

Results are grouped by entity, keyboard navigable, and limited to a manageable number per group. Selecting a result navigates to the relevant page and opens the entity detail. Empty, loading, and no-result states are explicit.

## Reservation Lifecycle

Group and individual reservations use the same canonical stored status values:

- `pending`, labelled `Opzione`;
- `confirmed`, labelled `Confermata`;
- `checked-in`, labelled `In casa`;
- `checked-out`, labelled `Partita`;
- `cancelled`, labelled `Cancellata`;
- `no-show`, labelled `No-show`.

Allowed normal transitions are:

- `pending -> confirmed | cancelled`;
- `confirmed -> checked-in | cancelled | no-show`;
- `checked-in -> checked-out`.

Terminal statuses are `checked-out`, `cancelled`, and `no-show`. Reopening a terminal reservation is not a normal action in this release. If correction is needed, the interface requires an explicit exceptional confirmation and the server records the new status timestamp. A complete audit log belongs to the backend phase.

### Status blocking rules

- `pending` blocks assigned rooms until the end of its expiration date.
- A `pending` reservation without an expiration date blocks assigned rooms for the full stay.
- An expired `pending` reservation remains visible and flagged but no longer blocks availability.
- `confirmed` and `checked-in` block assigned rooms.
- `checked-out`, `cancelled`, and `no-show` do not block availability.
- Stay intervals are half-open: `[checkin, checkout)`. A departure and a new arrival may use the same room on the same calendar date.

### Lifecycle actions

The reservation detail is the primary action surface. It exposes only the valid next actions for the current state.

Check-in requires:

- at least one assigned room;
- no server-confirmed availability conflict;
- all assigned rooms to be in service;
- an explicit override confirmation if a room is not ready for arrival;
- a visible warning for incomplete guest or Alloggiati data without making unsupported legal claims.

Check-out:

- changes the reservation to `checked-out`;
- records the checkout timestamp;
- marks every assigned room as `dirty`;
- refreshes Oggi, Planning, Prenotazioni, and Camere from the committed state.

No-show is available only for a confirmed reservation on or after its arrival date. Early check-in is possible only after a clear confirmation warning.

## Availability Rules

A pure frontend module is the single source of truth for presentation and preflight validation. Equivalent server-side checks run inside the existing reservations route.

Availability considers:

- half-open date overlap;
- canonical status blocking rules;
- option expiration;
- excluded reservation ID during edits;
- assigned room IDs;
- service status;
- room capacity;
- duplicate room selection.

Rooms in `maintenance` or `out-of-order` service status are unavailable regardless of booking state. Housekeeping state does not prevent a future reservation from being created, but it affects arrival readiness and check-in warnings.

For an individual reservation, selected room capacity must be at least the guest count. For a group reservation, the total capacity of distinct assigned rooms must be at least the guest count and the selected-room count must match the declared room count before confirmation or check-in. Options may be saved incomplete only when the interface labels them as incomplete and does not imply that unassigned inventory is held.

Client validation improves feedback but is not authoritative. `api/reservations.js` rechecks ownership, dates, status, room serviceability, capacity, and conflicts immediately before a create or update. A conflict returns HTTP `409` with a stable machine code and conflict details. This reduces accidental overbooking but does not claim full atomic inventory guarantees; transaction-level inventory belongs to the backend phase.

## Room Model and Housekeeping

The room presentation separates three independent concepts:

1. Occupancy: derived from blocking reservations for the selected date.
2. Service status: `active`, `maintenance`, or `out-of-order`.
3. Housekeeping status: `clean`, `dirty`, `in-progress`, or `inspected`.

Legacy room values are normalized during migration:

- `maintenance` remains `maintenance`;
- legacy `available` and `occupied` become service status `active` because occupancy is derived;
- housekeeping defaults to `clean` unless explicitly migrated otherwise.

The existing `rooms` table gains a housekeeping status and retains a service-status field through the existing schema migration process. `api/rooms.js` validates the allowed values and remains the only public room route.

The Camere page provides compact filters for floor, occupancy, service, and housekeeping. The default view prioritizes rooms requiring action. Reception or housekeeping staff can move a room through `dirty -> in-progress -> clean -> inspected`; the product does not invent staff roles during this release.

## Oggi Workspace

Oggi replaces the generic dashboard with an operational queue.

The top summary strip contains compact counts for arrivals, departures, in-house guests, available rooms, and rooms not ready. These are not separate decorative cards.

The main content is organized by urgency:

- arrivals awaiting check-in;
- departures awaiting check-out;
- in-house reservations with issues;
- rooms that are dirty, in progress, or out of service;
- expired options and data conflicts;
- agenda items.

Each row shows the minimum information needed to decide and exposes the next valid action. Urgent exceptions appear before normal work. There are no perpetual pulse effects or artificial marketing metrics.

## Reservation Detail and Forms

The reservation detail becomes a wide side panel on desktop and a full-screen panel on tablet/mobile. It contains:

- identity and status;
- stay dates and nights;
- assigned rooms and readiness;
- guest count and missing guest information;
- Alloggiati status and actions already supported by the product;
- organizer and contact details;
- notes and room notes;
- existing prices, extras, meal plan, files, and group-specific operational tools.

Long creation and edit forms use clear sections, a persistent summary, inline validation, and a sticky action area. Destructive actions are visually separated. Modals remain only for short confirmations and small atomic edits.

## Visual System

The interface uses IBM Plex Sans for UI text and IBM Plex Mono only for rooms, times, aligned dates, and monetary values, with system fallbacks. Inter and Fraunces are removed from the operational interface.

The visual language uses:

- a warm neutral application background;
- white working surfaces;
- a graphite or very dark green sidebar;
- one restrained accent color;
- accessible semantic colors that are always paired with text or an icon;
- small to medium corner radii;
- separators instead of pervasive shadows;
- a consistent spacing scale;
- compact rows suitable for prolonged operational use.

The initial core palette is a warm neutral background (`#F4F3EF`), white working surfaces, primary ink (`#18201D`), muted text (`#5B6460`), quiet borders (`#D7DBD8`), a dark green-graphite sidebar (`#1D2924`), and a restrained green accent (`#26755A`). Semantic foreground colors are selected and tested against their actual backgrounds to meet WCAG AA; color never carries status alone.

The dashboard card grid is replaced by summary strips and structured lists. Pill badges are reserved for true statuses or filters. Avatar initials and decorative gradients are not used as filler.

The login screen becomes a focused authentication surface. Promotional copy, artificial `1` and `24/7` metrics, and public registration controls are removed. Branding remains restrained and credible.

Unused dashboard PNGs, duplicate favicon output, unused font loads, obsolete CSS selectors, and superseded overrides are removed when verified safe.

## Responsive and Accessibility Requirements

- Desktop and tablet have functional parity.
- Mobile supports fast daily actions without presenting a 1,120-pixel desktop table as the only layout.
- There is no unintended horizontal overflow at 320, 375, 768, 1024, and 1440 pixels.
- The Planning board is the documented exception and may scroll horizontally.
- Oggi has no fixed-height nested scrolling regions.
- Contextual subtitles are not hidden globally on small screens.
- Touch targets are at least 44 by 44 pixels on tablet and mobile.
- Every form control has a programmatic label.
- Every icon-only button has an accessible name.
- Clickable cards, rows, and cells become semantic buttons, links, or keyboard-operable grid controls.
- Dialogs expose `role="dialog"`, `aria-modal`, and an associated title; they trap focus, close on `Escape`, and restore focus to the trigger.
- Tabs and filters expose the appropriate selected or pressed state.
- Toasts, errors, loading states, and important count updates use suitable live regions.
- All normal-size text and interactive states meet WCAG AA contrast.
- Motion respects `prefers-reduced-motion`.
- The full primary workflow is operable with a keyboard.

## Frontend Architecture

The application stays build-free and framework-free during this release. New and extracted modules use the existing browser-loading style but have explicit responsibilities and dependency injection instead of adding more unrelated globals.

Target boundaries include:

- `js/core/router.js`: hash parsing, page registration, navigation, and history synchronization;
- `js/core/store.js`: in-memory application state and narrow subscriptions;
- `js/core/booking-rules.js`: pure lifecycle, overlap, capacity, and readiness rules;
- `js/core/search.js`: normalization, indexing, grouping, and search ranking;
- shared safe DOM and accessible dialog utilities under `js/core` and `js/ui`;
- focused feature modules for Oggi, reservation actions, and housekeeping.

`script.js` remains a compatibility entry point during the migration, but new domain logic does not return to it. Existing feature modules are changed only where they need to consume the new shared contracts.

The data flow is:

1. authenticate through the HttpOnly cookie;
2. load the property dataset through existing routes;
3. normalize it into the in-memory store;
4. render subscribed views;
5. validate an action locally;
6. submit through the shared API client;
7. commit the returned state or roll back on failure;
8. update every affected view from the store.

Optimistic changes are allowed only when the original value is retained and rollback is deterministic.

## API and Schema Boundaries

No new public serverless route file may be created. The public route count must stay at or below 12.

Allowed changes are:

- extend `api/reservations.js` for lifecycle transitions and conflict validation;
- extend `api/rooms.js` for service and housekeeping fields;
- simplify `api/auth.js` after Mail removal and disable public registration by default;
- remove Mail initialization from `api/init.js`;
- add reusable underscore-prefixed helpers that are not public route files;
- add deployment scripts under `scripts/`.

Schema changes needed by Reception Core include normalized room states and reservation lifecycle timestamps such as `status_updated_at`, `checked_in_at`, `checked_out_at`, `cancelled_at`, and `no_show_at`.

DDL and data backfills move to an explicit, idempotent migration script run during deployment or controlled setup. Normal browser login no longer triggers schema mutation. After the migration script and client bootstrap are in place, `api/init.js` is removed. This reduces the public serverless route count from 12 to 11 and eliminates the legacy browser-triggered ownership backfill.

## Mail Removal

Mail removal is complete rather than cosmetic. Remove:

- the Mail sidebar and mobile entries;
- the Mail page, detail UI, compose/reply UI, settings, translations, and linked-reservation section;
- `js/features/mail.js`, `js/features/mail-ui.js`, and Mail-only CSS;
- Mail bootstrap wiring, state, cache data, and API calls;
- Mail actions and imports from existing auth and reservation routes;
- Mail schema initialization and backend helpers (`api/_mail.js`, `api/_mail-utils.js`, and `api/_mail-crypto.js`);
- Mail-specific tests;
- `imapflow`, `mailparser`, and `nodemailer` from `package.json` and the lockfile.

The controlled schema migration drops `mail_messages` and `mail_accounts` only after an explicit backup acknowledgement. The shipped application neither creates nor reads Mail tables.

Git history preserves the previous implementation if a future provider-independent communication product needs research material. No dormant credentials or hidden Mail entry points remain in the shipped app.

## Security Hardening

The release removes the most serious browser-side risks discovered in the audit:

- remove remembered plaintext passwords and the associated login copy;
- stop returning or persisting a JavaScript-readable bearer token when same-origin HttpOnly cookies are available;
- keep session authentication cookie-only;
- remove decrypted guests, employees, and reservation payloads from persistent browser caches;
- limit `localStorage` to an explicit allowlist of non-sensitive preferences such as language and planner display density;
- encode user-controlled content or construct it with safe DOM APIs before insertion;
- add restrictive CSP and standard security headers in hosting configuration, without adding a route;
- disable public registration in both UI and API by default until invitations, tenants, and roles exist;
- prevent Alloggiati actions for accounts not explicitly authorized for the configured property credentials;
- return public error codes/messages instead of raw internal exception details.

The management PIN remains only a local privacy screen in this release and must not be described as authorization. Server-enforced roles are a backend-phase requirement.

## Error Handling

The API client normalizes failures into a stable shape containing a user-safe message, a machine-readable code, optional field errors, and optional conflict details.

- `400` and `422`: show inline field errors and preserve all user input.
- `401`: clear volatile state and return to login with a session-expired explanation.
- `403`: explain that the account is not allowed to perform the action.
- `409`: show conflicting reservation/room/date information and keep the editor open.
- network failure: show a persistent offline/retry banner and do not discard edits.
- `5xx`: show a generic safe error, log only non-sensitive diagnostic context, and preserve local form state.

Loading buttons prevent duplicate submission. Silent catch-and-ignore behavior is removed from core reception flows. Toasts confirm completed background actions; errors that require user action remain visible near the affected workflow.

## Testing Strategy

Mail-heavy tests are removed only together with their production feature. They are replaced with coverage for the product core.

### Unit tests

- date overlap and same-day turnover;
- option expiration and blocking status rules;
- lifecycle transition matrix;
- individual and group capacity validation;
- maintenance and housekeeping readiness;
- check-out housekeeping effects;
- search normalization, grouping, and ranking;
- hash parsing and fallback routing;
- safe escaping/DOM helpers.

### API and contract tests

- cookie-only session behavior;
- registration disabled by default;
- reservation conflict response and `409` payload;
- ownership checks on related rooms and reservations;
- allowed room and reservation state values;
- no Mail imports, actions, markup, assets, settings, dependencies, or schema calls;
- `api/init.js` is absent and the resulting public API route count is exactly 11;
- module loading order and required accessibility attributes;
- idempotent controlled migration behavior.

### Browser smoke tests

Automated browser smoke coverage must verify:

- login with a provisioned account;
- keyboard and pointer navigation through all sections;
- global search to entity detail;
- reservation creation and editing;
- check-in and check-out;
- housekeeping status update;
- conflict and offline/error presentation;
- focus handling in panels and dialogs;
- responsive behavior at the agreed viewport widths.

Accessibility checks must report zero critical or serious violations on the login, Oggi, Planning, Prenotazioni, reservation detail, and Camere screens.

## Acceptance Criteria

The release is accepted when a receptionist can complete, without assistance:

1. find a reservation or guest;
2. verify real room availability;
3. create or update an individual or group stay;
4. check a reservation in and out;
5. understand and update room readiness;
6. identify conflicts, incomplete information, and the next action.

In addition:

- every primary section is one click away on desktop and at most two taps away on mobile;
- browser back, forward, refresh, and direct hashes work;
- the application contains no active or dormant Mail feature;
- no password, session token, guest PII, employee data, or reservation payload is persisted in browser storage;
- there are no known console errors in the acceptance flows;
- there is no unintended overflow at the required viewport sizes;
- the core workflow is keyboard operable;
- automated tests pass;
- the release contains exactly 11 public serverless route files after removing `api/init.js` and never adds a replacement route;
- no implementation uses `uncodixfy`.

## Delivery Sequence

The implementation plan must break this design into verifiable slices:

1. remove Mail and establish a clean automated baseline;
2. harden authentication, browser storage, safe rendering, and schema migration flow;
3. introduce router, store, navigation shell, global search, and accessible primitives;
4. implement booking rules and server conflict validation;
5. unify reservation lifecycle and detail actions;
6. separate room service, occupancy, and housekeeping and connect check-out effects;
7. rebuild Oggi around operational queues;
8. apply the visual system and responsive/accessibility pass across the Reception Core;
9. run full automated, browser, responsive, and manual acceptance verification.

Each slice must leave the current application usable and must not add a public serverless route.

## Later Product Roadmap

After Reception Core, separate specifications will cover:

1. Commercial operations: rate plans, deposits, payments, folio, tourist tax, and documents.
2. Multi-client backend: properties, organizations, memberships, invitations, roles, audit events, backups, and controlled migrations.
3. Integrations: payments, fiscal systems, channel manager, object storage, and provider-independent communications.
4. Direction and revenue management: ADR, RevPAR, pickup, forecasts, segmentation, and advanced reporting.
