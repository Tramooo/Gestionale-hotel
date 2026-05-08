# Room Assignment Print Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve room assignment print layouts so cleaning sheets print one large black-and-white landscape floor per page and standard sheets remain two floors per page with stronger, more presentable row separation.

**Architecture:** Extract print HTML generation into a small browser helper at `js/features/assignment-print.js`, expose it as `window.GroupStayAssignmentPrint`, and keep `script.js#printAssignments` responsible for gathering current reservation data and opening the print window. This gives the layout a focused unit that can be tested with Node `vm` like the existing feature modules.

**Tech Stack:** Plain JavaScript, browser globals, Node built-in test runner, no new dependencies.

---

## File Structure

- Create `js/features/assignment-print.js`: pure-ish print document builder and black-and-white print CSS.
- Modify `index.html`: load `js/features/assignment-print.js` before `script.js`.
- Modify `script.js`: delegate `printAssignments(mode)` HTML generation to `window.GroupStayAssignmentPrint.buildAssignmentPrintDocument`.
- Create `tests/assignment-print.test.mjs`: verifies cleaning orientation/page grouping, standard grouping, and print styling contracts.

---

### Task 1: Add Failing Tests For Print Layout Contracts

**Files:**
- Create: `tests/assignment-print.test.mjs`
- Test: `tests/assignment-print.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/assignment-print.test.mjs` with:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadAssignmentPrintFeature() {
    const context = { window: {} };
    vm.runInNewContext(fs.readFileSync('js/features/assignment-print.js', 'utf8'), context);
    return context.window.GroupStayAssignmentPrint;
}

const labels = {
    room: 'Camera',
    roomType: 'Tipo',
    notes: 'Note',
    floor: 'Piano',
    printCleaning: 'Stampa Pulizie'
};

const rooms = [
    { id: 'r101', number: '101', floor: 1 },
    { id: 'r102', number: '102', floor: 1 },
    { id: 'r201', number: '201', floor: 2 },
    { id: 'r301', number: '301', floor: 3 }
];

const plannerColumns = [
    { id: 'usage', name: 'Utilizzo' },
    { id: 'group', name: 'Gruppo' }
];

const assignmentData = [
    { roomId: 'r101', cellValues: { usage: 'Doppia', group: 'Rossi' } },
    { roomId: 'r201', cellValues: { usage: 'Singola', group: 'Bianchi' } }
];

function build(mode) {
    return loadAssignmentPrintFeature().buildAssignmentPrintDocument({
        reservation: { groupName: 'Gruppo Test' },
        rooms,
        assignmentData,
        plannerColumns,
        mode,
        labels,
        escapeHtml(value) {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }
    });
}

test('cleaning print uses A4 landscape and creates one page per floor', () => {
    const html = build('cleaning');

    assert.match(html, /@page \{ size: A4 landscape; margin: 0; \}/);
    assert.equal((html.match(/class="page-block print-cleaning-page"/g) || []).length, 3);
    assert.match(html, /class="print-cleaning-floor-label">Piano 1<\/td>/);
    assert.match(html, /\.print-cleaning-floor-label \{[^}]*font-size: 34px/);
    assert.match(html, /\.print-cleaning-room-cell \{[^}]*font-size: 26px/);
    assert.match(html, /\.print-cleaning-notes-head, \.print-cleaning-notes-cell \{[^}]*width: 57%/);
});

test('standard print keeps two floors per page and avoids cleaning landscape orientation', () => {
    const html = build();

    assert.equal((html.match(/class="page-block print-standard-page"/g) || []).length, 2);
    assert.doesNotMatch(html, /size: A4 landscape/);
    assert.match(html, /<span class="print-floor-badge">Piano 1<\/span>/);
    assert.match(html, /<span class="print-floor-badge">Piano 2<\/span>/);
    assert.match(html, /\.print-floor-badge \{[^}]*font-size: 22px/);
    assert.match(html, /\.print-room-cell, \.print-value-cell \{[^}]*border-bottom: 1\.5px solid #333/);
});

test('cleaning print uses the first planner column as room type and escapes values', () => {
    const html = loadAssignmentPrintFeature().buildAssignmentPrintDocument({
        reservation: { groupName: 'Gruppo <Test>' },
        rooms: [{ id: 'r1', number: '<101>', floor: 1 }],
        assignmentData: [{ roomId: 'r1', cellValues: { usage: 'Tripla <vip>' } }],
        plannerColumns,
        mode: 'cleaning',
        labels,
        escapeHtml(value) {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        }
    });

    assert.match(html, /&lt;101&gt;/);
    assert.match(html, /Tripla &lt;vip&gt;/);
    assert.match(html, /Gruppo &lt;Test&gt; — Stampa Pulizie/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests\assignment-print.test.mjs
```

Expected: FAIL with `ENOENT` for `js/features/assignment-print.js`.

---

### Task 2: Implement The Print Builder

**Files:**
- Create: `js/features/assignment-print.js`
- Test: `tests/assignment-print.test.mjs`

- [ ] **Step 1: Add `js/features/assignment-print.js`**

Create a browser IIFE that exposes `window.GroupStayAssignmentPrint.buildAssignmentPrintDocument`.

The function must:

- Sort rooms by floor and room number.
- Group rooms by floor.
- Group pages with `1` floor per page in cleaning mode and `2` floors per page in standard mode.
- Generate cleaning table rows with CSS classes instead of inline styles.
- Generate standard table rows with the existing dynamic planner columns.
- Return a complete printable HTML document with black-and-white CSS.

Key CSS values:

```css
@page { size: A4 landscape; margin: 0; } /* cleaning only */
.print-cleaning-floor-label { font-size: 34px; font-weight: 800; }
.print-cleaning-table th { font-size: 21px; }
.print-cleaning-room-cell { font-size: 26px; font-weight: 900; }
.print-cleaning-type-cell, .print-cleaning-notes-cell { font-size: 24px; }
.print-cleaning-notes-head, .print-cleaning-notes-cell { width: 57%; }
.print-floor-badge { display: block; font-size: 22px; font-weight: 800; }
.print-room-cell, .print-value-cell { border-bottom: 1.5px solid #333; }
```

- [ ] **Step 2: Run test to verify it passes**

Run:

```bash
node --test tests\assignment-print.test.mjs
```

Expected: PASS all 3 tests.

---

### Task 3: Wire The Builder Into The App

**Files:**
- Modify: `index.html`
- Modify: `script.js`
- Test: `tests/bootstrap.test.mjs`
- Test: `tests/assignment-print.test.mjs`

- [ ] **Step 1: Load the helper before `script.js`**

In `index.html`, add:

```html
<script src="js/features/assignment-print.js"></script>
```

immediately before:

```html
<script src="script.js"></script>
```

- [ ] **Step 2: Delegate `printAssignments(mode)`**

In `script.js`, replace manual page/style generation inside `printAssignments(mode)` with:

```js
    const printHtml = window.GroupStayAssignmentPrint.buildAssignmentPrintDocument({
        reservation: r,
        rooms,
        assignmentData,
        plannerColumns,
        mode,
        labels: {
            room: t('rooms.room'),
            roomType: t('assign.roomType'),
            notes: t('assign.notes'),
            floor: t('rooms.floor'),
            printCleaning: t('assign.printCleaning')
        },
        escapeHtml
    });
```

Keep the existing `window.open`, `document.write`, and `document.close` behavior after this call.

- [ ] **Step 3: Add a script ordering test**

Extend `tests/assignment-print.test.mjs` with:

```js
test('index loads assignment print helper before the main script', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const helperIndex = html.indexOf('js/features/assignment-print.js');
    const scriptIndex = html.indexOf('script.js');

    assert.notEqual(helperIndex, -1);
    assert.notEqual(scriptIndex, -1);
    assert.ok(helperIndex < scriptIndex);
});
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test tests\assignment-print.test.mjs tests\bootstrap.test.mjs
```

Expected: PASS all tests.

---

### Task 4: Final Verification And Commit

**Files:**
- Verify: all changed files
- Test: full test suite

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS all tests. If dependency tests fail because `node_modules` is absent in the worktree, run the focused suite and document the limitation.

- [ ] **Step 2: Review diff**

Run:

```bash
git diff -- index.html script.js js/features/assignment-print.js tests/assignment-print.test.mjs
```

Expected: only print helper, print wiring, and tests changed.

- [ ] **Step 3: Commit**

Run:

```bash
git add index.html script.js js/features/assignment-print.js tests/assignment-print.test.mjs docs/superpowers/plans/2026-05-08-room-assignment-print.md
git commit -m "feat: improve room assignment print layouts"
```

Expected: commit created on `feature/room-assignment-print`.
