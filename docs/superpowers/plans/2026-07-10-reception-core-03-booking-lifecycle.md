# Reception Core Phase 03: Booking Rules and Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give group and individual reservations one tested availability model, authoritative server validation, and a complete reception lifecycle without adding a public serverless route.

**Architecture:** A shared JSON fixture suite proves parity between a browser IIFE (`GroupStayBookingRules`) and an ESM server module. The existing `api/reservations.js` delegates validation and persistence to focused private modules, while lifecycle transitions remain an action on that same route; committed responses replace store entities atomically. Room service and housekeeping fields continue through the existing `api/rooms.js` route.

**Tech Stack:** Vanilla JavaScript IIFEs, Node.js ESM, Node built-in test runner, Neon tagged SQL, existing `GroupStayStore`/`GroupStayApi`, HTML/CSS.

**Prerequisites:** Complete phases 01-02 first: migration runner `scripts/migrate.mjs`, normalized `GroupStayApi.AppError`, hash shell, and `window.appStore` must exist. Phase 04 consumes the room and transition contracts defined here.

**Hard constraints:** Do not create a file under `api/` that exports another public handler. The route count must stay at 11 after phase 01 removes Mail and `api/init.js`. Do not use `uncodixfy`.

---

## File map and locked contracts

- `tests/fixtures/booking-cases.json`: runtime-neutral inputs and expected validation codes used by browser and server tests.
- `js/core/booking-rules.js`: pure presentation/preflight rules exposed as `window.GroupStayBookingRules`.
- `api/_booking-rules.js`: equivalent pure ESM rules for authoritative checks.
- `api/_validators.js`: request parsing, canonical enums, field-level errors; no database access.
- `api/_reservation-service.js`: owner-scoped reads/writes and transition transaction orchestration.
- `api/reservations.js`: the only public reservation handler; dispatches CRUD and `PUT ?action=transition`.
- `scripts/migrations/003-booking-lifecycle.mjs`: idempotent lifecycle/room schema migration.
- `js/features/reservation-actions.js`: valid actions, confirmation flow, API call, and committed store replacement.

Canonical statuses are `pending`, `confirmed`, `checked-in`, `checked-out`, `cancelled`, and `no-show`. Stable validation codes are `INVALID_DATE_RANGE`, `DUPLICATE_ROOM`, `ROOM_NOT_FOUND`, `ROOM_OUT_OF_SERVICE`, `ROOM_AVAILABILITY_CONFLICT`, `INDIVIDUAL_CAPACITY`, `GROUP_CAPACITY`, `GROUP_ROOM_COUNT_MISMATCH`, `NO_ASSIGNED_ROOM`, `OPTION_INCOMPLETE`, and `ROOM_NOT_READY`. Conflict responses have shape `{ error: { code, message, fieldErrors, conflicts } }`; a transition success has shape `{ reservation, rooms: [] }`.

### Task 1: Lock browser/server parity for booking rules

**Files:**
- Create: `tests/fixtures/booking-cases.json`
- Create: `tests/booking-rules.test.mjs`
- Create: `tests/booking-rules-server.test.mjs`
- Create: `js/core/booking-rules.js`
- Create: `api/_booking-rules.js`
- Modify: `index.html:1810-1840`

- [ ] **Step 1: Create the shared failing fixtures and browser test**

Create `tests/fixtures/booking-cases.json` with these cases:

```json
[
  {"name":"same-day turnover","candidate":{"id":"new","status":"confirmed","checkin":"2026-07-12","checkout":"2026-07-14","guestCount":2,"roomCount":1,"roomIds":["r1"],"resType":"individual"},"reservations":[{"id":"old","status":"confirmed","checkin":"2026-07-10","checkout":"2026-07-12","roomIds":["r1"]}],"rooms":[{"id":"r1","capacity":2,"serviceStatus":"active","housekeepingStatus":"clean"}],"today":"2026-07-10","codes":[]},
  {"name":"expired option does not block","candidate":{"id":"new","status":"confirmed","checkin":"2026-07-12","checkout":"2026-07-14","guestCount":2,"roomCount":1,"roomIds":["r1"],"resType":"individual"},"reservations":[{"id":"opt","status":"pending","expiration":"2026-07-09","checkin":"2026-07-12","checkout":"2026-07-14","roomIds":["r1"]}],"rooms":[{"id":"r1","capacity":2,"serviceStatus":"active","housekeepingStatus":"clean"}],"today":"2026-07-10","codes":[]},
  {"name":"overlap and duplicate","candidate":{"id":"new","status":"confirmed","checkin":"2026-07-11","checkout":"2026-07-13","guestCount":2,"roomCount":2,"roomIds":["r1","r1"],"resType":"group"},"reservations":[{"id":"live","status":"checked-in","checkin":"2026-07-10","checkout":"2026-07-12","roomIds":["r1"]}],"rooms":[{"id":"r1","capacity":2,"serviceStatus":"active","housekeepingStatus":"clean"}],"today":"2026-07-10","codes":["DUPLICATE_ROOM","GROUP_ROOM_COUNT_MISMATCH","ROOM_AVAILABILITY_CONFLICT"]},
  {"name":"out of service","candidate":{"id":"new","status":"confirmed","checkin":"2026-07-11","checkout":"2026-07-13","guestCount":1,"roomCount":1,"roomIds":["r2"],"resType":"individual"},"reservations":[],"rooms":[{"id":"r2","capacity":2,"serviceStatus":"maintenance","housekeepingStatus":"clean"}],"today":"2026-07-10","codes":["ROOM_OUT_OF_SERVICE"]},
  {"name":"group capacity and declared count","candidate":{"id":"new","status":"confirmed","checkin":"2026-07-11","checkout":"2026-07-13","guestCount":5,"roomCount":3,"roomIds":["r1","r2"],"resType":"group"},"reservations":[],"rooms":[{"id":"r1","capacity":2,"serviceStatus":"active","housekeepingStatus":"clean"},{"id":"r2","capacity":2,"serviceStatus":"active","housekeepingStatus":"clean"}],"today":"2026-07-10","codes":["GROUP_CAPACITY","GROUP_ROOM_COUNT_MISMATCH"]},
  {"name":"incomplete option is explicit","candidate":{"id":"new","status":"pending","checkin":"2026-07-11","checkout":"2026-07-13","guestCount":8,"roomCount":4,"roomIds":[],"resType":"group"},"reservations":[],"rooms":[],"today":"2026-07-10","codes":["OPTION_INCOMPLETE"]}
]
```

In `tests/booking-rules.test.mjs`, load the IIFE with `vm`, run every fixture through `validateReservation`, sort `issues.map(issue => issue.code)`, and compare it with `codes`. Also assert `overlaps('2026-07-10','2026-07-12','2026-07-12','2026-07-13') === false`, terminal statuses never block, and an edit excludes its own ID.

- [ ] **Step 2: Run the browser test and verify RED**

Run: `node --test tests/booking-rules.test.mjs`

Expected: FAIL with `ENOENT: js/core/booking-rules.js`.

- [ ] **Step 3: Implement the browser rules**

`js/core/booking-rules.js` must export this exact interface:

```js
(function initBookingRules(global) {
  const BLOCKING = new Set(['pending', 'confirmed', 'checked-in']);
  const TERMINAL = new Set(['checked-out', 'cancelled', 'no-show']);
  const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;
  const isExpiredOption = (r, today) => r.status === 'pending' && Boolean(r.expiration) && r.expiration < today;
  const blocksInventory = (r, today) => BLOCKING.has(r.status) && !isExpiredOption(r, today);

  function validateReservation({ candidate, reservations, rooms, today, excludeReservationId = candidate.id }) {
    const issues = [];
    const ids = candidate.roomIds || [];
    const distinctIds = [...new Set(ids)];
    const roomById = new Map(rooms.map((room) => [room.id, room]));
    if (!candidate.checkin || !candidate.checkout || candidate.checkin >= candidate.checkout) issues.push({ code: 'INVALID_DATE_RANGE', field: 'checkout' });
    if (distinctIds.length !== ids.length) issues.push({ code: 'DUPLICATE_ROOM', field: 'roomIds' });
    distinctIds.forEach((id) => {
      const room = roomById.get(id);
      if (!room) issues.push({ code: 'ROOM_NOT_FOUND', field: 'roomIds', roomId: id });
      else if (room.serviceStatus !== 'active') issues.push({ code: 'ROOM_OUT_OF_SERVICE', field: 'roomIds', roomId: id });
    });
    const conflicts = reservations.filter((r) => r.id !== excludeReservationId && blocksInventory(r, today) && overlaps(candidate.checkin, candidate.checkout, r.checkin, r.checkout) && (r.roomIds || []).some((id) => distinctIds.includes(id)));
    conflicts.forEach((r) => issues.push({ code: 'ROOM_AVAILABILITY_CONFLICT', field: 'roomIds', reservationId: r.id, roomIds: r.roomIds.filter((id) => distinctIds.includes(id)) }));
    const capacity = distinctIds.reduce((sum, id) => sum + Number(roomById.get(id)?.capacity || 0), 0);
    if (candidate.resType === 'individual' && capacity < candidate.guestCount) issues.push({ code: 'INDIVIDUAL_CAPACITY', field: 'guestCount' });
    if (candidate.resType !== 'individual' && capacity < candidate.guestCount && candidate.status !== 'pending') issues.push({ code: 'GROUP_CAPACITY', field: 'guestCount' });
    if (candidate.resType !== 'individual' && distinctIds.length !== candidate.roomCount && candidate.status !== 'pending') issues.push({ code: 'GROUP_ROOM_COUNT_MISMATCH', field: 'roomCount' });
    if (candidate.status === 'pending' && (!distinctIds.length || capacity < candidate.guestCount || distinctIds.length !== candidate.roomCount)) issues.push({ code: 'OPTION_INCOMPLETE', field: 'roomIds', severity: 'warning' });
    return { valid: !issues.some((issue) => issue.severity !== 'warning'), issues, conflicts };
  }

  global.GroupStayBookingRules = { BLOCKING, TERMINAL, overlaps, isExpiredOption, blocksInventory, validateReservation };
})(window);
```

- [ ] **Step 4: Implement ESM parity and its test**

Create `api/_booking-rules.js` with the same constants and functions, replace the final global assignment with:

```js
export { BLOCKING, TERMINAL, overlaps, isExpiredOption, blocksInventory, validateReservation };
```

`tests/booking-rules-server.test.mjs` imports `validateReservation` from `../api/_booking-rules.js`, runs the same fixture loop, and asserts the sorted codes exactly equal each fixture's `codes`.

Add `<script src='js/core/booking-rules.js'></script>` before feature scripts in `index.html`.

- [ ] **Step 5: Verify parity and commit**

Run: `node --test tests/booking-rules.test.mjs tests/booking-rules-server.test.mjs`

Expected: 2 suites PASS; all fixture subtests pass in both runtimes.

```bash
git add tests/fixtures/booking-cases.json tests/booking-rules.test.mjs tests/booking-rules-server.test.mjs js/core/booking-rules.js api/_booking-rules.js index.html
git commit -m "feat: define canonical booking rules"
```

### Task 2: Migrate lifecycle timestamps and independent room state

**Files:**
- Create: `scripts/migrations/003-booking-lifecycle.mjs`
- Create: `tests/booking-lifecycle-migration.test.mjs`

- [ ] **Step 1: Write the failing migration contract test**

Read the migration source and assert it exports `{ id: '003-booking-lifecycle', up }`, adds `status_updated_at`, `checked_in_at`, `checked_out_at`, `cancelled_at`, `no_show_at`, `housekeeping_status`, normalizes room status with a `CASE`, installs status/check constraints, and creates owner/date/status indexes. Assert it contains neither `DROP TABLE` nor a public handler export.

- [ ] **Step 2: Run the migration test and verify RED**

Run: `node --test tests/booking-lifecycle-migration.test.mjs`

Expected: FAIL because migration 003 does not exist.

- [ ] **Step 3: Add the idempotent migration**

Export `id` and `up(sql)` and execute these statements through the phase-01 runner:

```sql
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS housekeeping_status TEXT NOT NULL DEFAULT 'clean';
UPDATE rooms SET status = CASE WHEN status = 'maintenance' THEN 'maintenance' ELSE 'active' END WHERE status IN ('available','occupied','maintenance');
CREATE INDEX IF NOT EXISTS idx_reservations_owner_stay_status ON reservations(owner_user_id, checkin, checkout, status);
CREATE INDEX IF NOT EXISTS idx_rooms_owner_service ON rooms(owner_user_id, status);
```

Use guarded `DO $$ ... $$` blocks named `reservations_status_allowed`, `rooms_service_status_allowed`, and `rooms_housekeeping_status_allowed` so reruns are safe. Allowed values must exactly match the enums in the file map. Do not rewrite terminal history timestamps during migration.

- [ ] **Step 4: Verify migration and route count**

Run: `node --test tests/booking-lifecycle-migration.test.mjs`

Expected: PASS.

Run: `(Get-ChildItem api -File -Filter '*.js' | Where-Object Name -NotLike '_*').Count`

Expected: `11`; no new public route.

- [ ] **Step 5: Commit**

```bash
git add scripts/migrations/003-booking-lifecycle.mjs tests/booking-lifecycle-migration.test.mjs
git commit -m "feat: migrate booking lifecycle state"
```

### Task 3: Make reservation writes authoritative and owner-scoped

**Files:**
- Create: `api/_validators.js`
- Create: `api/_reservation-service.js`
- Modify: `api/reservations.js:1-150`
- Create: `tests/reservation-service.test.mjs`
- Create: `tests/reservations-api.test.mjs`

- [ ] **Step 1: Write failing validator/service tests**

Use an in-memory repository with `listReservations`, `listRooms`, `findReservation`, `insertReservation`, and `updateReservation`. Assert:

```js
test('create rejects a conflicting room with stable details', async () => {
  const service = createReservationService({ repository: conflictingRepository, now: () => new Date('2026-07-10T09:00:00Z') });
  await assert.rejects(service.create('owner-a', candidate), (error) =>
    error.status === 409 && error.code === 'ROOM_AVAILABILITY_CONFLICT' &&
    error.conflicts[0].reservationId === 'existing' && error.conflicts[0].roomIds[0] === 'r1');
});

test('ordinary update cannot smuggle a lifecycle change', async () => {
  await assert.rejects(service.update('owner-a', 'booking-1', { ...confirmed, status: 'checked-in' }),
    (error) => error.status === 400 && error.code === 'STATUS_REQUIRES_TRANSITION');
});

test('owner id scopes reads and writes', async () => {
  await assert.rejects(service.update('owner-b', 'booking-1', confirmed),
    (error) => error.status === 404 && error.code === 'RESERVATION_NOT_FOUND');
  assert.deepEqual(repository.calls.find, [['owner-b', 'booking-1']]);
});
```

In `tests/reservations-api.test.mjs`, instantiate the named `createReservationsHandler` export with fake auth/service dependencies. Assert unauthenticated access ends before service calls, validation errors use phase-01 `sendError`, `POST` returns `201` plus the committed reservation, and `PUT` returns `200` plus the committed reservation.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/reservation-service.test.mjs tests/reservations-api.test.mjs`

Expected: FAIL because `_validators.js`, `_reservation-service.js`, and `createReservationsHandler` do not exist.

- [ ] **Step 3: Implement request normalization and stable errors**

Create `api/_validators.js` with these exports and exact enum checks:

```js
const RESERVATION_STATUSES = ['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled', 'no-show'];
const WRITABLE_INITIAL_STATUSES = ['pending', 'confirmed'];

class RequestError extends Error {
  constructor(status, code, message, { fieldErrors = {}, conflicts = [] } = {}) {
    super(message);
    Object.assign(this, { status, code, fieldErrors, conflicts });
  }
}

function normalizeReservationPayload(body = {}) {
  return {
    id: String(body.id || '').trim(), groupName: String(body.groupName || '').trim(),
    organizer: String(body.organizer || '').trim(), email: String(body.email || '').trim(),
    phone: String(body.phone || '').trim(), checkin: String(body.checkin || ''),
    checkout: String(body.checkout || ''), guestCount: Number(body.guestCount),
    roomCount: Number(body.roomCount), roomIds: Array.isArray(body.roomIds) ? body.roomIds.map(String) : [],
    status: String(body.status || 'pending'), expiration: body.expiration ? String(body.expiration) : null,
    resType: body.resType === 'individual' ? 'individual' : 'group', price: Number(body.price) || 0,
    pricePerPerson: Number(body.pricePerPerson) || 0, gratuity: Number(body.gratuity) || 0,
    notes: String(body.notes || ''), roomNotes: String(body.roomNotes || ''),
    mealPlan: String(body.mealPlan || 'BB'), intolerances: Array.isArray(body.intolerances) ? body.intolerances : [],
    veggieBuffet: Boolean(body.veggieBuffet), extraCosts: Array.isArray(body.extraCosts) ? body.extraCosts : []
  };
}
```

Add `assertReservationShape(candidate, { creating, storedStatus })`: require ID/name/dates, non-negative integer guests/rooms, valid status, a valid option expiration date when present, and a syntactically valid email when non-empty. On create permit only `pending|confirmed`; on update require `candidate.status === storedStatus`. Throw `RequestError(400, 'VALIDATION_ERROR', 'Controlla i campi evidenziati.', { fieldErrors })`, except a status edit throws code `STATUS_REQUIRES_TRANSITION`.

- [ ] **Step 4: Implement the injectable reservation service**

Import `validateReservation` and `TERMINAL` from `api/_booking-rules.js`, and `RequestError`, `normalizeReservationPayload`, and `assertReservationShape` from `api/_validators.js`. The service must call server `validateReservation` immediately before every insert/update and translate issues with this code:

```js
function throwForIssues(result, candidate) {
  const blocking = result.issues.filter((issue) => issue.severity !== 'warning');
  if (!blocking.length) return result.issues;
  const conflicts = result.conflicts.map((r) => ({
    reservationId: r.id, name: r.groupName, checkin: r.checkin,
    checkout: r.checkout, roomIds: (r.roomIds || []).filter((id) => candidate.roomIds.includes(id))
  }));
  const code = blocking.some((issue) => issue.code === 'ROOM_AVAILABILITY_CONFLICT')
    ? 'ROOM_AVAILABILITY_CONFLICT' : blocking[0].code;
  throw new RequestError(code === 'ROOM_AVAILABILITY_CONFLICT' ? 409 : 400, code,
    code === 'ROOM_AVAILABILITY_CONFLICT' ? 'Una o piu camere non sono disponibili.' : 'La prenotazione non e valida.',
    { fieldErrors: Object.fromEntries(blocking.map((issue) => [issue.field, issue.code])), conflicts });
}

function createReservationService({ repository, now = () => new Date() }) {
  async function validate(ownerId, candidate, excludeReservationId) {
    const [reservations, rooms] = await Promise.all([
      repository.listReservations(ownerId), repository.listRooms(ownerId)
    ]);
    return throwForIssues(validateReservation({ candidate, reservations, rooms,
      today: now().toISOString().slice(0, 10), excludeReservationId }), candidate);
  }
  return { create, update, list, remove, transition };
}
```

Implement `create` and `update` around that helper: normalize, shape-check, load the stored record before update, validate, then return the repository's mapped committed row. Warnings such as `OPTION_INCOMPLETE` are returned as `validationWarnings` on the response object but are not stored as inventory records.

Add `createSqlReservationRepository(sql)` in the same file. Every query includes `owner_user_id`; serialize `roomIds`, `intolerances`, and `extraCosts` exactly once; parse malformed legacy JSON as an empty array; map all lifecycle timestamps to camelCase ISO strings. `insertReservation` and `updateReservation` list every existing reservation column and use `RETURNING *`; an owner-scoped lookup/update with no row throws `RESERVATION_NOT_FOUND`.

- [ ] **Step 5: Reduce the existing handler to dispatch only**

After phase 01 has removed Mail branches, export a handler factory and retain the default export:

```js
export function createReservationsHandler({ auth = requireAuth, sqlFactory = getSQL } = {}) {
  return async function reservationsHandler(req, res) {
    const user = await auth(req, res);
    if (!user) return;
    try {
      const service = createReservationService({ repository: createSqlReservationRepository(sqlFactory()) });
      if (req.method === 'GET') return res.status(200).json(await service.list(user.id));
      if (req.method === 'POST') return res.status(201).json({ reservation: await service.create(user.id, req.body) });
      if (req.method === 'PUT' && (req.query.action || req.body?.action) !== 'transition') {
        return res.status(200).json({ reservation: await service.update(user.id, req.body?.id, req.body) });
      }
      if (req.method === 'DELETE') return res.status(200).json(await service.remove(user.id, req.query.id));
      return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Metodo non consentito.' } });
    } catch (error) {
      return sendError(res, error);
    }
  };
}
export default createReservationsHandler();
```

Deletion removes guests and the reservation in one owner-scoped transaction and returns `{ id, deleted: true }`. The default handler must never expose `error.message` for unrecognized server errors.

- [ ] **Step 6: Verify and commit**

Run: `node --test tests/booking-rules-server.test.mjs tests/reservation-service.test.mjs tests/reservations-api.test.mjs`

Expected: PASS with stable 400/404/409 payload assertions.

```bash
git add api/_validators.js api/_reservation-service.js api/reservations.js tests/reservation-service.test.mjs tests/reservations-api.test.mjs
git commit -m "feat: enforce authoritative reservation writes"
```

### Task 4: Normalize the existing rooms API contract

**Files:**
- Modify: `api/rooms.js:1-82`
- Create: `tests/rooms-api.test.mjs`

- [ ] **Step 1: Write failing room API tests**

Invoke a named `createRoomsHandler` export with fake auth/repository dependencies. Assert GET maps database `status` to `serviceStatus` and `housekeeping_status` to `housekeepingStatus`; POST/PUT accept only `active|maintenance|out-of-order` and `clean|dirty|in-progress|inspected`; invalid values produce `400 INVALID_ROOM_STATE`; all operations receive the authenticated owner ID; successful writes return `{ room }`, not `{ success: true }`.

```js
assert.deepEqual(response.body.room, {
  id: 'r1', number: '101', floor: 1, type: 'double', capacity: 2,
  serviceStatus: 'active', housekeepingStatus: 'dirty', maintenanceNote: '', price: 120
});
await handler(request('PUT', { id: 'r1', serviceStatus: 'occupied' }), response);
assert.equal(response.statusCode, 400);
assert.equal(response.body.error.code, 'INVALID_ROOM_STATE');
```

- [ ] **Step 2: Run test and verify RED**

Run: `node --test tests/rooms-api.test.mjs`

Expected: FAIL because the current API exposes legacy `status` and no handler factory.

- [ ] **Step 3: Implement mapping and validation in the same public route**

Use these pure helpers inside `api/rooms.js`:

```js
const SERVICE = new Set(['active', 'maintenance', 'out-of-order']);
const HOUSEKEEPING = new Set(['clean', 'dirty', 'in-progress', 'inspected']);
const mapRoom = (row) => ({
  id: row.id, number: row.number, floor: Number(row.floor), type: row.type,
  capacity: Number(row.capacity), serviceStatus: row.status,
  housekeepingStatus: row.housekeeping_status,
  maintenanceNote: row.maintenance_note || '', price: Number(row.price) || 0
});
function normalizeRoom(body = {}) {
  const room = { ...body, serviceStatus: body.serviceStatus || 'active',
    housekeepingStatus: body.housekeepingStatus || 'clean' };
  if (!SERVICE.has(room.serviceStatus) || !HOUSEKEEPING.has(room.housekeepingStatus)) {
    throw new RequestError(400, 'INVALID_ROOM_STATE', 'Stato camera non valido.');
  }
  return room;
}
```

Use `status=${room.serviceStatus}` and `housekeeping_status=${room.housekeepingStatus}` in inserts/updates, always with `RETURNING *`. Keep DELETE in `api/rooms.js`, clear owner-scoped guest room assignments, and return `{ id, deleted: true }`. Export `createRoomsHandler` plus its default instance and route all errors through `sendError` from `api/_http.js`.

- [ ] **Step 4: Verify route count and commit**

Run: `node --test tests/rooms-api.test.mjs`

Expected: PASS.

Run: `(Get-ChildItem api -File -Filter '*.js' | Where-Object Name -NotLike '_*').Count`

Expected: `11`.

```bash
git add api/rooms.js tests/rooms-api.test.mjs
git commit -m "feat: normalize room API state"
```

### Task 5: Put both reservation forms on the canonical rules

**Files:**
- Modify: `index.html:1040-1335`
- Modify: `js/features/reservation-rooms.js:1-190`
- Modify: `js/features/group-reservation.js:1-190`
- Modify: `js/features/individual-reservation.js:1-225`
- Modify: `script.js:117-183,1785-1815`
- Create: `tests/reservation-forms.test.mjs`

- [ ] **Step 1: Write failing form-model and markup tests**

Load both feature IIFEs in `vm` and test their pure exports. Read `index.html` and assert group fields `resOrganizer`, `resPhone`, `resEmail`, `resDeclaredRoomCount`, `resValidationSummary` and individual fields `indGuestCount`, `indExpiration`, `indValidationSummary` exist. Assert neither status select contains `checked-in`, `checked-out`, `cancelled`, or `no-show`.

```js
const groupPayload = group.buildPayload({
  id: '', groupName: '  Gruppo Verdi ', organizer: ' Anna ', phone: ' 333 ', email: ' a@b.it ',
  checkin: '2026-08-10', checkout: '2026-08-12', guestCount: '7', roomCount: '3',
  roomIds: ['r1', 'r2'], status: 'pending', expiration: '2026-08-01'
});
assert.deepEqual({
  groupName: groupPayload.groupName, organizer: groupPayload.organizer,
  guestCount: groupPayload.guestCount, roomCount: groupPayload.roomCount,
  roomIds: groupPayload.roomIds, resType: groupPayload.resType
}, { groupName: 'Gruppo Verdi', organizer: 'Anna', guestCount: 7,
  roomCount: 3, roomIds: ['r1', 'r2'], resType: 'group' });

assert.equal(individual.buildPayload({ guestCount: '2', roomId: 'r1' }).guestCount, 2);
assert.equal(individual.buildPayload({ guestCount: '2', roomId: 'r1' }).roomCount, 1);
```

Test a save with a deferred API promise: store state must remain unchanged before resolution; after `{ reservation }` resolves it must contain only the committed object. Reject with `new AppError({ status: 409, code: 'ROOM_AVAILABILITY_CONFLICT', conflicts })` and assert the editor remains open and the conflict summary receives room/name/date details.

- [ ] **Step 2: Run the form tests and verify RED**

Run: `node --test tests/reservation-forms.test.mjs`

Expected: FAIL on missing fields/pure builders and legacy individual lifecycle options.

- [ ] **Step 3: Add explicit operational fields and summaries**

Divide each form into identity/contact, stay, rooms, commercial data, and notes `<fieldset>` elements. Add labelled numeric inputs with these exact constraints:

```html
<input id='resDeclaredRoomCount' name='roomCount' type='number' min='0' step='1' required>
<input id='indGuestCount' name='guestCount' type='number' min='1' step='1' value='1' required>
<input id='indExpiration' name='expiration' type='date'>
<div id='resValidationSummary' class='form-validation-summary' role='alert' hidden></div>
<div id='indValidationSummary' class='form-validation-summary' role='alert' hidden></div>
```

Both status selects contain only `pending` (Opzione) and `confirmed` (Confermata); existing reservations in any other state show status as read-only and are changed only from detail actions. Add a persistent `<aside class='reservation-form-summary'>` with nights, declared rooms, selected rooms, total capacity, guests, and total price. For a pending incomplete group, the primary button label becomes `Salva opzione incompleta` and the summary says `Le camere non assegnate non bloccano disponibilita`.

- [ ] **Step 4: Replace duplicate availability calculations**

In `reservation-rooms.js`, delete `getOccupiedRoomMap` overlap logic and delegate to:

```js
function getRoomAvailability(candidate, excludeReservationId) {
  const { reservations, rooms } = appStore.getState().data;
  const result = GroupStayBookingRules.validateReservation({
    candidate, reservations, rooms, today: formatDate(new Date()), excludeReservationId
  });
  const blockedIds = new Set(result.issues
    .filter((issue) => ['ROOM_AVAILABILITY_CONFLICT', 'ROOM_OUT_OF_SERVICE'].includes(issue.code))
    .flatMap((issue) => issue.roomIds || [issue.roomId]).filter(Boolean));
  return { result, blockedIds };
}
```

Room rows show service status, capacity, and the conflicting reservation label. Housekeeping does not disable future selection. Export `getRoomAvailability` and use it for the group checklist and individual select; never assign `room.status`.

- [ ] **Step 5: Build payloads, preflight, then commit server responses**

Export pure `buildPayload(values)` from each form module. Group `roomCount` comes from `resDeclaredRoomCount`, never `selectedRooms.length`; individual `guestCount` comes from `indGuestCount`, never a constant. Preserve existing price, meal, extras, and notes fields. Use this common save sequence in both modules:

```js
const preflight = GroupStayBookingRules.validateReservation({
  candidate: payload,
  reservations: appStore.getState().data.reservations,
  rooms: appStore.getState().data.rooms,
  today: formatDate(new Date()),
  excludeReservationId: payload.id || null
});
const blocking = preflight.issues.filter((issue) => issue.severity !== 'warning');
if (blocking.length) return renderValidationSummary(summaryElement, blocking);

try {
  const response = payload.id
    ? await GroupStayApi.apiPut(API.reservations, payload)
    : await GroupStayApi.apiPost(API.reservations, { ...payload, id: generateId(), createdAt: new Date().toISOString() });
  appStore.setState((state) => ({ ...state, data: { ...state.data,
    reservations: upsertById(state.data.reservations, response.reservation) } }),
    payload.id ? 'reservation/update-committed' : 'reservation/create-committed');
  closeEditor();
} catch (error) {
  renderValidationSummary(summaryElement,
    error.code === 'ROOM_AVAILABILITY_CONFLICT' ? error.conflicts : error.fieldErrors);
}
```

Do not mutate arrays before the API response. A 409 preserves all field values and focus moves to the visible summary. Pending `OPTION_INCOMPLETE` warnings require the user to press the explicitly relabelled submit button once; confirmed saves treat incomplete room assignment/capacity/count as blocking.

- [ ] **Step 6: Wire store-backed dependencies and remove lifecycle globals**

Initialize the three modules with `appStore`, `GroupStayApi`, and `GroupStayBookingRules` in `script.js`. Delete setters used only for optimistic reservation mutation. Keep temporary global entry points for the existing HTML until phase 05 removes inline handlers, but each bridge is a one-line delegation and contains no validation or state logic.

- [ ] **Step 7: Verify forms and commit**

Run: `node --test tests/booking-rules.test.mjs tests/reservation-forms.test.mjs`

Expected: PASS; tests prove declared room count, individual guest count, pending expiration, deferred commit, and 409 editor retention.

```bash
git add index.html js/features/reservation-rooms.js js/features/group-reservation.js js/features/individual-reservation.js script.js tests/reservation-forms.test.mjs
git commit -m "feat: unify reservation form validation"
```

### Task 6: Implement canonical transitions on the existing reservation route

**Files:**
- Modify: `api/_reservation-service.js`
- Modify: `api/reservations.js`
- Create: `js/features/reservation-actions.js`
- Modify: `index.html:1810-1845`
- Modify: `script.js:185-220,1817-1822`
- Create: `tests/reservation-transitions.test.mjs`
- Create: `tests/reservation-actions.test.mjs`

- [ ] **Step 1: Write failing server transition tests**

Cover the exact normal graph and guards:

```js
const ALLOWED = {
  pending: new Set(['confirmed', 'cancelled']),
  confirmed: new Set(['checked-in', 'cancelled', 'no-show']),
  'checked-in': new Set(['checked-out'])
};
```

Assert invalid edges return `400 INVALID_TRANSITION`; check-in with no assigned room returns `409 NO_ASSIGNED_ROOM`; unavailable/service-off rooms use the booking codes from Task 1; dirty/in-progress rooms return `409 ROOM_NOT_READY` unless `overrideRoomReadiness: true`; early check-in returns `409 EARLY_CHECK_IN_CONFIRMATION_REQUIRED` unless `confirmEarlyCheckIn: true`; no-show before arrival returns `409 NO_SHOW_TOO_EARLY`.

For check-out, assert the repository transaction receives the owner ID, updates `status='checked-out'`, sets `checked_out_at` and `status_updated_at` to the injected clock, changes every assigned room to `housekeeping_status='dirty'`, and returns exactly `{ reservation, rooms }`. Also test terminal correction requires `exceptionalCorrection: true` plus a non-empty `reason`, otherwise `INVALID_TRANSITION`.

- [ ] **Step 2: Run server transition tests and verify RED**

Run: `node --test tests/reservation-transitions.test.mjs`

Expected: FAIL because `service.transition` is not implemented.

- [ ] **Step 3: Implement transition guards and timestamp mapping**

Add these helpers to `_reservation-service.js`:

```js
const TIMESTAMP_FIELD = {
  'checked-in': 'checkedInAt', 'checked-out': 'checkedOutAt',
  cancelled: 'cancelledAt', 'no-show': 'noShowAt'
};

function assertTransition(reservation, toStatus, input, today) {
  const normal = ALLOWED[reservation.status]?.has(toStatus);
  const correction = TERMINAL.has(reservation.status) && input.exceptionalCorrection === true &&
    ['pending', 'confirmed', 'checked-in'].includes(toStatus) && String(input.reason || '').trim().length >= 8;
  if (!normal && !correction) throw new RequestError(400, 'INVALID_TRANSITION', 'Cambio stato non consentito.');
  if (toStatus === 'no-show' && today < reservation.checkin) {
    throw new RequestError(409, 'NO_SHOW_TOO_EARLY', 'Il no-show e disponibile dalla data di arrivo.');
  }
  if (toStatus === 'checked-in' && today < reservation.checkin && !input.confirmEarlyCheckIn) {
    throw new RequestError(409, 'EARLY_CHECK_IN_CONFIRMATION_REQUIRED', 'Conferma il check-in anticipato.');
  }
}
```

For check-in, rerun authoritative availability with the stored reservation excluded, require at least one room, require every room `active`, and collect dirty/in-progress rooms. Throw `ROOM_NOT_READY` with `conflicts: [{ roomId, number, housekeepingStatus }]` unless overridden. Missing guest/Alloggiati fields are response `warnings` only; use neutral text `Dati ospiti da completare` and do not claim legal compliance.

Run all transition work inside `repository.transaction(ownerId, async tx => ...)`: lock the owner-scoped reservation and assigned rooms, recheck, update status/timestamp, dirty rooms on check-out, then map the committed rows. Set `status_updated_at` for every transition. Clear no historical timestamp when an exceptional correction occurs.

- [ ] **Step 4: Dispatch transition without creating a route**

Insert this branch before ordinary PUT handling in `api/reservations.js`:

```js
if (req.method === 'PUT' && (req.query.action || req.body?.action) === 'transition') {
  const result = await service.transition(user.id, req.body?.reservationId, {
    toStatus: req.body?.toStatus,
    overrideRoomReadiness: req.body?.overrideRoomReadiness === true,
    confirmEarlyCheckIn: req.body?.confirmEarlyCheckIn === true,
    exceptionalCorrection: req.body?.exceptionalCorrection === true,
    reason: req.body?.reason
  });
  return res.status(200).json(result);
}
```

The public endpoint is `PUT /api/reservations?action=transition`; do not add `api/transitions.js` or any rewrite in `vercel.json`.

- [ ] **Step 5: Verify server transitions**

Run: `node --test tests/reservation-transitions.test.mjs tests/reservations-api.test.mjs`

Expected: PASS for the graph, guards, timestamps, transaction, and dirty-room response.

- [ ] **Step 6: Write the failing client atomic-commit test**

In `tests/reservation-actions.test.mjs`, load the IIFE with fake API, dialog, and store. Call `transition('booking-1', 'check-out')`; assert no state write occurs while the API promise is pending. Resolve `{ reservation: checkedOut, rooms: [dirty101, dirty102] }`; assert exactly one `setState` call named `reservation/transition-committed` replaces all three entities. Reject first with `ROOM_NOT_READY`, approve the confirmation, and assert the retry adds `overrideRoomReadiness: true`. Repeat for early check-in and `confirmEarlyCheckIn`.

- [ ] **Step 7: Implement `window.GroupStayReservationActions`**

Create an IIFE with `init`, `getValidActions`, and the required `transition(reservationId, transition)` method. Its action map is:

```js
const ACTION_TO_STATUS = {
  confirm: 'confirmed', 'check-in': 'checked-in', 'check-out': 'checked-out',
  cancel: 'cancelled', 'no-show': 'no-show'
};
const VALID_ACTIONS = {
  pending: ['confirm', 'cancel'], confirmed: ['check-in', 'cancel', 'no-show'],
  'checked-in': ['check-out'], 'checked-out': [], cancelled: [], 'no-show': []
};
```

Commit the API response in one store action, including the empty `rooms` case:

```js
async function transition(reservationId, transitionName) {
  const toStatus = ACTION_TO_STATUS[transitionName];
  if (!toStatus) throw new Error(`Unknown transition: ${transitionName}`);
  const commit = (extra = {}) => apiPut(`${apiBase}?action=transition`, {
    action: 'transition', reservationId, toStatus, ...extra
  });
  let result;
  try {
    result = await commit();
  } catch (error) {
    if (error.code === 'ROOM_NOT_READY' && await confirmRoomOverride(error.conflicts)) {
      result = await commit({ overrideRoomReadiness: true });
    } else if (error.code === 'EARLY_CHECK_IN_CONFIRMATION_REQUIRED' && await confirmEarlyArrival()) {
      result = await commit({ confirmEarlyCheckIn: true });
    } else throw error;
  }
  store.setState((state) => ({ ...state, data: { ...state.data,
    reservations: upsertById(state.data.reservations, result.reservation),
    rooms: result.rooms.reduce(upsertReducer, state.data.rooms)
  } }), 'reservation/transition-committed');
  return result.reservation;
}
```

Confirmation text names the rooms and their housekeeping state. Expose `correctTerminal(reservationId, toStatus, reason)` only from a visually separate correction menu; it sends `exceptionalCorrection: true` and refuses reasons shorter than eight characters.

Add the script before detail/Oggi features in `index.html` and initialize with `appStore`, `apiPut: GroupStayApi.apiPut`, the existing reservations URL, and `dialogController: GroupStayDialog.createDialogController(...)` from phase 02. Do not call `renderDashboard`, `renderReservations`, `refreshCalendar`, or `computeRoomStatuses`: subscribers consume the single committed state.

- [ ] **Step 8: Verify client actions, full transition slice, and commit**

Run: `node --test tests/reservation-actions.test.mjs tests/reservation-transitions.test.mjs tests/reservations-api.test.mjs`

Expected: PASS; check-out produces one client commit containing dirty rooms.

```bash
git add api/_reservation-service.js api/reservations.js js/features/reservation-actions.js index.html script.js tests/reservation-transitions.test.mjs tests/reservation-actions.test.mjs
git commit -m "feat: add reception lifecycle actions"
```

### Task 7: Make reservation detail the lifecycle action surface

**Files:**
- Modify: `index.html:1335-1355`
- Modify: `js/features/reservation-detail.js:1-220`
- Modify: `css/10-ux-overrides.css`
- Modify: `script.js:197-213,1817-1822`
- Create: `tests/reservation-detail.test.mjs`

- [ ] **Step 1: Write failing detail view-model and action tests**

Load the detail IIFE and call `buildDetailViewModel`. Assert pending exposes only `confirm,cancel`; confirmed before arrival exposes `check-in,cancel` but not `no-show`; confirmed on/after arrival exposes `no-show`; checked-in exposes only `check-out`; terminal statuses expose no normal action. Assert the Italian labels are `Opzione`, `Confermata`, `In casa`, `Partita`, `Cancellata`, `No-show`.

Create a model with two rooms and incomplete guests and assert it contains room number/service/housekeeping/readiness, assigned and missing guest counts, neutral warning `Dati ospiti da completare`, contact data, notes, and the existing group operational sections. Simulate clicking `[data-reservation-action='check-out']` and assert it calls `GroupStayReservationActions.transition(id, 'check-out')` once.

- [ ] **Step 2: Run the detail test and verify RED**

Run: `node --test tests/reservation-detail.test.mjs`

Expected: FAIL because the current detail has no pure model or canonical action delegation.

- [ ] **Step 3: Replace modal markup with an accessible side panel shell**

Use a backdrop and complementary panel, keeping the body ID for existing group tools:

```html
<div id='reservationDetailModal' class='detail-backdrop' hidden>
  <aside id='reservationDetailPanel' class='reservation-detail-panel' role='dialog'
    aria-modal='true' aria-labelledby='detailGroupName' tabindex='-1'>
    <header class='reservation-detail-header'>
      <div><p id='detailType' class='eyebrow'></p><h2 id='detailGroupName'></h2></div>
      <button type='button' class='icon-button' data-action='close-reservation-detail' aria-label='Chiudi dettagli'>×</button>
    </header>
    <div id='reservationDetailBody' class='reservation-detail-body'></div>
  </aside>
</div>
```

Desktop width is `min(760px, 70vw)`; at `max-width: 1024px` the panel fills the viewport. Add a sticky action footer, visible focus, and scrolling only on `.reservation-detail-body`.

- [ ] **Step 4: Build and render a safe, complete view model**

Export `STATUS_LABELS`, `buildDetailViewModel`, `renderReservationDetail`, and `openReservationDetail`. Derive action names from `GroupStayReservationActions.getValidActions(status)` and remove `no-show` when `today < checkin`. Derive assigned room records from `reservation.roomIds`, guests from matching `reservationId`, and readiness from service/housekeeping fields.

Render user values through text nodes or phase-01 `escapeHtml`; actions use semantic buttons with `data-reservation-action` and `data-reservation-id`. Keep organizer/contact, stay, rooms, guests/Alloggiati, notes/room notes, price/extras, meal plan, menus, files, and group assignment/print entry points. Mail content is absent. Use one delegated listener on the panel:

```js
panel.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-reservation-action]');
  if (!button) return;
  button.disabled = true;
  try {
    await reservationActions.transition(button.dataset.reservationId, button.dataset.reservationAction);
  } finally {
    button.disabled = false;
  }
});
```

After a committed transition, the store subscription rebuilds the open detail; it does not close and reopen the panel. Notes save waits for the server's `{ reservation }` and upserts that response, never mutating the stored object first.

- [ ] **Step 5: Add separated terminal correction and destructive areas**

Terminal records show a collapsed `Correggi stato` section after the normal content. Opening it explains that this is exceptional, requires a target and reason of eight characters, then calls `correctTerminal`. Delete remains in a separate danger section and requires the existing confirmation dialog. Neither control appears in the primary sticky actions.

- [ ] **Step 6: Verify and commit**

Run: `node --test tests/reservation-detail.test.mjs tests/reservation-actions.test.mjs`

Expected: PASS for every lifecycle state, date-gated no-show, room readiness, neutral guest warning, and delegated action.

```bash
git add index.html js/features/reservation-detail.js css/10-ux-overrides.css script.js tests/reservation-detail.test.mjs
git commit -m "feat: turn reservation detail into action panel"
```

### Task 8: Align Planning and Prenotazioni with canonical state

**Files:**
- Modify: `js/features/planner.js:1-260`
- Modify: `js/features/reservations-list.js:1-110`
- Modify: `index.html:490-545`
- Modify: `script.js:117-158,379-420`
- Create: `tests/booking-views.test.mjs`

- [ ] **Step 1: Write failing planner/list compatibility tests**

For Planning, assert a same-day turnover occupies distinct half-open days; cancelled/no-show/checked-out records create no blocking assignment; an expired option with assigned rooms is returned as `{ nonBlocking: true }` and is excluded from occupancy totals; an unassigned reservation is never silently placed in the first free room; maintenance and out-of-order rooms remain visible but marked unavailable.

For Prenotazioni, assert all six canonical statuses have the exact Italian label, `pending` expired before today has `isExpiredOption: true`, search includes ID/name/organizer/email/phone, and filtering supports every status without mutating source order.

```js
assert.deepEqual(planner.buildPlannerAssignments(input).byRoom.r1.map((entry) => entry.id), ['confirmed']);
assert.equal(planner.buildPlannerAssignments(input).unassigned[0].id, 'option-without-room');
assert.equal(list.STATUS_LABELS['checked-in'], 'In casa');
assert.equal(list.STATUS_LABELS['checked-out'], 'Partita');
```

- [ ] **Step 2: Run the compatibility test and verify RED**

Run: `node --test tests/booking-views.test.mjs`

Expected: FAIL because Planning treats every non-cancelled record as occupied, invents room placement, and list labels use raw status strings.

- [ ] **Step 3: Export a pure Planning assignment model**

Replace `getPlannerRoomBookings` internals with a pure export used by rendering:

```js
function buildPlannerAssignments({ rooms, reservations, guests, today }) {
  const byRoom = Object.fromEntries(rooms.map((room) => [room.id, []]));
  const unassigned = [];
  reservations.forEach((reservation) => {
    if (GroupStayBookingRules.TERMINAL.has(reservation.status)) return;
    const roomIds = reservation.roomIds?.length ? reservation.roomIds :
      [...new Set(guests.filter((g) => g.reservationId === reservation.id && g.roomId).map((g) => g.roomId))];
    const entry = { ...reservation,
      nonBlocking: !GroupStayBookingRules.blocksInventory(reservation, today) };
    if (!roomIds.length) return unassigned.push(entry);
    roomIds.forEach((roomId) => { if (byRoom[roomId]) byRoom[roomId].push(entry); });
  });
  return { byRoom, unassigned };
}
```

Use `entry.nonBlocking` for an outlined expired-option bar and exclude it from `dayOcc`. Add an `Opzioni senza camera` strip linked to reservation detail instead of pseudo-assigning inventory. Room headers display `Fuori servizio` for non-active rooms. Keep half-open `startIdx..endIdx` loops and all existing scroll/drag mechanics.

- [ ] **Step 4: Export a pure reservation list model**

Add these exact constants/helpers in `reservations-list.js`:

```js
const STATUS_LABELS = {
  pending: 'Opzione', confirmed: 'Confermata', 'checked-in': 'In casa',
  'checked-out': 'Partita', cancelled: 'Cancellata', 'no-show': 'No-show'
};
function buildReservationRows({ reservations, filter = 'all', search = '', today }) {
  const query = search.trim().toLocaleLowerCase('it');
  return reservations.filter((r) => filter === 'all' || r.status === filter)
    .filter((r) => !query || [r.id, r.groupName, r.organizer, r.email, r.phone]
      .some((value) => String(value || '').toLocaleLowerCase('it').includes(query)))
    .map((r) => ({ ...r, statusLabel: STATUS_LABELS[r.status],
      isExpiredOption: GroupStayBookingRules.isExpiredOption(r, today) }))
    .sort((a, b) => a.checkin.localeCompare(b.checkin) || a.groupName.localeCompare(b.groupName, 'it'));
}
```

Render semantic list buttons with `data-reservation-id`, text status labels, type, stay, guests, declared/assigned rooms, and an `Opzione scaduta` warning. Add filter controls for all six statuses. Use one delegated open-detail listener; do not inline lifecycle actions in list rows.

- [ ] **Step 5: Subscribe both views to store commits**

Planning subscribes to reservation and room selectors; Prenotazioni subscribes to reservations. A transition's single `reservation/transition-committed` state change rerenders each visible view once. Remove manual refresh calls left in their initialization adapters.

- [ ] **Step 6: Verify and commit**

Run: `node --test tests/booking-views.test.mjs tests/booking-rules.test.mjs tests/reservation-actions.test.mjs`

Expected: PASS; no terminal occupancy, phantom assignment, raw status label, or manual lifecycle state remains.

```bash
git add js/features/planner.js js/features/reservations-list.js index.html script.js tests/booking-views.test.mjs
git commit -m "feat: align booking views with lifecycle rules"
```

### Task 9: Prove the booking workflow and phase boundary

**Files:**
- Create: `tests/booking-workflow.test.mjs`
- Create: `tests/booking-phase-contract.test.mjs`

- [ ] **Step 1: Write the end-to-end module integration test**

Compose the real booking rules, fake reservation repository, reservation service, client action controller, and real store. Exercise: create confirmed reservation -> check-in -> check-out. Assert status timestamps are committed, the check-out response contains dirty rooms, and one client state action changes reservation plus rooms. Add a concurrent-looking conflict case by inserting another blocking reservation into the fake repository between client preflight and server write; assert the server returns `409 ROOM_AVAILABILITY_CONFLICT` and the store stays unchanged.

```js
assert.equal(actions.at(-1), 'reservation/transition-committed');
assert.equal(store.getState().data.reservations[0].status, 'checked-out');
assert.ok(store.getState().data.reservations[0].checkedOutAt);
assert.deepEqual(store.getState().data.rooms.map((room) => room.housekeepingStatus), ['dirty', 'dirty']);
```

- [ ] **Step 2: Write static phase contract tests**

`tests/booking-phase-contract.test.mjs` reads source files and asserts:

- exactly 11 public `api/*.js` files whose basename does not start with `_`;
- no `api/transitions.js`, `api/availability.js`, or rewrite to either path;
- `api/reservations.js` contains `action === 'transition'` and delegates to the private service;
- forms contain no terminal status `<option>` values;
- `group-reservation.js` reads declared room count and `individual-reservation.js` reads guest count;
- booking features do not assign `room.status` or optimistically call a reservation setter;
- `reservation-actions.js` contains the action name `reservation/transition-committed` exactly once.

- [ ] **Step 3: Run integration tests and verify RED, then fix only contract mismatches**

Run: `node --test tests/booking-workflow.test.mjs tests/booking-phase-contract.test.mjs`

Expected before final wiring: FAIL with the precise missing subscription, mapping, or route-count assertion. Adjust only the files introduced in Tasks 1-8 until both tests pass; do not weaken assertions.

- [ ] **Step 4: Run all focused booking tests**

Run:

```powershell
node --test tests/booking-rules.test.mjs tests/booking-rules-server.test.mjs tests/booking-lifecycle-migration.test.mjs tests/reservation-service.test.mjs tests/reservations-api.test.mjs tests/rooms-api.test.mjs tests/reservation-forms.test.mjs tests/reservation-transitions.test.mjs tests/reservation-actions.test.mjs tests/reservation-detail.test.mjs tests/booking-views.test.mjs tests/booking-workflow.test.mjs tests/booking-phase-contract.test.mjs
```

Expected: all listed tests PASS; zero failed, skipped, or cancelled.

- [ ] **Step 5: Run the complete repository gate**

Run: `npm.cmd test`

Expected: exit code `0`; all phase 01-03 and retained legacy suites pass.

Run: `rg -n "room\.status\s*=|status:\s*'available'|status:\s*'occupied'" js api tests --glob '!tests/fixtures/**'`

Expected: no matches in application code; fixture-only legacy normalization cases are excluded.

Run: `(Get-ChildItem api -File -Filter '*.js' | Where-Object Name -NotLike '_*').Count`

Expected: `11`.

Run: `git diff --check`

Expected: no output and exit code `0`.

- [ ] **Step 6: Commit the phase gate**

```bash
git add tests/booking-workflow.test.mjs tests/booking-phase-contract.test.mjs
git commit -m "test: cover reception booking lifecycle"
```

## Phase 03 exit criteria

- Browser and server produce the same booking-rule codes from the same fixtures.
- Create/update is owner-scoped and server-authoritative; conflicts use stable HTTP 409 details.
- Group and individual forms collect correct contact, guest, declared-room, option, and assignment data without optimistic mutation.
- All normal lifecycle actions and exceptional correction are guarded on the server.
- `GroupStayReservationActions.transition(reservationId, transition)` commits `{ reservation, rooms }` through one `reservation/transition-committed` store action.
- Check-out dirties every assigned room in the same server operation.
- Detail, Planning, and Prenotazioni consume canonical state and labels.
- No public serverless function was added; the public route count remains 11.

Phase 04 can now build Camere and Oggi on `serviceStatus`, `housekeepingStatus`, `GroupStayBookingRules`, and `GroupStayReservationActions` without compatibility guesses.
