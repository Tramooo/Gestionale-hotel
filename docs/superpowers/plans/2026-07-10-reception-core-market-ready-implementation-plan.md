# Reception Core Market-Ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to execute one task at a time in the current session, or superpowers:executing-plans for a separate-session implementation. Follow the five linked phase plans in order and keep their checkboxes current.

**Goal:** Deliver a serious, frontend-complete PMS Reception Core for independent Italian hotels with 20-100 rooms, while preserving the current backend boundary for a later phase.

**Architecture:** The release remains a build-free vanilla JavaScript SPA backed by the existing Vercel/Neon API surface. It introduces one in-memory store, hash routing, pure shared booking rules, canonical committed API updates, separated room operational states, and an accessible operational UI. Security and schema work refactor existing routes/helpers and controlled scripts; no new public serverless route is created.

**Tech Stack:** HTML, layered CSS, vanilla JavaScript IIFEs, Vercel functions, Neon PostgreSQL, Node.js built-in test runner, Playwright, axe-core.

**Approved design:** `docs/superpowers/specs/2026-07-10-reception-core-market-ready-design.md`

---

## Non-negotiable release invariants

- Never use `uncodixfy` during planning or implementation.
- Never create a public serverless route. Remove `api/init.js`; the final public route count is exactly 11.
- Remove Mail completely from UI, JavaScript, APIs, dependencies, storage, schema initialization, and tests. Migration 002 is the sole controlled cleanup reference.
- Keep authentication cookie-only, registration disabled by default, and sensitive/PII data out of persistent browser storage.
- Keep one account equal to one property for this release; roles and true multi-tenancy remain a later backend project.
- Preserve user input on validation, conflict, network, and server errors.
- Treat server responses as committed state; do not maintain competing room/reservation arrays.
- Desktop and tablet retain functional parity. Mobile supports daily actions, with Planning as the only horizontal-scroll exception.

## Ordered plan set

1. [Phase 01 - Foundation, Mail removal, and security](2026-07-10-reception-core-01-foundation.md)
   Establishes the safe platform: removes Mail, makes auth cookie-only, adds allowlisted preferences and stable API errors, moves DDL into controlled migrations, removes `api/init.js`, protects Alloggiati, and adds interim security headers.
2. [Phase 02 - Store, routing, shell, and search](2026-07-10-reception-core-02-shell-search.md)
   Creates the single client state flow, real hash navigation, approved primary/secondary information architecture, dedicated settings, accessible dialogs, network feedback, and `Ctrl/Cmd+K` entity search.
3. [Phase 03 - Availability and reservation lifecycle](2026-07-10-reception-core-03-booking-lifecycle.md)
   Makes booking rules authoritative on both client and existing APIs, migrates lifecycle/room fields, validates group and individual stays, returns stable conflicts, and commits check-in/check-out effects.
4. [Phase 04 - Housekeeping, Camere, and Oggi](2026-07-10-reception-core-04-housekeeping-oggi.md)
   Separates occupancy/service/housekeeping, adds committed room workflows, rebuilds Camere as an operational list, and replaces the generic dashboard with reactive daily queues.
5. [Phase 05 - Visual system, accessibility, and release QA](2026-07-10-reception-core-05-visual-accessibility-qa.md)
   Consolidates the visual system, finishes responsive/product surfaces, removes inline behavior, enforces final CSP, proves accessibility and workflows in Chromium, removes residue, and produces the release runbook.

Do not begin a later phase while an earlier phase has failing tests or uncommitted required changes. A focused failing test written for the next task is the only acceptable red state.

---

## Cross-phase contracts

| Contract | Introduced | Required by |
|---|---:|---:|
| `GroupStayApi.AppError` with `status`, `code`, `message`, `fieldErrors`, `conflicts` | 01 | 02-05 |
| `GroupStayPreferences` using only `gs_preferences_v1` | 01 | 02, 05 |
| `window.appStore` with `getState`, `setState`, selector subscriptions | 02 | 03-05 |
| `GroupStayRouter` hash routing and navigation | 02 | 03-05 |
| `GroupStayDialog.createDialogController` | 02 | 03, 05 |
| `GroupStayBookingRules` plus server parity fixtures | 03 | 03-04 |
| `GroupStayReservationActions.transition` committing `{ reservation, rooms }` | 03 | 04 |
| `serviceStatus`, `housekeepingStatus`, derived `occupancyStatus` | 03 | 04-05 |
| `GroupStayRoomState` and `GroupStayHousekeeping` | 04 | 04-05 |

Names and response shapes in a later phase must match these contracts exactly. If implementation reveals a necessary contract change, update the producing phase, its tests, every consuming phase plan, and the approved design record before continuing.

## Specification coverage

| Approved design area | Owning implementation tasks |
|---|---|
| Product scope and Reception Core information architecture | Phase 02 Tasks 2-4; Phase 04 Tasks 5-6 |
| Navigation, direct hashes, history, dedicated settings, global search | Phase 02 Tasks 2-6 |
| Reservation model, availability, capacity, conflicts, lifecycle, transition actions | Phase 03 Tasks 1-9 |
| Occupancy, service state, housekeeping readiness, Camere and Oggi | Phase 03 Tasks 2, 4, 6; Phase 04 Tasks 1-7 |
| Visual system, login, forms, responsive behavior, accessibility | Phase 05 Tasks 1-6 |
| Frontend store, data flow, safe DOM, dialogs and network feedback | Phase 01 Tasks 2-3, 7-8; Phase 02 Tasks 1, 5 |
| API/schema boundaries, controlled DDL and exact route count | Phase 01 Tasks 4-6; Phase 03 Tasks 2-4, 6 |
| Complete Mail removal | Phase 01 Tasks 1 and 5; Phase 05 Task 7 release scans |
| Security hardening and safe public errors | Phase 01 Tasks 2-3 and 6-9; Phase 05 Task 4 |
| Unit, parity, contract, browser, responsive and accessibility testing | Every phase completion gate; Phase 05 Tasks 5-7 |
| Market-release acceptance and operational handoff | Phase 05 Task 7 and this plan's final acceptance gate |

Every normative design section has one owning task and at least one automated or manual gate. Backend roles, true multi-tenancy, invitations, channel management, payments, and accounting remain explicitly outside this release.

## Execution protocol

- [ ] Start from branch `feature/reception-core-market-ready` in `.worktrees/reception-core-market-ready`.
- [ ] Run `npm.cmd install` and `npm.cmd test`; expected baseline before phase 01 is 52 passing tests.
- [ ] Execute each task test-first: write one failing behavior test, observe the expected failure, implement the smallest complete change, rerun focused tests, then run the full available suite.
- [ ] Use the exact commit boundary at the end of each task. Never fold unrelated user changes into a phase commit.
- [ ] After each phase, run `git diff --check`, inspect `git status --short`, and obtain a code review before starting the next phase.
- [ ] Do not run migration 002 against a real database without the explicit backup acknowledgement described in phase 01.
- [ ] Do not put credentials or production PII in fixtures, screenshots, console output, commits, or documentation.

## Phase gates

After phase 01:

```powershell
npm.cmd test
Get-ChildItem api -File -Filter '*.js' | Where-Object { -not $_.Name.StartsWith('_') }
rg -ni 'mail|imap|smtp' api js css index.html package.json package-lock.json
```

Expected: suite green; exactly 11 public routes; no Mail match in shipped production paths.

After phase 02:

```powershell
node --test tests/store.test.mjs tests/router.test.mjs tests/search.test.mjs tests/global-search-ui.test.mjs
npm.cmd test
```

Expected: focused and full suites green; direct hashes, history, and search contracts pass.

After phase 03:

```powershell
node --test tests/booking-rules.test.mjs tests/booking-rules-parity.test.mjs tests/reservations-api.test.mjs tests/reservation-actions.test.mjs
npm.cmd test
```

Expected: client/server rule parity, lifecycle transitions, stable conflicts, and committed check-out effects pass.

After phase 04:

```powershell
node --test tests/room-state.test.mjs tests/housekeeping.test.mjs tests/today.test.mjs tests/reception-operations-contract.test.mjs
npm.cmd test
```

Expected: Oggi, Camere, Planning, lifecycle, and housekeeping consume the same committed store state.

After phase 05:

```powershell
npm.cmd run test:all
npm.cmd audit --omit=dev
git diff --check
```

Expected: unit/browser/accessibility/responsive suites green, zero known production vulnerabilities, and no whitespace errors.

## Final acceptance gate

- [ ] A provisioned receptionist can log in; public account creation is unavailable in both UI and API.
- [ ] The receptionist can find a guest/reservation, verify availability, create/edit group and individual stays, handle a `409` conflict, check in, check out, and update housekeeping without reloading.
- [ ] Pending options block inventory until expiration; terminal reservations do not; same-day turnover uses half-open date intervals.
- [ ] Check-out makes every assigned room dirty in the committed server response and the change appears immediately in Oggi, Camere, and Planning.
- [ ] Back, forward, refresh, and direct hash links work for primary routes and entity detail.
- [ ] The app persists only allowlisted non-sensitive preferences and uses only HttpOnly cookie authentication.
- [ ] No active/dormant Mail surface, code, dependency, schema initialization, or credential remains.
- [ ] Alloggiati is fail-closed for user IDs outside the configured allowlist.
- [ ] There are exactly 11 public serverless route files and no newly created public function.
- [ ] At 320, 375, 768, 1024, and 1440 pixels, no document overflow exists; only Planning owns horizontal scrolling.
- [ ] Primary workflows are keyboard operable and axe reports zero critical/serious violations on required screens.
- [ ] Visual review confirms the sober operational system: IBM Plex, warm neutrals, one restrained green accent, separators, compact rows, no decorative dashboard cards, gradients, glows, or filler metrics.
- [ ] `npm.cmd run test:all`, production dependency audit, encoding scan, security scans, and `git diff --check` all pass on the final commit.

Only after every checkbox is satisfied should the branch use `superpowers:requesting-code-review`, followed by `superpowers:finishing-a-development-branch` to choose merge, pull request, or cleanup.
