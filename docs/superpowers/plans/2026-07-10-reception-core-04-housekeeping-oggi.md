# Reception Core Phase 04: Housekeeping and Oggi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn room state into a usable housekeeping workflow and replace the generic dashboard with an authoritative Oggi operations queue.

**Architecture:** This phase consumes the store, booking rules, canonical reservation transitions, and room API contracts delivered by phases 01-03. A pure room-state adapter derives occupancy without mutating persisted room records; a housekeeping controller commits explicit status changes through the existing `api/rooms.js` route; a pure Oggi view-model feeds a semantic, reactive queue UI.

**Tech Stack:** Vanilla JavaScript IIFEs, Node.js built-in test runner, existing `GroupStayStore`, `GroupStayBookingRules`, `GroupStayApi`, HTML/CSS, existing Vercel/Neon routes.

**Prerequisites:** Complete plans 01-03. In particular, `state.data.rooms` uses `serviceStatus` and `housekeepingStatus`, `GroupStayReservationActions` commits canonical transition responses, and no feature mutates `room.status`.

---

### Task 1: Add a pure room operational-state adapter

**Files:**
- Create: `js/core/room-state.js`
- Test: `tests/room-state.test.mjs`
- Modify: `index.html` (load the module after `booking-rules.js` and before feature modules)

- [ ] **Step 1: Write the failing room-state tests**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadRoomState() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync('js/core/room-state.js', 'utf8'), context);
  return context.window.GroupStayRoomState;
}

const rules = {
  deriveRoomOccupancy({ roomId, reservations }) {
    return reservations.some((reservation) => reservation.roomIds.includes(roomId)) ? 'occupied' : 'available';
  }
};

test('derives occupancy without changing the persisted room object', () => {
  const roomState = loadRoomState();
  const room = { id: 'r1', serviceStatus: 'active', housekeepingStatus: 'dirty' };
  const before = JSON.stringify(room);
  const view = roomState.deriveRoomOperationalState({
    room,
    date: '2026-07-10',
    reservations: [{ roomIds: ['r1'] }],
    bookingRules: rules
  });
  assert.equal(view.occupancyStatus, 'occupied');
  assert.equal(view.readyForArrival, false);
  assert.equal(JSON.stringify(room), before);
});

test('only active clean or inspected rooms are ready for arrival', () => {
  const roomState = loadRoomState();
  const make = (serviceStatus, housekeepingStatus) => roomState.deriveRoomOperationalState({
    room: { id: 'r1', serviceStatus, housekeepingStatus },
    date: '2026-07-10',
    reservations: [],
    bookingRules: rules
  });
  assert.equal(make('active', 'clean').readyForArrival, true);
  assert.equal(make('active', 'inspected').readyForArrival, true);
  assert.equal(make('active', 'dirty').readyForArrival, false);
  assert.equal(make('maintenance', 'clean').readyForArrival, false);
});

test('sorts actionable rooms before ready rooms', () => {
  const roomState = loadRoomState();
  const rows = roomState.sortOperationalRooms([
    { id: 'clean', number: '101', serviceStatus: 'active', housekeepingStatus: 'clean' },
    { id: 'dirty', number: '102', serviceStatus: 'active', housekeepingStatus: 'dirty' },
    { id: 'oop', number: '103', serviceStatus: 'out-of-order', housekeepingStatus: 'clean' },
    { id: 'working', number: '104', serviceStatus: 'active', housekeepingStatus: 'in-progress' }
  ]);
  assert.deepEqual(rows.map((room) => room.id), ['oop', 'dirty', 'working', 'clean']);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/room-state.test.mjs`

Expected: FAIL because `js/core/room-state.js` does not exist.

- [ ] **Step 3: Implement the complete adapter**

```js
(function initRoomState(global) {
  const HOUSEKEEPING_PRIORITY = { dirty: 1, 'in-progress': 2, clean: 3, inspected: 4 };
  const SERVICE_PRIORITY = { 'out-of-order': 0, maintenance: 0, active: 1 };

  function normalizeServiceStatus(value) {
    return ['active', 'maintenance', 'out-of-order'].includes(value) ? value : 'active';
  }

  function normalizeHousekeepingStatus(value) {
    return ['clean', 'dirty', 'in-progress', 'inspected'].includes(value) ? value : 'clean';
  }

  function deriveRoomOperationalState({ room, date, reservations, guests = [], bookingRules }) {
    const serviceStatus = normalizeServiceStatus(room.serviceStatus);
    const housekeepingStatus = normalizeHousekeepingStatus(room.housekeepingStatus);
    const occupancyStatus = bookingRules.deriveRoomOccupancy({
      roomId: room.id, date, reservations, guests, today: date
    });
    return {
      ...room, serviceStatus, housekeepingStatus, occupancyStatus,
      readyForArrival: serviceStatus === 'active' && ['clean', 'inspected'].includes(housekeepingStatus)
    };
  }

  function sortOperationalRooms(rooms) {
    return rooms.slice().sort((a, b) => {
      const serviceDiff = (SERVICE_PRIORITY[a.serviceStatus] ?? 1) - (SERVICE_PRIORITY[b.serviceStatus] ?? 1);
      if (serviceDiff) return serviceDiff;
      const housekeepingDiff = (HOUSEKEEPING_PRIORITY[a.housekeepingStatus] ?? 5) - (HOUSEKEEPING_PRIORITY[b.housekeepingStatus] ?? 5);
      if (housekeepingDiff) return housekeepingDiff;
      return (a.floor ?? 0) - (b.floor ?? 0) || String(a.number).localeCompare(String(b.number), undefined, { numeric: true });
    });
  }

  function buildRoomOperationalRows({ rooms, reservations, guests = [], date, bookingRules }) {
    return sortOperationalRooms(rooms.map((room) => deriveRoomOperationalState({
      room, date, reservations, guests, bookingRules
    })));
  }

  global.GroupStayRoomState = {
    buildRoomOperationalRows, deriveRoomOperationalState,
    normalizeHousekeepingStatus, normalizeServiceStatus, sortOperationalRooms
  };
})(window);
```

- [ ] **Step 4: Load the module and verify GREEN**

Add `<script src='js/core/room-state.js'></script>` after `js/core/booking-rules.js` in `index.html`.

Run: `node --test tests/room-state.test.mjs`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit the adapter**

```powershell
git add js/core/room-state.js index.html tests/room-state.test.mjs
git commit -m 'feat: derive room operational state'
```

---

### Task 2: Add the housekeeping controller and committed updates

**Files:**
- Create: `js/features/housekeeping.js`
- Test: `tests/housekeeping.test.mjs`
- Modify: `script.js`
- Modify: `index.html`

- [ ] **Step 1: Write the failing controller tests**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadFeature() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync('js/features/housekeeping.js', 'utf8'), context);
  return context.window.GroupStayHousekeeping;
}

test('uses the canonical housekeeping progression', () => {
  const feature = loadFeature();
  assert.equal(feature.getNextHousekeepingStatus('dirty'), 'in-progress');
  assert.equal(feature.getNextHousekeepingStatus('in-progress'), 'clean');
  assert.equal(feature.getNextHousekeepingStatus('clean'), 'inspected');
  assert.equal(feature.getNextHousekeepingStatus('inspected'), null);
});

test('updates the store only with the room returned by the API', async () => {
  const feature = loadFeature();
  let state = { data: { rooms: [{ id: 'r1', housekeepingStatus: 'dirty' }] } };
  const actions = [];
  const store = {
    getState: () => state,
    setState(updater, action) { state = updater(state); actions.push(action); }
  };
  feature.init({
    API: { rooms: '/api/rooms' },
    apiPut: async () => ({ room: { id: 'r1', housekeepingStatus: 'in-progress' } }),
    store
  });
  await feature.updateHousekeeping('r1', 'in-progress');
  assert.equal(state.data.rooms[0].housekeepingStatus, 'in-progress');
  assert.deepEqual(actions, ['housekeeping/committed']);
});

test('keeps store state unchanged when the API rejects', async () => {
  const feature = loadFeature();
  let state = { data: { rooms: [{ id: 'r1', housekeepingStatus: 'dirty' }] } };
  const store = { getState: () => state, setState(updater) { state = updater(state); } };
  feature.init({ API: { rooms: '/api/rooms' }, apiPut: async () => { throw new Error('offline'); }, store });
  await assert.rejects(() => feature.updateHousekeeping('r1', 'in-progress'), /offline/);
  assert.equal(state.data.rooms[0].housekeepingStatus, 'dirty');
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/housekeeping.test.mjs`

Expected: FAIL because `js/features/housekeeping.js` does not exist.

- [ ] **Step 3: Implement the controller**

```js
(function initHousekeeping(global) {
  let deps;
  const NEXT = { dirty: 'in-progress', 'in-progress': 'clean', clean: 'inspected' };

  function requireDeps() {
    if (!deps) throw new Error('GroupStayHousekeeping not initialized');
    return deps;
  }

  function getNextHousekeepingStatus(current) {
    return NEXT[current] || null;
  }

  async function updateHousekeeping(roomId, housekeepingStatus) {
    const { API, apiPut, store } = requireDeps();
    const response = await apiPut(`${API.rooms}?action=housekeeping`, { id: roomId, housekeepingStatus });
    const committed = response.room;
    store.setState((state) => ({
      ...state,
      data: {
        ...state.data,
        rooms: state.data.rooms.map((room) => room.id === committed.id ? { ...room, ...committed } : room)
      }
    }), 'housekeeping/committed');
    return committed;
  }

  global.GroupStayHousekeeping = {
    getNextHousekeepingStatus,
    init(nextDeps) { deps = nextDeps; },
    updateHousekeeping
  };
})(window);
```

- [ ] **Step 4: Load and initialize the controller**

Load `js/features/housekeeping.js` before `js/features/rooms.js`. Initialize it in `script.js` with `{ API, apiPut, store: appStore }`. Add a compatibility wrapper `updateRoomHousekeeping(roomId, status)` that delegates to `GroupStayHousekeeping.updateHousekeeping` and contains no state mutation.

- [ ] **Step 5: Run focused and full tests**

Run: `node --test tests/housekeeping.test.mjs tests/room-state.test.mjs`

Expected: 6 tests PASS.

Run: `npm.cmd test`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add js/features/housekeeping.js index.html script.js tests/housekeeping.test.mjs
git commit -m 'feat: commit housekeeping status updates'
```

---

### Task 3: Rebuild Camere as an operational list

**Files:**
- Modify: `index.html:635-663,1364-1439`
- Modify: `js/features/rooms.js:13-379`
- Modify: `script.js:77-100`
- Modify: `css/02-lists-data.css`
- Test: `tests/rooms-ui.test.mjs`

- [ ] **Step 1: Write the failing static and renderer tests**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('Camere exposes all operational filters', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  for (const id of ['roomFilterFloor', 'roomFilterOccupancy', 'roomFilterService', 'roomFilterHousekeeping']) {
    assert.ok(html.includes(`id='${id}'`));
  }
  assert.ok(html.includes(`id='roomsList'`));
  assert.ok(!html.includes(`id='roomsGrid'`));
});

test('room renderer uses semantic controls and all three states', () => {
  const source = fs.readFileSync('js/features/rooms.js', 'utf8');
  assert.match(source, /occupancyStatus/);
  assert.match(source, /serviceStatus/);
  assert.match(source, /housekeepingStatus/);
  assert.match(source, /data-room-action/);
  assert.doesNotMatch(source, /room-card/);
  assert.doesNotMatch(source, /onclick=/);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/rooms-ui.test.mjs`

Expected: FAIL because the old card grid and status chips are still present.

- [ ] **Step 3: Replace the Camere page markup**

```html
<section class='page' id='page-rooms' aria-labelledby='roomsPageTitle'>
  <header class='page-header'>
    <div class='page-heading'>
      <h1 class='page-title' id='roomsPageTitle'>Camere</h1>
      <p class='page-subtitle'>Occupazione, servizio e pulizie in un unico elenco.</p>
    </div>
    <div class='page-actions'>
      <button class='btn btn-secondary' type='button' data-room-action='print'>Stampa lista</button>
      <button class='btn btn-primary' type='button' data-room-action='new'>Nuova camera</button>
    </div>
  </header>
  <div class='filter-bar' aria-label='Filtri camere'>
    <label>Piano <select id='roomFilterFloor'><option value='all'>Tutti</option></select></label>
    <label>Occupazione <select id='roomFilterOccupancy'><option value='all'>Tutte</option><option value='available'>Libere</option><option value='occupied'>Occupate</option></select></label>
    <label>Servizio <select id='roomFilterService'><option value='all'>Tutte</option><option value='active'>Attive</option><option value='maintenance'>Manutenzione</option><option value='out-of-order'>Fuori servizio</option></select></label>
    <label>Pulizia <select id='roomFilterHousekeeping'><option value='all'>Tutte</option><option value='dirty'>Da pulire</option><option value='in-progress'>In lavorazione</option><option value='clean'>Pulite</option><option value='inspected'>Controllate</option></select></label>
    <label class='filter-search'>Cerca <input id='searchRooms' type='search' autocomplete='off'></label>
  </div>
  <div id='roomsList' class='rooms-operational-list' aria-live='polite'></div>
</section>
```

Also add a labelled `roomServiceStatus` select and `roomHousekeepingStatus` select to the existing room editor. Keep maintenance notes visible only for `maintenance` and `out-of-order`.

- [ ] **Step 4: Render safe semantic rows and bind events once**

Use the phase-01 escaping helper for every interpolated field. Add this focused row renderer to `rooms.js`:

```js
function renderRoomRow(room) {
  const nextStatus = housekeeping.getNextHousekeepingStatus(room.housekeepingStatus);
  return `
    <article class='room-operational-row' data-room-id='${escapeHtml(room.id)}'>
      <button class='room-identity' type='button' data-room-action='edit' data-room-id='${escapeHtml(room.id)}'>
        <strong>${escapeHtml(room.number)}</strong>
        <span>${escapeHtml(room.type)} - Piano ${escapeHtml(String(room.floor))}</span>
      </button>
      <span class='state-label occupancy-${escapeHtml(room.occupancyStatus)}'>${escapeHtml(occupancyLabel(room.occupancyStatus))}</span>
      <span class='state-label service-${escapeHtml(room.serviceStatus)}'>${escapeHtml(serviceLabel(room.serviceStatus))}</span>
      <span class='state-label housekeeping-${escapeHtml(room.housekeepingStatus)}'>${escapeHtml(housekeepingLabel(room.housekeepingStatus))}</span>
      ${nextStatus ? `<button class='btn btn-secondary btn-sm' type='button' data-room-action='housekeeping' data-room-id='${escapeHtml(room.id)}' data-next-status='${nextStatus}'>${escapeHtml(housekeepingActionLabel(nextStatus))}</button>` : ''}
    </article>`;
}
```

Bind one `click` listener on `roomsList` for `edit` and `housekeeping`, and one `change` listener on the filter bar. Build rows with `GroupStayRoomState.buildRoomOperationalRows`, then apply floor, occupancy, service, housekeeping, and text filters. Do not mutate room records while filtering or rendering.

- [ ] **Step 5: Add minimal operational layout CSS**

Add grid/list rules in `css/02-lists-data.css` for `.filter-bar`, `.room-operational-row`, `.room-identity`, and `.state-label`. Use existing tokens only; phase 05 owns final palette, density, and responsive polish.

- [ ] **Step 6: Verify and commit**

Run: `node --test tests/rooms-ui.test.mjs tests/housekeeping.test.mjs tests/room-state.test.mjs`

Expected: all focused tests PASS.

Run: `npm.cmd test`

Expected: all tests PASS.

```powershell
git add index.html js/features/rooms.js script.js css/02-lists-data.css tests/rooms-ui.test.mjs
git commit -m 'feat: make rooms operational for housekeeping'
```

---

### Task 4: Remove the legacy mutable room-status model

**Files:**
- Modify: `script.js:530-546,2565-2651`
- Modify: `js/features/planner.js:31-58,260-308`
- Modify: `js/features/guests.js:266-273`
- Modify: `js/features/room-status-print.js:43-96`
- Modify: `js/features/dashboard.js`
- Test: `tests/room-state-compat.test.mjs`

- [ ] **Step 1: Write a failing source contract**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const files = ['script.js', 'js/features/planner.js', 'js/features/guests.js',
  'js/features/room-status-print.js', 'js/features/dashboard.js'];

test('room consumers use separated operational fields', () => {
  const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.ok(!source.includes(`room.status === 'available'`));
  assert.ok(!source.includes(`room.status === 'occupied'`));
  assert.ok(!source.includes(`room.status === 'maintenance'`));
  assert.ok(!source.includes(`rm.status =`));
  assert.match(source, /serviceStatus/);
  assert.match(source, /occupancyStatus/);
  assert.match(source, /housekeepingStatus/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/room-state-compat.test.mjs`

Expected: FAIL on legacy `room.status` reads and assignments.

- [ ] **Step 3: Replace every legacy consumer**

Delete `computeRoomStatuses()` from `script.js`. Remove the assignments to `rooms[roomIdx].status` performed by the assignment editor. Occupancy is always derived with `GroupStayRoomState` for a requested date.

Apply these exact mappings:

- planner unavailable rows use `room.serviceStatus !== 'active'`;
- planner indicators receive service, occupancy, and housekeeping classes;
- guest room choices include `room.serviceStatus === 'active'`, then apply booking rules for the reservation dates;
- room-status print shows service first, occupancy second, housekeeping third;
- temporary dashboard availability means active service plus derived available occupancy.

- [ ] **Step 4: Verify print and planner regressions**

Run: `node --test tests/room-state-compat.test.mjs tests/assignment-print.test.mjs`

Expected: all tests PASS.

Run: `npm.cmd test`

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add script.js js/features/planner.js js/features/guests.js js/features/room-status-print.js js/features/dashboard.js tests/room-state-compat.test.mjs
git commit -m 'refactor: separate occupancy from room state'
```

---

### Task 5: Build the pure Oggi view model

**Files:**
- Create: `js/features/today.js`
- Test: `tests/today.test.mjs`
- Modify: `index.html`

- [ ] **Step 1: Write failing queue and count tests**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadToday() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync('js/features/today.js', 'utf8'), context);
  return context.window.GroupStayToday;
}

const rules = {
  isExpiredOption: (reservation, today) => reservation.status === 'pending' && reservation.expiration < today,
  getArrivalReadiness: ({ reservation }) => ({ ready: reservation.id !== 'not-ready', warnings: [] })
};

test('builds authoritative operational queues', () => {
  const today = loadToday();
  const model = today.buildTodayViewModel({
    reservations: [
      { id: 'arrival', status: 'confirmed', checkin: '2026-07-10', checkout: '2026-07-12', guestCount: 2 },
      { id: 'departure', status: 'checked-in', checkin: '2026-07-08', checkout: '2026-07-10', guestCount: 1 },
      { id: 'house', status: 'checked-in', checkin: '2026-07-09', checkout: '2026-07-12', guestCount: 3 },
      { id: 'expired', status: 'pending', expiration: '2026-07-09', checkin: '2026-07-11', checkout: '2026-07-12', guestCount: 4 },
      { id: 'terminal', status: 'checked-out', checkin: '2026-07-10', checkout: '2026-07-11', guestCount: 5 }
    ],
    rooms: [
      { id: 'r1', serviceStatus: 'active', housekeepingStatus: 'clean', occupancyStatus: 'available' },
      { id: 'r2', serviceStatus: 'active', housekeepingStatus: 'dirty', occupancyStatus: 'available' },
      { id: 'r3', serviceStatus: 'maintenance', housekeepingStatus: 'clean', occupancyStatus: 'available' }
    ],
    guests: [], agendaItems: []
  }, { today: '2026-07-10', bookingRules: rules });

  assert.deepEqual(model.queues.arrivals.map((item) => item.id), ['arrival']);
  assert.deepEqual(model.queues.departures.map((item) => item.id), ['departure']);
  assert.equal(model.summary.inHouseGuests, 4);
  assert.equal(model.summary.availableRooms, 2);
  assert.equal(model.summary.roomsNotReady, 2);
  assert.deepEqual(model.queues.exceptions.map((item) => item.id), ['expired']);
  assert.ok(!JSON.stringify(model).includes('terminal'));
});

test('formats the property-local operating date without a UTC day shift', () => {
  const today = loadToday();
  const instant = {
    getTime: () => Date.parse('2026-07-09T22:30:00.000Z'),
    getTimezoneOffset: () => -120
  };
  assert.equal(today.todayIso(instant), '2026-07-10');
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/today.test.mjs`

Expected: FAIL because `js/features/today.js` does not exist.

- [ ] **Step 3: Implement the pure view model**

```js
(function initToday(global) {
  const TERMINAL = new Set(['checked-out', 'cancelled', 'no-show']);

  function todayIso(now = new Date()) {
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }

  function nextAction(reservation) {
    if (reservation.status === 'pending') return 'confirm';
    if (reservation.status === 'confirmed') return 'check-in';
    if (reservation.status === 'checked-in') return 'check-out';
    return null;
  }

  function buildTodayViewModel(data, { today, bookingRules }) {
    const live = data.reservations.filter((reservation) => !TERMINAL.has(reservation.status));
    const decorate = (reservation) => ({ ...reservation, nextAction: nextAction(reservation) });
    const arrivals = live.filter((reservation) => reservation.status === 'confirmed' && reservation.checkin === today).map(decorate);
    const departures = live.filter((reservation) => reservation.status === 'checked-in' && reservation.checkout === today).map(decorate);
    const inHouse = live.filter((reservation) => reservation.status === 'checked-in' && reservation.checkin <= today && reservation.checkout >= today);
    const expired = live.filter((reservation) => bookingRules.isExpiredOption(reservation, today));
    const arrivalIssues = arrivals.filter((reservation) => !bookingRules.getArrivalReadiness({
      reservation, rooms: data.rooms, reservations: data.reservations, guests: data.guests, today
    }).ready);
    const roomActions = data.rooms.filter((room) =>
      room.serviceStatus !== 'active' || ['dirty', 'in-progress'].includes(room.housekeepingStatus));
    const availableRooms = data.rooms.filter((room) =>
      room.serviceStatus === 'active' && room.occupancyStatus === 'available').length;
    const roomsNotReady = data.rooms.filter((room) =>
      room.serviceStatus !== 'active' || !['clean', 'inspected'].includes(room.housekeepingStatus)).length;

    return {
      summary: {
        arrivals: arrivals.length,
        departures: departures.length,
        inHouseGuests: inHouse.reduce((sum, reservation) => sum + Number(reservation.guestCount || 0), 0),
        availableRooms,
        roomsNotReady
      },
      queues: {
        arrivals, departures,
        inHouseIssues: inHouse.filter((reservation) => reservation.hasIssue).map(decorate),
        roomActions,
        exceptions: [...expired.map(decorate), ...arrivalIssues.filter((item) => !expired.some((expiredItem) => expiredItem.id === item.id))],
        agenda: (data.agendaItems || []).filter((item) => item.date === today && !item.done)
      }
    };
  }

  global.GroupStayToday = { buildTodayViewModel, nextAction, todayIso };
})(window);
```

- [ ] **Step 4: Run test and verify GREEN**

Load `js/features/today.js` before `script.js`.

Run: `node --test tests/today.test.mjs`

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add js/features/today.js index.html tests/today.test.mjs
git commit -m 'feat: model the daily reception queue'
```

---

### Task 6: Replace Dashboard with the reactive Oggi workspace

**Files:**
- Modify: `index.html:278-500`
- Modify: `js/features/today.js`
- Delete: `js/features/dashboard.js`
- Delete: `js/features/dashboard-ui.js`
- Modify: `script.js:289-308,1762,4710-4785`
- Modify: `css/09-dashboard-overrides.css`
- Test: `tests/today-ui.test.mjs`

- [ ] **Step 1: Write the failing Oggi contract test**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('Oggi uses one summary strip and six operational queues', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(html.includes(`id='todaySummary'`));
  for (const id of ['todayArrivals', 'todayDepartures', 'todayInHouseIssues', 'todayRoomActions', 'todayExceptions', 'todayAgenda']) {
    assert.ok(html.includes(`id='${id}'`));
  }
  assert.ok(!html.includes('kpi-card'));
  assert.ok(!html.includes('dashboard-forecast-list'));
});

test('legacy dashboard bridge is removed', () => {
  assert.equal(fs.existsSync('js/features/dashboard-ui.js'), false);
  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(!html.includes('dashboard-ui.js'));
});
```

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/today-ui.test.mjs`

Expected: FAIL on old KPI/card markup and existing dashboard bridge.

- [ ] **Step 3: Replace the dashboard markup with the Oggi workspace**

Keep the existing `page-dashboard` route target so bookmarks remain valid, but replace its contents with this structure. Exceptions come first in the visual order whenever the list is non-empty; the controller toggles `hidden` on that section.

```html
<section id='page-dashboard' class='page today-page' aria-labelledby='todayTitle'>
  <header class='page-header'>
    <div><p class='eyebrow'>Operatività</p><h1 id='todayTitle'>Oggi</h1></div>
    <time id='todayDate' class='page-date'></time>
  </header>
  <dl id='todaySummary' class='today-summary' aria-label='Riepilogo di oggi'>
    <div><dt>Arrivi</dt><dd data-summary='arrivals'>0</dd></div>
    <div><dt>Partenze</dt><dd data-summary='departures'>0</dd></div>
    <div><dt>Ospiti presenti</dt><dd data-summary='inHouseGuests'>0</dd></div>
    <div><dt>Camere disponibili</dt><dd data-summary='availableRooms'>0</dd></div>
    <div><dt>Da preparare</dt><dd data-summary='roomsNotReady'>0</dd></div>
  </dl>
  <div id='todayWorkspace' class='today-workspace'>
    <section id='todayExceptionsSection' class='today-queue today-queue--exceptions' hidden>
      <h2>Eccezioni</h2><div id='todayExceptions'></div>
    </section>
    <section class='today-queue'><h2>Arrivi</h2><div id='todayArrivals'></div></section>
    <section class='today-queue'><h2>Partenze</h2><div id='todayDepartures'></div></section>
    <section class='today-queue'><h2>Durante il soggiorno</h2><div id='todayInHouseIssues'></div></section>
    <section class='today-queue'><h2>Camere da gestire</h2><div id='todayRoomActions'></div></section>
    <section class='today-queue'><h2>Agenda</h2><div id='todayAgenda'></div></section>
  </div>
</section>
```

- [ ] **Step 4: Make `GroupStayToday` a reactive feature controller**

Retain `buildTodayViewModel` and `nextAction`, then add `init`, `render`, and `destroy`. Build room rows with `GroupStayRoomState`, subscribe through the store selector, and render escaped text plus semantic buttons carrying only stable IDs.

```js
let unsubscribe = null;
let root = null;
let controllerDeps = null;

function renderQueue(container, items, kind) {
  container.replaceChildren(...items.map((item) => {
    const row = document.createElement('article');
    row.className = 'today-row';
    const title = document.createElement('h3');
    title.textContent = item.guestName || item.name || item.number || 'Senza nome';
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'button button--quiet';
    action.dataset.todayAction = item.action || (kind === 'rooms' ? 'open-room' : 'open-reservation');
    action.dataset.entityId = String(item.id);
    action.textContent = item.actionLabel || 'Apri';
    row.append(title, action);
    return row;
  }));
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Nessuna attività';
    container.append(empty);
  }
}

function render(state) {
  const today = todayIso();
  const data = state.data;
  const roomRows = GroupStayRoomState.buildRoomOperationalRows({
    rooms: data.rooms, reservations: data.reservations, guests: data.guests,
    date: today, bookingRules: GroupStayBookingRules
  });
  const model = buildTodayViewModel(
    { ...data, rooms: roomRows },
    { today, bookingRules: GroupStayBookingRules }
  );
  Object.entries(model.summary).forEach(([key, value]) => {
    root.querySelector(`[data-summary='${key}']`).textContent = String(value);
  });
  const exceptions = root.querySelector('#todayExceptionsSection');
  exceptions.hidden = model.queues.exceptions.length === 0;
  renderQueue(root.querySelector('#todayExceptions'), model.queues.exceptions, 'reservations');
  renderQueue(root.querySelector('#todayArrivals'), model.queues.arrivals, 'reservations');
  renderQueue(root.querySelector('#todayDepartures'), model.queues.departures, 'reservations');
  renderQueue(root.querySelector('#todayInHouseIssues'), model.queues.inHouseIssues, 'reservations');
  renderQueue(root.querySelector('#todayRoomActions'), model.queues.roomActions, 'rooms');
  renderQueue(root.querySelector('#todayAgenda'), model.queues.agenda, 'agenda');
}
```

Use one delegated listener. Reservation lifecycle actions call the committed controller from phase 03; housekeeping actions call the controller from Task 2. Never mutate a room or reservation inside this feature.

```js
async function handleAction(event) {
  const button = event.target.closest('[data-today-action]');
  if (!button || !root.contains(button)) return;
  const id = button.dataset.entityId;
  switch (button.dataset.todayAction) {
    case 'open-reservation':
      controllerDeps.navigate('prenotazioni');
      controllerDeps.openReservation(id);
      break;
    case 'check-in':
    case 'check-out':
    case 'no-show':
      await GroupStayReservationActions.transition(id, button.dataset.todayAction);
      break;
    case 'mark-clean':
      await GroupStayHousekeeping.updateHousekeeping(id, 'clean');
      break;
    case 'inspect':
      await GroupStayHousekeeping.updateHousekeeping(id, 'inspected');
      break;
    case 'open-room':
      controllerDeps.navigate('camere');
      controllerDeps.openRoom(id);
      break;
  }
}

function init({ store = window.appStore, navigate, openReservation, openRoom } = {}) {
  destroy();
  controllerDeps = { navigate, openReservation, openRoom };
  root = document.querySelector('#page-dashboard');
  root.addEventListener('click', handleAction);
  unsubscribe = store.subscribe(
    (state) => state.data,
    () => render(store.getState()),
    { equality: Object.is }
  );
  render(store.getState());
}

function destroy() {
  if (root) root.removeEventListener('click', handleAction);
  if (unsubscribe) unsubscribe();
  root = null;
  unsubscribe = null;
  controllerDeps = null;
}

global.GroupStayToday = { buildTodayViewModel, destroy, init, nextAction, render, todayIso };
```

Do not add a `MutationObserver`, timer, second source of state, or inline handler.

- [ ] **Step 5: Replace dashboard boot wiring and delete both legacy feature files**

Load `today.js` in `index.html`. During authenticated boot, initialize it with the phase-02 router instance and existing entity openers; on logout call `GroupStayToday.destroy()`:

```js
GroupStayToday.init({
  store: appStore,
  navigate: (route) => appRouter.navigate(route),
  openReservation: openReservationDetail,
  openRoom: openEditRoom
});
```

Keep `renderDashboard` temporarily as a one-line compatibility adapter while old call sites are removed in the same step:

```js
function renderDashboard() {
  window.GroupStayToday.render(window.appStore.getState());
}
```

Delete `js/features/dashboard.js`, `js/features/dashboard-ui.js`, and their script tags. Ensure the Oggi navigation entry resolves through `GroupStayRouter` rather than directly toggling the dashboard page.

- [ ] **Step 6: Style a dense, readable workspace**

Replace obsolete KPI/card rules in `css/09-dashboard-overrides.css` with layout-only styles that consume phase 05 tokens:

```css
.today-summary {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin: 0 0 var(--space-5);
  border-block: 1px solid var(--border-subtle);
}
.today-summary > div { padding: var(--space-4); border-inline-end: 1px solid var(--border-subtle); }
.today-summary dt { color: var(--text-muted); font-size: var(--text-sm); }
.today-summary dd { margin: .25rem 0 0; font: 600 var(--text-xl)/1.1 var(--font-sans); }
.today-workspace { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
.today-queue { min-width: 0; border-top: 2px solid var(--border-strong); }
.today-queue--exceptions { grid-column: 1 / -1; border-color: var(--status-danger); }
.today-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--space-3); min-height: 3rem; border-bottom: 1px solid var(--border-subtle); }
@media (max-width: 900px) {
  .today-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .today-workspace { grid-template-columns: 1fr; }
}
```

Do not use fixed card heights, decorative gradients, or entrance animations.

- [ ] **Step 7: Verify and commit the Oggi replacement**

Run: `node --test tests/today.test.mjs tests/today-ui.test.mjs tests/housekeeping.test.mjs`

Expected: all focused tests PASS.

Run: `npm.cmd test`

Expected: full unit and contract suite PASS.

```powershell
git add index.html script.js js/features/today.js css/09-dashboard-overrides.css tests/today-ui.test.mjs
git add -u js/features/dashboard.js js/features/dashboard-ui.js
git commit -m 'feat: replace dashboard with today operations'
```

---

### Task 7: Prove the reception operations stay synchronized

**Files:**
- Create: `tests/reception-operations-contract.test.mjs`
- Modify: `tests/ui-contract.test.js`
- Verify: `script.js`
- Verify: `js/features/today.js`
- Verify: `js/features/rooms.js`
- Verify: `js/features/planner.js`

- [ ] **Step 1: Write the cross-feature contract test**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const sources = [
  'script.js', 'js/features/today.js', 'js/features/rooms.js',
  'js/features/planner.js', 'js/features/housekeeping.js'
].map((file) => fs.readFileSync(file, 'utf8')).join('\n');

test('all reception surfaces consume the canonical app store', () => {
  assert.match(fs.readFileSync('js/features/today.js', 'utf8'), /appStore|store/);
  assert.match(fs.readFileSync('js/features/rooms.js', 'utf8'), /appStore|store/);
  assert.match(fs.readFileSync('js/features/planner.js', 'utf8'), /appStore|store/);
  assert.doesNotMatch(sources, /room\.status\s*=/);
  assert.doesNotMatch(sources, /rm\.status\s*=/);
});

test('checkout and housekeeping commit server-returned rooms', () => {
  const actions = fs.readFileSync('js/features/reservation-actions.js', 'utf8');
  const housekeeping = fs.readFileSync('js/features/housekeeping.js', 'utf8');
  assert.match(actions, /response\.rooms/);
  assert.match(actions, /reservation\/transition-committed/);
  assert.match(housekeeping, /response\.room/);
  assert.match(housekeeping, /housekeeping\/committed/);
});

test('no legacy dashboard implementation remains', () => {
  assert.equal(fs.existsSync('js/features/dashboard.js'), false);
  assert.equal(fs.existsSync('js/features/dashboard-ui.js'), false);
});
```

- [ ] **Step 2: Run the integration contract and verify RED**

Run: `node --test tests/reception-operations-contract.test.mjs`

Expected: FAIL until every consumer reads committed state and the dashboard files are deleted.

- [ ] **Step 3: Exercise the committed checkout path manually in code**

Use the phase-03 transition controller and verify this exact sequence in a focused test fixture:

1. `PUT /api/reservations?action=transition` returns the checked-out reservation and every assigned room with `housekeepingStatus: 'dirty'`;
2. `GroupStayReservationActions.transition` applies both arrays in one `reservation/transition-committed` store update;
3. the existing subscriptions re-render Oggi, Camere, and Planning from that committed snapshot;
4. a rejected API call leaves the previous snapshot unchanged.

If any feature still keeps a private rooms or reservations array, replace it with a store selector in this task. Do not add refresh timers to mask stale state.

- [ ] **Step 4: Run the complete phase verification**

Run: `node --test tests/room-state.test.mjs tests/housekeeping.test.mjs tests/rooms-ui.test.mjs tests/room-state-compat.test.mjs tests/today.test.mjs tests/today-ui.test.mjs tests/reception-operations-contract.test.mjs`

Expected: all phase-04 tests PASS.

Run: `npm.cmd test`

Expected: full suite PASS with zero failures.

Run: `rg -n 'room\.status|rm\.status|dashboard-ui|features/dashboard\.js' script.js index.html js tests`

Expected: no production matches; only explicit negative assertions in contract tests are allowed.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 5: Commit the phase integration contract**

```powershell
git add script.js js/features/today.js js/features/rooms.js js/features/planner.js tests/reception-operations-contract.test.mjs tests/ui-contract.test.js
git commit -m 'test: cover reception operations integration'
```
