# Reception Core Phase 05: Visual System, Accessibility, and Release QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Use `design-taste-frontend` for Tasks 1-3, calibrated to the approved operational brief. Do not use `uncodixfy`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Reception Core as a sober, coherent, accessible product and prove the primary workflows at every supported viewport.

**Architecture:** Preserve the build-free vanilla application. Consolidate the cascade into explicit layers, remove inline behavior so a strict CSP is possible, strengthen shared accessible primitives, and run browser acceptance tests against a deterministic local fixture server. Visual work consumes the shell and operational features from phases 01-04; it does not invent a second component or state system.

**Tech Stack:** HTML, layered CSS, vanilla JavaScript, Node.js test runner, Playwright, `@axe-core/playwright`, existing Vercel configuration.

**Design calibration:** The user's sober operational direction overrides the skill defaults: design variance 3/10, motion 2/10, and visual density 7/10. Use one restrained accent, separators instead of decorative cards, static feedback states, compact rows, and no perpetual animation, glass, bento, glow, gradient text, or decorative avatars.

**Prerequisites:** Complete plans 01-04 and start this phase with the full unit suite green.

---

### Task 1: Establish the release visual tokens and a controlled cascade

**Files:**
- Modify: `css/00-foundation.css`
- Create: `css/01-shell.css`
- Create: `css/05-feature-pages.css`
- Create: `css/06-responsive.css`
- Create: `css/07-print.css`
- Modify: `css/02-lists-data.css`
- Modify: `css/03-calendar.css`
- Modify: `css/04-modals-forms.css`
- Delete: `css/01-cards-dashboard-base.css`
- Delete: `css/05-compliance-detail.css`
- Delete: `css/06-activity-responsive.css`
- Delete: `css/07-assignments-employees-auth.css`
- Delete: `css/08-refresh-overrides.css`
- Delete: `css/09-dashboard-overrides.css`
- Delete: `css/10-mobile.css`
- Delete: `css/11-new-dashboard.css`
- Delete: `css/13-ios-tablet.css`
- Modify: `index.html:14-33`
- Create: `tests/css-architecture.test.mjs`

- [ ] **Step 1: Write the failing cascade contract**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync('index.html', 'utf8');
const expected = ['00-foundation', '01-shell', '02-lists-data', '03-calendar',
  '04-modals-forms', '05-feature-pages', '06-responsive', '07-print'];

test('loads exactly one ordered stylesheet per release layer', () => {
  const linked = [...html.matchAll(/href=['\x22]css\/([^'\x22]+)\.css/g)].map((match) => match[1]);
  assert.deepEqual(linked, expected);
});

test('defines the approved palette and typography once', () => {
  const css = fs.readFileSync('css/00-foundation.css', 'utf8');
  for (const value of ['#F4F3EF', '#18201D', '#5B6460', '#D7DBD8', '#1D2924', '#26755A']) {
    assert.ok(css.toUpperCase().includes(value));
  }
  assert.match(css, /IBM Plex Sans/);
  assert.match(css, /IBM Plex Mono/);
  assert.doesNotMatch(html, /Inter|Fraunces/);
});

test('removes superseded override sheets', () => {
  for (const file of ['08-refresh-overrides.css', '11-new-dashboard.css', '13-ios-tablet.css']) {
    assert.equal(fs.existsSync(`css/${file}`), false);
  }
});
```

- [ ] **Step 2: Run the contract and verify RED**

Run: `node --test tests/css-architecture.test.mjs`

Expected: FAIL because the old 14-sheet override cascade and Inter/Fraunces loads remain.

- [ ] **Step 3: Define the token source of truth**

Replace competing root variables with this base in `css/00-foundation.css`, then map existing component aliases to these values while migrating selectors:

```css
:root {
  color-scheme: light;
  --font-sans: 'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, 'SFMono-Regular', monospace;
  --app-bg: #f4f3ef;
  --surface: #ffffff;
  --surface-subtle: #eeefec;
  --text: #18201d;
  --text-muted: #5b6460;
  --border-subtle: #d7dbd8;
  --border-strong: #aeb6b1;
  --sidebar: #1d2924;
  --accent: #26755a;
  --accent-hover: #1f624b;
  --danger: #a33d36;
  --warning: #8a5a13;
  --success: #226b50;
  --focus: #1e6ea8;
  --radius-sm: 4px;
  --radius-md: 8px;
  --space-1: .25rem;
  --space-2: .5rem;
  --space-3: .75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --text-xs: .75rem;
  --text-sm: .875rem;
  --text-md: 1rem;
  --text-lg: 1.25rem;
  --text-xl: 1.75rem;
}
```

Use IBM Plex Mono only for room numbers, dates, times, aligned monetary values, and tabular numerals. Keep ordinary labels in IBM Plex Sans.

- [ ] **Step 4: Move selectors into explicit ownership layers**

Move rules without changing behavior first, then remove duplicates in the same layer:

- `01-shell.css`: app frame, sidebar, mobile navigation, headers, command trigger, banners;
- `02-lists-data.css`: rows, tables, filters, status labels, empty/loading/error rows;
- `03-calendar.css`: Planning, agenda, date grids, horizontal-board exception;
- `04-modals-forms.css`: fields, panels, dialogs, buttons, validation and sticky actions;
- `05-feature-pages.css`: login, Oggi, Camere, Prenotazioni, Ospiti, Gestione and compliance-specific composition;
- `06-responsive.css`: only viewport adaptations, ordered `1024`, `768`, `480` pixels;
- `07-print.css`: only `@media print` output rules.

Before deleting an old file, use `rg -n` on each selector family and move its live declarations. Do not keep a duplicate selector as an undocumented override. Keep component state selectors adjacent to the base component.

Update `index.html` to link the eight release sheets in the test order and to load only the two IBM Plex families. Add `preconnect` for `fonts.googleapis.com` and `fonts.gstatic.com`; phase-01 CSP must allow those two origins or the implementation must self-host the font files.

- [ ] **Step 5: Add deterministic interaction states**

Every actionable component receives visible `:hover`, `:active`, `:focus-visible`, `[disabled]`, `[aria-busy='true']`, error, empty, and loading treatment. Use only opacity and a one-pixel transform for tactile feedback:

```css
:where(button, a, input, select, textarea):focus-visible {
  outline: 3px solid color-mix(in srgb, var(--focus) 55%, transparent);
  outline-offset: 2px;
}
.button:active:not(:disabled) { transform: translateY(1px); }
.button[aria-busy='true'], .button:disabled { cursor: not-allowed; opacity: .58; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; }
}
```

- [ ] **Step 6: Verify the cascade and commit**

Run: `node --test tests/css-architecture.test.mjs tests/ui-contract.test.js`

Expected: all tests PASS.

Run: `rg -n '!important|linear-gradient|box-shadow' css`

Expected: only documented accessibility/print exceptions for `!important`, no decorative gradients, and shadows only on elevated dialogs/panels.

Run: `git diff --check`

Expected: no whitespace errors.

```powershell
git add index.html css tests/css-architecture.test.mjs
git commit -m 'refactor: establish the release visual system'
```

---

### Task 2: Finish the shell, login, panels, and forms as one product

**Files:**
- Modify: `index.html`
- Modify: `js/features/app-shell.js`
- Modify: `js/features/settings.js`
- Modify: `js/features/group-reservation.js`
- Modify: `js/features/individual-reservation.js`
- Modify: `js/features/reservation-detail.js`
- Modify: `css/01-shell.css`
- Modify: `css/04-modals-forms.css`
- Modify: `css/05-feature-pages.css`
- Create: `tests/product-ui-contract.test.mjs`

- [ ] **Step 1: Write the failing product-surface contract**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync('index.html', 'utf8');

test('login is focused and has no promotional or registration UI', () => {
  assert.ok(html.includes(`id='loginForm'`));
  assert.ok(!html.includes(`id='registerForm'`));
  assert.ok(!html.includes('24/7'));
  assert.ok(!html.includes(`type='checkbox' id='rememberMe'`));
});

test('long reservation forms expose sections, summary, and sticky actions', () => {
  for (const id of ['reservationIdentity', 'reservationStay', 'reservationRooms',
    'reservationGuests', 'reservationCommercial', 'reservationSummary', 'reservationActions']) {
    assert.ok(html.includes(`id='${id}'`));
  }
});

test('primary navigation contains only the approved reception areas', () => {
  const shell = fs.readFileSync('js/features/app-shell.js', 'utf8');
  for (const label of ['Oggi', 'Planning', 'Prenotazioni', 'Ospiti', 'Camere']) assert.ok(shell.includes(label));
  assert.ok(!shell.includes('Mail'));
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/product-ui-contract.test.mjs`

Expected: FAIL on the old login and unstructured reservation forms.

- [ ] **Step 3: Recompose the login and application frame**

Use a single-column login surface capped at `28rem`, with property mark, title, concise session guidance, email/password, persistent inline error region, and submit button. Remove promotional statistics, public registration, remembered-password controls, illustration filler, and decorative gradients.

Keep the desktop sidebar at `15rem`; use a compact `3.5rem` collapsed state without losing accessible names. The top bar contains page context, connection status, global-search trigger, and account menu. On mobile, expose the five primary sections plus a labelled `Altro` entry; secondary tools remain at most two taps away.

- [ ] **Step 4: Standardize long-form composition**

Both reservation editors use `<fieldset>`/`<legend>` or labelled `<section>` blocks for identity, stay, rooms, guests, commercial details, and notes. Place the live summary in an `<aside aria-labelledby='reservationSummaryTitle'>`; use a sticky action bar with Save/Cancel and place destructive actions in a separated danger area.

Each field follows this markup contract:

```html
<div class='field' data-field='contactEmail'>
  <label for='contactEmail'>Email referente</label>
  <input id='contactEmail' name='contactEmail' type='email' autocomplete='email' aria-describedby='contactEmailHelp contactEmailError'>
  <p id='contactEmailHelp' class='field-help'>Usata per i riferimenti della prenotazione.</p>
  <p id='contactEmailError' class='field-error' aria-live='polite'></p>
</div>
```

Use inline errors from `AppError.fieldErrors`; focus the first invalid field after a rejected submission and preserve every entered value. Loading controls set `aria-busy='true'` and prevent duplicate submission.

- [ ] **Step 5: Verify the unified surface and commit**

Run: `node --test tests/product-ui-contract.test.mjs tests/auth-contract.test.mjs tests/booking-forms.test.mjs`

Expected: all focused tests PASS.

Run: `npm.cmd test`

Expected: full unit suite PASS.

```powershell
git add index.html js/features/app-shell.js js/features/settings.js js/features/group-reservation.js js/features/individual-reservation.js js/features/reservation-detail.js css/01-shell.css css/04-modals-forms.css css/05-feature-pages.css tests/product-ui-contract.test.mjs
git commit -m 'feat: finish the core product surfaces'
```

---

### Task 3: Make daily operations responsive without hiding context

**Files:**
- Modify: `index.html`
- Modify: `js/features/today.js`
- Modify: `js/features/rooms.js`
- Modify: `js/features/planner.js`
- Modify: `js/features/reservations.js`
- Modify: `js/features/guests.js`
- Modify: `css/02-lists-data.css`
- Modify: `css/03-calendar.css`
- Modify: `css/06-responsive.css`
- Create: `tests/responsive-contract.test.mjs`

- [ ] **Step 1: Write the failing responsive source contract**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/06-responsive.css', 'utf8');

test('declares the planning board as the only horizontal overflow region', () => {
  assert.ok(html.includes(`data-horizontal-scroll='planning'`));
  assert.doesNotMatch(css, /body[^}]*overflow-x:\s*(auto|scroll)/s);
  assert.match(css, /\.planning-scroll[^}]*overflow-x:\s*auto/s);
});

test('keeps contextual subtitles and forty-four pixel touch controls', () => {
  assert.doesNotMatch(css, /page-subtitle[^}]*display:\s*none/s);
  assert.match(css, /min-(block-size|height):\s*44px/);
  assert.match(css, /min-(inline-size|width):\s*44px/);
});

test('operational rows expose mobile labels', () => {
  for (const sourceFile of ['today.js', 'rooms.js', 'reservations.js', 'guests.js']) {
    assert.match(fs.readFileSync(`js/features/${sourceFile}`, 'utf8'), /data-label/);
  }
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/responsive-contract.test.mjs`

Expected: FAIL until legacy desktop-only widths and hidden subtitles are removed.

- [ ] **Step 3: Implement the three responsive modes**

Use these behavior boundaries, not device detection:

- `> 1024px`: full sidebar, multi-column forms, dense data rows;
- `769-1024px`: collapsible sidebar, same features and actions, two-column where space permits;
- `<= 768px`: mobile navigation, one-column forms, row data reflowed into labelled key/value blocks;
- `<= 480px`: tighter page gutters while retaining `44px` controls.

Every table-like mobile row must keep its primary identity, dates, status text, and next action. Add `data-label` values in the safe row builders and expose them through `::before`; do not hide columns whose contents are required to decide an action.

```css
@media (max-width: 768px) {
  .data-row { grid-template-columns: minmax(0, 1fr) auto; }
  .data-cell[data-label] { display: grid; grid-template-columns: minmax(7rem, 40%) minmax(0, 1fr); gap: var(--space-2); }
  .data-cell[data-label]::before { content: attr(data-label); color: var(--text-muted); font-weight: 500; }
  :where(button, [role='button'], input, select, textarea) { min-block-size: 44px; }
  :where(.icon-button, [data-icon-only]) { min-inline-size: 44px; }
}
```

Planning remains a keyboard-scrollable region with `tabindex='0'`, an accessible label, sticky room identity column, and visible overflow hint. Do not scale the 1,120-pixel board down until its content becomes unreadable.

- [ ] **Step 4: Remove fixed nested Oggi scrolling and viewport traps**

Remove fixed heights, `100vh`, and nested `overflow-y: auto` from Oggi queues and general page content. Use `min-height: 100dvh` only on the outer application/login frame. Preserve browser document scrolling on mobile.

- [ ] **Step 5: Verify and commit**

Run: `node --test tests/responsive-contract.test.mjs tests/today-ui.test.mjs tests/rooms-ui.test.mjs`

Expected: all focused tests PASS.

```powershell
git add index.html js/features/today.js js/features/rooms.js js/features/planner.js js/features/reservations.js js/features/guests.js css/02-lists-data.css css/03-calendar.css css/06-responsive.css tests/responsive-contract.test.mjs
git commit -m 'feat: make reception workflows responsive'
```

---

### Task 4: Remove inline behavior and enforce the final CSP

**Files:**
- Create: `js/core/action-registry.js`
- Create: `js/core/vendor-config.js`
- Modify: `index.html`
- Modify: `script.js`
- Modify: `js/features/*.js` (only modules owning migrated actions)
- Modify: `vercel.json`
- Create: `tests/csp-contract.test.mjs`
- Create: `tests/action-registry.test.mjs`

- [ ] **Step 1: Write failing CSP and inline-handler tests**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync('index.html', 'utf8');
const vercel = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));

test('contains no inline event, style, or script code', () => {
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  assert.doesNotMatch(html, /\sstyle\s*=/i);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/i);
});

test('CSP disables inline script and style attributes', () => {
  const headers = vercel.headers.flatMap((entry) => entry.headers);
  const value = headers.find((header) => header.key === 'Content-Security-Policy')?.value || '';
  assert.match(value, /script-src-attr 'none'/);
  assert.match(value, /style-src-attr 'none'/);
  assert.doesNotMatch(value, /'unsafe-inline'|'unsafe-eval'/);
  assert.match(value, /object-src 'none'/);
  assert.match(value, /frame-ancestors 'none'/);
});
```

In `tests/action-registry.test.mjs`, load the registry in a VM with a minimal fake root. Assert that `click`, `submit`, `input`, and `change` delegate to the registered handler with the matched element, that unknown actions do nothing, and that `destroy()` removes all four listeners.

- [ ] **Step 2: Run both tests and verify RED**

Run: `node --test tests/action-registry.test.mjs tests/csp-contract.test.mjs`

Expected: FAIL on inline attributes and the missing registry/final policy.

- [ ] **Step 3: Implement one bounded legacy action registry**

Feature modules should keep their local listeners. Use this registry only to migrate legacy markup whose owner still lives in `script.js`:

```js
(function initActionRegistry(global) {
  function createActionRegistry(root = document) {
    const handlers = new Map();
    const eventTypes = ['click', 'submit', 'input', 'change'];
    const dispatch = (event) => {
      const target = event.target.closest(`[data-${event.type}-action]`);
      if (!target || !root.contains(target)) return;
      const name = target.dataset[`${event.type}Action`];
      const handler = handlers.get(`${event.type}:${name}`);
      if (handler) handler({ event, target, data: { ...target.dataset } });
    };
    eventTypes.forEach((type) => root.addEventListener(type, dispatch));
    return {
      register(type, name, handler) { handlers.set(`${type}:${name}`, handler); },
      destroy() { eventTypes.forEach((type) => root.removeEventListener(type, dispatch)); handlers.clear(); }
    };
  }
  global.GroupStayActionRegistry = { createActionRegistry };
})(window);
```

Replace each `onclick`, `onsubmit`, `oninput`, and `onchange` with an equivalent `data-*-action` and explicit `data-*` parameters. Register the existing named function once during boot. Replace inline `style='display:none'` with the standard `hidden` attribute or a state class.

- [ ] **Step 4: Externalize the PDF worker setup**

Move the inline PDF worker assignment into `js/core/vendor-config.js`, load it after PDF.js, and fail safely when the vendor is unavailable:

```js
(function configureVendors(global) {
  if (global.pdfjsLib?.GlobalWorkerOptions) {
    global.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.js';
  }
})(window);
```

- [ ] **Step 5: Apply the final hosting policy without adding a route**

Keep phase-01 standard headers and replace its interim policy with:

```text
default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' https://cdnjs.cloudflare.com https://cdn.sheetjs.com; script-src-attr 'none'; style-src 'self' https://fonts.googleapis.com; style-src-attr 'none'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob: https://cdnjs.cloudflare.com; manifest-src 'self'
```

This is a static `vercel.json` header change. Do not create a CSP endpoint, nonce route, or any other public function.

- [ ] **Step 6: Verify and commit**

Run: `node --test tests/action-registry.test.mjs tests/csp-contract.test.mjs tests/ui-contract.test.js`

Expected: all tests PASS.

Run: `rg -n '\son[a-z]+\s*=|\sstyle\s*=' index.html js`

Expected: no matches.

Run: `npm.cmd test`

Expected: full unit suite PASS.

```powershell
git add index.html script.js js/core/action-registry.js js/core/vendor-config.js js/features vercel.json tests/action-registry.test.mjs tests/csp-contract.test.mjs
git commit -m 'security: enforce a strict frontend policy'
```

---

### Task 5: Complete semantic and keyboard accessibility

**Files:**
- Modify: `index.html`
- Modify: `js/ui/dialog.js`
- Modify: `js/ui/feedback.js`
- Modify: `js/ui/datepicker.js`
- Modify: `js/features/app-shell.js`
- Modify: `js/features/global-search.js`
- Modify: `js/features/today.js`
- Modify: `js/features/rooms.js`
- Modify: `js/features/planner.js`
- Modify: `css/00-foundation.css`
- Modify: `css/04-modals-forms.css`
- Create: `tests/accessibility-contract.test.mjs`

- [ ] **Step 1: Write the failing accessibility contract**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync('index.html', 'utf8');

test('declares live regions for status, errors, and network state', () => {
  for (const id of ['toastRegion', 'formErrorRegion', 'networkStatus']) {
    assert.match(html, new RegExp(`id=['\\x22]${id}['\\x22][^>]*(aria-live|role=)`));
  }
});

test('dialogs are named and modal', () => {
  const dialogs = [...html.matchAll(/<[^>]+role=['\x22]dialog['\x22][^>]*>/g)].map((match) => match[0]);
  assert.ok(dialogs.length > 0);
  for (const dialog of dialogs) {
    assert.match(dialog, /aria-modal=['\x22]true['\x22]/);
    assert.match(dialog, /aria-labelledby=['\x22][^'\x22]+['\x22]/);
  }
});

test('icon controls and planning scroll have accessible names', () => {
  assert.doesNotMatch(html, /<button(?=[^>]*icon-button)(?![^>]*(aria-label|aria-labelledby))[^>]*>/g);
  assert.match(html, /data-horizontal-scroll=['\x22]planning['\x22][^>]*(aria-label|aria-labelledby)/);
});

test('feature renderers do not create clickable divs', () => {
  const source = ['today.js', 'rooms.js', 'planner.js', 'global-search.js']
    .map((file) => fs.readFileSync(`js/features/${file}`, 'utf8')).join('\n');
  assert.doesNotMatch(source, /<div[^>]+data-(action|.*-action)=/);
});
```

- [ ] **Step 2: Run the contract and verify RED**

Run: `node --test tests/accessibility-contract.test.mjs`

Expected: FAIL on unnamed controls, incomplete dialog semantics, and missing live regions.

- [ ] **Step 3: Audit markup by interaction type**

Apply these exact rules throughout the primary workflows:

- navigation destinations are anchors with current location exposed through `aria-current='page'`;
- actions are buttons with explicit `type='button'` unless they submit a form;
- icon-only buttons have an Italian `aria-label` describing the action;
- every input/select/textarea has a `<label for>` or `aria-labelledby`;
- filter chips expose `aria-pressed`; tabs use tablist/tab/tabpanel roles and selected state;
- status color is paired with visible text and, when helpful, a non-decorative icon;
- decorative SVGs use `aria-hidden='true'` and `focusable='false'`;
- Oggi/Camere row identities are links or buttons, never clickable generic containers.

- [ ] **Step 4: Verify the shared dialog lifecycle**

Keep `GroupStayDialog.createDialogController` as the only focus implementation. Its tests and implementation must guarantee: focus moves to the first valid control, `Tab`/`Shift+Tab` wrap inside, `Escape` closes when allowed, backdrop click follows the dialog's explicit policy, and focus returns to the exact trigger. Nested confirmation dialogs restore focus to the parent dialog, not to the page.

Use the same controller for global search, reservation detail panel, confirmations, short editors, and mobile `Altro`. Remove every ad-hoc keydown/focus-trap implementation.

- [ ] **Step 5: Announce meaningful asynchronous state**

Use `js/ui/feedback.js` to update three persistent regions: polite success toasts, assertive form errors, and polite network/session status. Set `aria-busy` on the affected region while loading. Skeletons match their eventual row dimensions and contain no announced filler text. Empty states include a concrete next action where the user can populate the list.

- [ ] **Step 6: Run focused keyboard contracts and commit**

Run: `node --test tests/accessibility-contract.test.mjs tests/dialog.test.mjs tests/global-search-ui.test.mjs tests/responsive-contract.test.mjs`

Expected: all focused tests PASS.

Run: `npm.cmd test`

Expected: full unit suite PASS.

```powershell
git add index.html js/ui/dialog.js js/ui/feedback.js js/ui/datepicker.js js/features/app-shell.js js/features/global-search.js js/features/today.js js/features/rooms.js js/features/planner.js css/00-foundation.css css/04-modals-forms.css tests/accessibility-contract.test.mjs
git commit -m 'feat: complete keyboard and screen reader support'
```

---

### Task 6: Add browser, accessibility, and viewport acceptance coverage

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `playwright.config.mjs`
- Create: `scripts/serve-static.mjs`
- Create: `tests/browser/fixtures.mjs`
- Create: `tests/browser/accessibility.spec.mjs`
- Create: `tests/browser/responsive.spec.mjs`
- Create: `tests/browser/reception-flow.spec.mjs`

- [ ] **Step 1: Install the explicit browser-test dependencies**

Run: `npm.cmd install --save-dev @playwright/test @axe-core/playwright`

Expected: both packages appear in `devDependencies`; no production dependency is added.

Run: `npx.cmd playwright install chromium`

Expected: the pinned Chromium browser installs successfully.

Set the package scripts exactly as follows: `test` runs `npm run test:unit`; `test:unit` runs `node --test tests/*.test.js tests/*.test.mjs`; `test:browser` runs `playwright test`; `test:all` runs `npm run test:unit && npm run test:browser`. Preserve `migrate:schema` and `migrate:guest-encryption` from the earlier phases.

- [ ] **Step 2: Add a path-safe static test server and Playwright config**

`scripts/serve-static.mjs` must resolve requests below `process.cwd()`, reject traversal with `403`, return correct MIME types for HTML/JS/CSS/JSON/SVG/PNG, map `/` to `index.html`, and never proxy or execute `api/` files. Listen on `127.0.0.1:4173` and close cleanly on `SIGTERM`.

```js
// playwright.config.mjs
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'node scripts/serve-static.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false
  }
});
```

- [ ] **Step 3: Build deterministic API fixtures through browser interception**

Export `test` and `expect` from `tests/browser/fixtures.mjs`. Intercept existing routes only. The fixture dataset uses property `Hotel Rivamare`, rooms `101`, `102`, `201`, and realistic Italian guest/reservation data with one arrival, one in-house departure, one pending option, and one dirty room.

```js
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  authenticatedPage: async ({ page }, use) => {
    const state = structuredClone(FIXTURE_STATE);
    await page.route('**/api/**', (route) => respondFromFixture(route, state));
    await page.goto('/');
    await page.getByLabel('Email').fill('reception@rivamare.test');
    await page.getByLabel('Password').fill('Test-passphrase-47');
    await page.getByRole('button', { name: 'Accedi' }).click();
    await expect(page.getByRole('heading', { name: 'Oggi' })).toBeVisible();
    await use(page);
  }
});

export { expect };
```

`respondFromFixture` handles the already-existing auth, rooms, reservations, guests, menus, employees, management, agenda, and compliance URLs. For `PUT /api/reservations?action=transition`, mutate the fixture and return `{ reservation, rooms }`; check-out marks assigned rooms dirty. For unknown `/api/*`, return a safe `404` so browser tests cannot silently call a real backend.

- [ ] **Step 4: Write accessibility acceptance tests**

For each of login, Oggi, Planning, Prenotazioni, reservation detail, and Camere, inject `AxeBuilder` and fail on `critical` or `serious` violations:

```js
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures.mjs';

for (const route of ['#/oggi', '#/planning', '#/prenotazioni', '#/prenotazioni/r-arrival', '#/camere']) {
  test(`no serious accessibility violations on ${route}`, async ({ authenticatedPage: page }) => {
    await page.goto(`/${route}`);
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations.filter((item) => ['critical', 'serious'].includes(item.impact))).toEqual([]);
  });
}
```

Add a separate unauthenticated login test. Add keyboard assertions for: skip link, sidebar navigation, `Ctrl+K`, search result activation, dialog `Escape`, focus restoration, reservation action, and Planning scroll region. Capture `page.on('console')` and fail on errors in every test.

- [ ] **Step 5: Write exact viewport overflow tests**

Iterate the required widths with a realistic `900px` height:

```js
const widths = [320, 375, 768, 1024, 1440];

for (const width of widths) {
  test(`core pages fit at ${width}px`, async ({ authenticatedPage: page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['#/oggi', '#/prenotazioni', '#/ospiti', '#/camere']) {
      await page.goto(`/${route}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }
  });
}
```

For Planning, assert the document still has no horizontal overflow and `.planning-scroll` has `scrollWidth > clientWidth` at narrow widths. At widths `<= 768`, measure every visible primary button and assert both dimensions are at least `44` pixels. Assert Oggi has no nested element whose `scrollHeight > clientHeight` while `overflow-y` is `auto` or `scroll`.

- [ ] **Step 6: Automate the complete reception acceptance flow**

`reception-flow.spec.mjs` performs these actions in order against the mutable fixture:

1. use `Ctrl+K` to find guest `Giulia Bianchi` and open the linked reservation;
2. create an individual stay with two guests and room `102`;
3. attempt an overlapping booking, receive fixture `409 ROOM_AVAILABILITY_CONFLICT`, keep the editor open, and display the conflicting room/dates;
4. check in the confirmed arrival;
5. check out the in-house departure and observe room `101` as `Da pulire` on both Oggi and Camere without reload;
6. advance room `101` through `In lavorazione`, `Pulita`, and `Controllata`;
7. simulate `route.abort('internetdisconnected')` on save, confirm the persistent offline banner, retained form values, and successful retry;
8. navigate backward, forward, refresh, and direct-load `#/camere` while retaining the correct route.

Use role/name/label locators, never CSS implementation selectors except the explicit Planning overflow probe.

- [ ] **Step 7: Run browser and full verification, then commit**

Run: `npm.cmd run test:browser`

Expected: Chromium suite PASS with no console errors, serious/critical axe violations, or unexpected overflow.

Run: `npm.cmd run test:all`

Expected: unit and browser suites PASS.

```powershell
git add package.json package-lock.json playwright.config.mjs scripts/serve-static.mjs tests/browser
git commit -m 'test: automate reception release acceptance'
```

---

### Task 7: Remove residue and prepare the release handoff

**Files:**
- Delete: `.DS_Store`
- Delete: `assets/dashboard-icons/arrivals.png`
- Delete: `assets/dashboard-icons/arrivals-source.png`
- Delete: `assets/dashboard-icons/departures.png`
- Delete: `assets/dashboard-icons/departures-source.png`
- Delete: `assets/dashboard-icons/inhouse.png`
- Delete: `assets/dashboard-icons/inhouse-source.png`
- Delete: `assets/dashboard-icons/occupancy.png`
- Delete: `assets/dashboard-icons/occupancy-source.png`
- Delete: `favicon.svg.png`
- Modify: `package.json`
- Modify: `index.html`
- Create: `.env.example`
- Create: `README.md`
- Create: `docs/release-checklist.md`
- Create: `tests/release-contract.test.mjs`
- Create: `tests/text-encoding.test.mjs`

- [ ] **Step 1: Write failing release-residue tests**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('tracked release assets contain no superseded dashboard artwork', () => {
  assert.equal(fs.existsSync('assets/dashboard-icons'), false);
  assert.equal(fs.existsSync('favicon.svg.png'), false);
  assert.equal(fs.existsSync('.DS_Store'), false);
});

test('package metadata identifies a private product application', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.name, 'groupstay-reception-core');
  assert.equal(pkg.private, true);
  assert.equal(pkg.license, 'UNLICENSED');
  assert.match(pkg.description, /PMS|reception/i);
  assert.ok(Number(pkg.engines.node.replace(/\D/g, '')) >= 20);
});

test('public serverless route count remains exactly eleven', () => {
  const routes = fs.readdirSync('api').filter((name) => name.endsWith('.js') && !name.startsWith('_'));
  assert.equal(routes.length, 11, routes.join(', '));
});
```

In `tests/text-encoding.test.mjs`, recursively scan tracked production extensions (`.html`, `.css`, `.js`, `.mjs`, `.json`, `.md`, `.svg`) while excluding `.git`, `.worktrees`, `node_modules`, Playwright reports, and test fixtures that intentionally contain malformed strings. Decode with fatal UTF-8 and reject replacement characters plus the escaped mojibake prefixes `\u00c3`, `\u00c2`, and `\u00e2\u20ac`.

- [ ] **Step 2: Run both tests and verify RED**

Run: `node --test tests/release-contract.test.mjs tests/text-encoding.test.mjs`

Expected: FAIL on tracked assets, incomplete package metadata, and existing mojibake such as the document title.

- [ ] **Step 3: Remove only verified-unused assets and correct text encoding**

Run `rg -n 'dashboard-icons|favicon\.svg\.png' . --glob '!node_modules/**' --glob '!.git/**'` before deletion. Expected: only obsolete source references or no references. Remove the listed files, delete the empty dashboard icon directory, and keep `favicon.svg`, the 16/32/512 PNGs, and `apple-touch-icon.png`.

Fix every encoding test failure at its source. Set the page title to `GroupStay - PMS per hotel` and the theme color to `#1D2924`. Do not silence the scanner with exclusions for production files.

- [ ] **Step 4: Finalize package and environment documentation**

Set `name` to `groupstay-reception-core`, `private` to `true`, `license` to `UNLICENSED`, `description` to `PMS operativo per reception alberghiere indipendenti`, and `engines.node` to `>=20`.

`.env.example` lists empty values for `DATABASE_URL`, `GUEST_DATA_ENCRYPTION_KEY`, `ALLOGGIATI_UTENTE`, `ALLOGGIATI_PASSWORD`, `ALLOGGIATI_WSKEY`, `ALLOGGIATI_IDAPPARTAMENTO`, and `ALLOGGIATI_ALLOWED_USER_IDS`; set `ALLOGGIATI_GESTIONE_APPARTAMENTI=false`. It must contain no real host, username, token, password, or key and no Mail variable.

`README.md` documents scope, prerequisites, install, controlled migrations, local verification, Vercel deployment, exactly 11 public functions, cookie-only authentication, disabled registration, Alloggiati allowlisting, backup acknowledgement for migration 002, and browser support. State explicitly that the current release is one account/property and that server-enforced roles/multi-tenancy belong to the later backend phase.

`docs/release-checklist.md` contains executable pre-deploy, migration/backup, smoke, rollback, and post-deploy checks with an owner/date/evidence column. It must never include credentials.

- [ ] **Step 5: Run the final automated release gate**

Run: `npm.cmd run test:all`

Expected: all unit, contract, browser, responsive, and accessibility tests PASS.

Run: `npm.cmd audit --omit=dev`

Expected: zero known production vulnerabilities.

Run: `rg -ni 'mail|imap|smtp' api js css index.html package.json package-lock.json`

Expected: no matches.

Run: `rg -n 'localStorage' js script.js`

Expected: matches only inside `js/core/preferences.js`, using the single allowlisted `gs_preferences_v1` key.

Run: `rg -n '\son[a-z]+\s*=|\sstyle\s*=' index.html js`

Expected: no matches.

Run: `Get-ChildItem api -File -Filter '*.js' | Where-Object { -not $_.Name.StartsWith('_') } | Select-Object -ExpandProperty Name`

Expected: exactly 11 existing public route files; `init.js` is absent and no replacement route exists.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 6: Perform the human release acceptance pass**

At `320`, `375`, `768`, `1024`, and `1440` pixels, save screenshots of login, Oggi, Planning, Prenotazioni, one reservation detail, and Camere as untracked release evidence. Review them against the approved palette, spacing rhythm, typography, selected/focus/disabled/loading/error/empty states, and absence of decorative card grids or AI-style filler.

Using keyboard only, complete: login; navigate all primary/secondary areas; find a guest through global search; create a reservation; resolve a conflict; check in; check out; mark the room clean and inspected; open/close every dialog; sign out. Repeat the daily-action subset with pointer/touch emulation at `375` and `768` pixels.

Record browser version, viewport, outcome, and evidence path in `docs/release-checklist.md`. Any failure returns to the owning task and reruns `npm.cmd run test:all`; do not mark the checklist complete with a known exception.

- [ ] **Step 7: Commit the release handoff**

```powershell
git add package.json package-lock.json index.html .env.example README.md docs/release-checklist.md tests/release-contract.test.mjs tests/text-encoding.test.mjs
git add -u .DS_Store assets/dashboard-icons favicon.svg.png
git commit -m 'chore: prepare reception core release'
```

Run: `git status --short`

Expected: clean working tree; release evidence screenshots remain outside the repository.

Run: `npm.cmd run test:all`

Expected: final post-commit suite PASS.
