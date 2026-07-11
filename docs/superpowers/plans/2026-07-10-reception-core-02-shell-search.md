# Reception Core Phase 02: Shell, Routing, and Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give GroupStay a single in-memory state contract, reliable hash navigation, a complete reception shell, dedicated settings, and fast client-side global search.

**Architecture:** This phase keeps the build-free vanilla JavaScript runtime and introduces focused IIFE modules with dependency injection. `appStore` is the authoritative event source for newly migrated views; the router owns URL state; the shell maps canonical Italian routes to legacy page renderers during the transition; pure search logic indexes only the already-loaded property dataset; reusable dialog and network controllers provide accessible interaction contracts.

**Tech Stack:** Vanilla JavaScript IIFEs, DOM APIs, Node.js built-in test runner, existing `GroupStayPreferences`, existing feature renderers, HTML/CSS.

**Prerequisites:** Complete Phase 01 first. It must provide `window.GroupStayPreferences` with `get(key, fallback)`, `set(key, value)`, and `snapshot()`; cookie-only authentication; no persistent operational-data cache; no Mail UI or routes; and the normalized `GroupStayApi.AppError` contract. Do not use `uncodixfy`. Do not create or rename any public file under `api/`; this phase must leave the public serverless route count unchanged.

---

## File and contract map

- `js/core/store.js` owns immutable top-level application state, selector subscriptions, reset behavior, and the global `window.appStore` instance.
- `js/core/router.js` owns canonical route metadata, hash parsing, history synchronization, fallback, and legacy page-to-route translation.
- `js/core/search.js` owns text normalization, index construction, deterministic ranking, grouping, and per-group limits; it never touches the DOM.
- `js/ui/dialog.js` owns dialog focus trapping, Escape handling, close reasons, and focus restoration.
- `js/ui/network-status.js` owns persistent offline/degraded presentation and retry signaling.
- `js/features/app-shell.js` owns page activation, active navigation state, the mobile `Altro` menu, and route renderer dispatch.
- `js/features/settings.js` owns the dedicated settings page and reads/writes only allowlisted preferences through `GroupStayPreferences`.
- `js/features/global-search.js` owns `Ctrl/Cmd+K`, search-panel DOM, result keyboard navigation, and entity opening.
- `script.js` remains the compatibility composition root: it mirrors legacy array setters into `appStore`, wires renderers, and starts/stops the shell.
- `index.html` contains semantic navigation, the settings page, search dialog, network banner, live regions, and deterministic script order.
- `css/14-reception-shell.css` contains only the structural shell/search/settings styles needed in this phase; Phase 05 will consolidate visual overrides.

### Task 1: Establish the global application store

**Files:**
- Create: `js/core/store.js`
- Create: `tests/store.test.mjs`
- Modify: `index.html:1823-1851` (load `store.js` after `preferences.js` and before feature modules)
- Modify: `script.js:40-420`, `script.js:480-575`, and logout/reset code around `script.js:800-815`

- [ ] **Step 1: Write the failing store tests**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadStore() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync('js/core/store.js', 'utf8'), context);
  return context.window;
}

test('the initial state never shares mutable arrays', () => {
  const { GroupStayStore } = loadStore();
  const first = GroupStayStore.createInitialState();
  const second = GroupStayStore.createInitialState();
  first.data.rooms.push({ id: 'r1' });
  assert.equal(second.data.rooms.length, 0);
});

test('selector subscribers run only when their selected value changes', () => {
  const { GroupStayStore } = loadStore();
  const store = GroupStayStore.createStore(GroupStayStore.createInitialState());
  const calls = [];
  const unsubscribe = store.subscribe(
    (state) => state.data.rooms,
    (next, previous, action) => calls.push({ next, previous, action })
  );

  store.setState((state) => ({
    ...state,
    ui: { ...state.ui, activeRoute: 'camere' }
  }), 'ui/route');
  assert.equal(calls.length, 0);

  const rooms = [{ id: 'r1' }];
  store.setState((state) => ({
    ...state,
    data: { ...state.data, rooms }
  }), 'rooms/loaded');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, 'rooms/loaded');
  assert.equal(calls[0].next, rooms);

  unsubscribe();
  store.setState((state) => ({
    ...state,
    data: { ...state.data, rooms: [] }
  }), 'rooms/cleared');
  assert.equal(calls.length, 1);
});

test('fireImmediately and custom equality are explicit subscription options', () => {
  const { GroupStayStore } = loadStore();
  const store = GroupStayStore.createStore(GroupStayStore.createInitialState());
  const counts = [];
  store.subscribe(
    (state) => ({ rooms: state.data.rooms.length, guests: state.data.guests.length }),
    (value, previous, action) => counts.push({ value, previous, action }),
    {
      fireImmediately: true,
      equality: (left, right) => left.rooms === right.rooms && left.guests === right.guests
    }
  );
  assert.deepEqual(counts[0].value, { rooms: 0, guests: 0 });
  assert.equal(counts[0].previous, undefined);
  assert.equal(counts[0].action, 'subscribe');
});

test('reset clears session, data, and transient UI with fresh references', () => {
  const { GroupStayStore } = loadStore();
  const store = GroupStayStore.createStore(GroupStayStore.createInitialState());
  store.setState((state) => ({
    ...state,
    session: { status: 'authenticated', user: { id: 'u1' } },
    data: { ...state.data, guests: [{ id: 'g1' }] },
    ui: { ...state.ui, activeRoute: 'ospiti', dataStatus: 'ready' }
  }), 'test/seed');
  const oldGuests = store.getState().data.guests;

  store.reset('session/logout');

  assert.equal(store.getState().session.status, 'anonymous');
  assert.equal(store.getState().data.guests.length, 0);
  assert.equal(store.getState().ui.activeRoute, 'oggi');
  assert.notEqual(store.getState().data.guests, oldGuests);
});

test('the browser module exposes one shared appStore instance', () => {
  const { appStore } = loadStore();
  assert.equal(typeof appStore.getState, 'function');
  assert.equal(typeof appStore.setState, 'function');
  assert.equal(typeof appStore.subscribe, 'function');
  assert.equal(typeof appStore.reset, 'function');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/store.test.mjs`

Expected: FAIL with `ENOENT: no such file or directory, open 'js/core/store.js'`.

- [ ] **Step 3: Implement the store contract**

```js
(function initStore(global) {
  'use strict';

  function createInitialState(overrides = {}) {
    const session = {
      status: 'anonymous',
      user: null,
      ...(overrides.session || {})
    };
    const data = {
      reservations: [],
      rooms: [],
      guests: [],
      employees: [],
      workEntries: [],
      monthPayOverrides: [],
      employeeAdvances: [],
      complianceCerts: [],
      complianceDocs: [],
      agendaItems: [],
      ...(overrides.data || {})
    };
    const ui = {
      activeRoute: 'oggi',
      dataStatus: 'idle',
      networkStatus: 'online',
      ...(overrides.ui || {})
    };
    return { session, data, ui };
  }

  function createStore(initialState = createInitialState()) {
    let state = initialState;
    const subscriptions = new Set();

    function getState() {
      return state;
    }

    function setState(update, actionName = 'anonymous') {
      const candidate = typeof update === 'function' ? update(state) : update;
      if (!candidate || typeof candidate !== 'object') {
        throw new TypeError('appStore.setState requires an object or updater function');
      }
      const nextState = candidate === state ? state : { ...state, ...candidate };
      if (Object.is(nextState, state)) return state;

      const previousState = state;
      state = nextState;
      subscriptions.forEach((subscription) => {
        const nextSelected = subscription.selector(state);
        if (subscription.equality(nextSelected, subscription.selected)) return;
        const previousSelected = subscription.selected;
        subscription.selected = nextSelected;
        subscription.listener(nextSelected, previousSelected, actionName, state, previousState);
      });
      return state;
    }

    function subscribe(selector, listener, options = {}) {
      if (typeof selector !== 'function' || typeof listener !== 'function') {
        throw new TypeError('appStore.subscribe requires selector and listener functions');
      }
      const subscription = {
        selector,
        listener,
        equality: options.equality || Object.is,
        selected: selector(state)
      };
      subscriptions.add(subscription);
      if (options.fireImmediately) {
        listener(subscription.selected, undefined, 'subscribe', state, undefined);
      }
      return () => subscriptions.delete(subscription);
    }

    function reset(actionName = 'store/reset') {
      return setState(createInitialState(), actionName);
    }

    return { getState, setState, subscribe, reset };
  }

  const GroupStayStore = { createInitialState, createStore };
  global.GroupStayStore = GroupStayStore;
  global.appStore = createStore(createInitialState());
})(window);
```

- [ ] **Step 4: Load the store before every consumer**

Use this exact order in `index.html` after Phase 01's preference module:

```html
<script src="js/core/preferences.js"></script>
<script src="js/core/store.js"></script>
<script src="js/core/router.js"></script>
<script src="js/core/search.js"></script>
```

At this step `router.js` and `search.js` are added by later tasks, so add only the `store.js` tag now and preserve this final order when those files exist.

- [ ] **Step 5: Mirror legacy state changes through narrow compatibility helpers**

Add these helpers immediately after the legacy state declarations in `script.js`:

```js
function replaceCoreDataSlice(key, value, actionName) {
  const nextValue = Array.isArray(value) ? value : [];
  if (key === 'reservations') reservations = nextValue;
  if (key === 'rooms') rooms = nextValue;
  if (key === 'guests') guests = nextValue;
  appStore.setState((state) => ({
    ...state,
    data: { ...state.data, [key]: nextValue }
  }), actionName);
}

function commitLoadedState(actionName = 'data/loaded') {
  appStore.setState((state) => ({
    ...state,
    session: { status: currentUser ? 'authenticated' : 'anonymous', user: currentUser },
    data: {
      ...state.data,
      reservations,
      rooms,
      guests,
      employees,
      workEntries,
      monthPayOverrides,
      employeeAdvances,
      complianceCerts,
      complianceDocs,
      agendaItems
    },
    ui: { ...state.ui, dataStatus: 'ready' }
  }), actionName);
}
```

Replace every dependency setter in the composition block with these exact forms:

```js
setReservations: (nextReservations) => replaceCoreDataSlice('reservations', nextReservations, 'reservations/changed'),
setRooms: (nextRooms) => replaceCoreDataSlice('rooms', nextRooms, 'rooms/changed'),
setGuests: (nextGuests) => replaceCoreDataSlice('guests', nextGuests, 'guests/changed'),
```

After the arrays are assigned in `loadAllData()`, call `commitLoadedState('data/loaded')`. Before the requests begin, set `ui.dataStatus` to `loading`; in the catch branch set it to `error` while preserving form data:

```js
appStore.setState((state) => ({
  ...state,
  ui: { ...state.ui, dataStatus: 'loading' }
}), 'data/loading');
```

On logout, replace the individual data-array store writes with `appStore.reset('session/logout')` after clearing the legacy in-memory arrays. Do not persist the store or subscribe it to `localStorage`.

- [ ] **Step 6: Run the focused and existing unit suites**

Run: `node --test tests/store.test.mjs`

Expected: 5 tests PASS.

Run: `npm.cmd test`

Expected: all tests PASS; no existing feature loses its legacy getter/setter behavior.

- [ ] **Step 7: Commit the store slice**

```bash
git add js/core/store.js tests/store.test.mjs index.html script.js
git commit -m 'feat: add reception application store'
```

### Task 2: Add canonical hash routing

**Files:**
- Create: `js/core/router.js`
- Create: `tests/router.test.mjs`
- Modify: `index.html` (load `router.js` immediately after `store.js`)

- [ ] **Step 1: Write failing parsing, mapping, and history tests**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadRouter() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync('js/core/router.js', 'utf8'), context);
  return context.window.GroupStayRouter;
}

function createWindow(hash = '') {
  const listeners = new Map();
  const location = { hash };
  const history = {
    calls: [],
    replaceState(_state, _title, nextHash) {
      this.calls.push(nextHash);
      location.hash = nextHash;
    }
  };
  return {
    location,
    history,
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    dispatch(type) { listeners.get(type)?.(); }
  };
}

test('parses only known canonical Italian hashes', () => {
  const router = loadRouter();
  assert.equal(router.parseHash('#/oggi'), 'oggi');
  assert.equal(router.parseHash('#/planning/'), 'planning');
  assert.equal(router.parseHash('#/PRENOTAZIONI'), 'prenotazioni');
  assert.equal(router.parseHash('#/unknown'), null);
  assert.equal(router.parseHash(''), null);
});

test('maps every legacy page name to its canonical route', () => {
  const router = loadRouter();
  assert.equal(router.routeForLegacyPage('dashboard'), 'oggi');
  assert.equal(router.routeForLegacyPage('calendar'), 'planning');
  assert.equal(router.routeForLegacyPage('reservations'), 'prenotazioni');
  assert.equal(router.routeForLegacyPage('guests'), 'ospiti');
  assert.equal(router.routeForLegacyPage('rooms'), 'camere');
  assert.equal(router.routeForLegacyPage('management'), 'gestione');
  assert.equal(router.routeForLegacyPage('compliance'), 'sicurezza');
  assert.equal(router.routeForLegacyPage('settings'), 'impostazioni');
});

test('unknown and empty hashes are replaced with oggi and rendered once', () => {
  const GroupStayRouter = loadRouter();
  const windowRef = createWindow('#/missing');
  const calls = [];
  const router = GroupStayRouter.createRouter({
    windowRef,
    onRoute(route, config) { calls.push({ route, pageId: config.pageId }); }
  });
  router.start();
  assert.equal(windowRef.location.hash, '#/oggi');
  assert.deepEqual(windowRef.history.calls, ['#/oggi']);
  assert.deepEqual(calls, [{ route: 'oggi', pageId: 'page-dashboard' }]);
  assert.equal(router.current(), 'oggi');
});

test('navigate writes the hash and hashchange restores the correct route', () => {
  const GroupStayRouter = loadRouter();
  const windowRef = createWindow('#/oggi');
  const calls = [];
  const router = GroupStayRouter.createRouter({ windowRef, onRoute: (route) => calls.push(route) });
  router.start();
  router.navigate('camere');
  assert.equal(windowRef.location.hash, '#/camere');
  windowRef.dispatch('hashchange');
  assert.deepEqual(calls, ['oggi', 'camere']);
});

test('replace navigation renders immediately and stop removes synchronization', () => {
  const GroupStayRouter = loadRouter();
  const windowRef = createWindow('#/oggi');
  const calls = [];
  const router = GroupStayRouter.createRouter({ windowRef, onRoute: (route) => calls.push(route) });
  router.start();
  router.navigate('impostazioni', { replace: true });
  assert.equal(windowRef.location.hash, '#/impostazioni');
  assert.deepEqual(calls, ['oggi', 'impostazioni']);
  router.stop();
  windowRef.location.hash = '#/camere';
  windowRef.dispatch('hashchange');
  assert.deepEqual(calls, ['oggi', 'impostazioni']);
});
```

- [ ] **Step 2: Run the router test and verify RED**

Run: `node --test tests/router.test.mjs`

Expected: FAIL because `js/core/router.js` does not exist.

- [ ] **Step 3: Implement route metadata and hash helpers**

Create `js/core/router.js` with this complete module:

```js
(function initRouter(global) {
  'use strict';

  const DEFAULT_ROUTE = 'oggi';
  const ROUTES = Object.freeze({
    oggi: Object.freeze({ route: 'oggi', pageId: 'page-dashboard', legacyPage: 'dashboard', group: 'primary' }),
    planning: Object.freeze({ route: 'planning', pageId: 'page-calendar', legacyPage: 'calendar', group: 'primary' }),
    prenotazioni: Object.freeze({ route: 'prenotazioni', pageId: 'page-reservations', legacyPage: 'reservations', group: 'primary' }),
    ospiti: Object.freeze({ route: 'ospiti', pageId: 'page-guests', legacyPage: 'guests', group: 'primary' }),
    camere: Object.freeze({ route: 'camere', pageId: 'page-rooms', legacyPage: 'rooms', group: 'primary' }),
    gestione: Object.freeze({ route: 'gestione', pageId: 'page-management', legacyPage: 'management', group: 'secondary' }),
    sicurezza: Object.freeze({ route: 'sicurezza', pageId: 'page-compliance', legacyPage: 'compliance', group: 'secondary' }),
    impostazioni: Object.freeze({ route: 'impostazioni', pageId: 'page-settings', legacyPage: 'settings', group: 'secondary' })
  });

  const LEGACY_PAGE_TO_ROUTE = Object.freeze(Object.values(ROUTES).reduce((result, config) => {
    result[config.legacyPage] = config.route;
    return result;
  }, {}));

  function parseHash(hash) {
    const value = String(hash || '').replace(/^#\/?/, '').replace(/\/+$/, '').trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(ROUTES, value) ? value : null;
  }

  function routeForLegacyPage(page) {
    return LEGACY_PAGE_TO_ROUTE[String(page || '').toLowerCase()] || null;
  }

  function hashForRoute(route) {
    if (!ROUTES[route]) throw new RangeError(`Unknown route: ${route}`);
    return `#/${route}`;
  }

  function createRouter({ windowRef = global, onRoute = () => {}, fallback = DEFAULT_ROUTE } = {}) {
    if (!ROUTES[fallback]) throw new RangeError(`Unknown fallback route: ${fallback}`);
    let started = false;
    let activeRoute = null;

    function syncFromLocation() {
      let route = parseHash(windowRef.location.hash);
      if (!route) {
        route = fallback;
        windowRef.history.replaceState(null, '', hashForRoute(route));
      }
      activeRoute = route;
      onRoute(route, ROUTES[route]);
      return route;
    }

    function navigate(route, { replace = false } = {}) {
      if (!ROUTES[route]) throw new RangeError(`Unknown route: ${route}`);
      const nextHash = hashForRoute(route);
      if (replace) {
        windowRef.history.replaceState(null, '', nextHash);
        return syncFromLocation();
      }
      if (windowRef.location.hash === nextHash) return syncFromLocation();
      windowRef.location.hash = nextHash;
      return route;
    }

    function start() {
      if (started) return activeRoute;
      started = true;
      windowRef.addEventListener('hashchange', syncFromLocation);
      return syncFromLocation();
    }

    function stop() {
      if (!started) return;
      windowRef.removeEventListener('hashchange', syncFromLocation);
      started = false;
    }

    return {
      start,
      stop,
      navigate,
      current: () => activeRoute,
      sync: syncFromLocation
    };
  }

  global.GroupStayRouter = {
    DEFAULT_ROUTE,
    ROUTES,
    createRouter,
    hashForRoute,
    parseHash,
    routeForLegacyPage
  };
})(window);
```

- [ ] **Step 4: Load the router immediately after the store**

```html
<script src='js/core/preferences.js'></script>
<script src='js/core/store.js'></script>
<script src='js/core/router.js'></script>
```

- [ ] **Step 5: Run tests and commit the independent router**

Run: `node --test tests/router.test.mjs`

Expected: 5 tests PASS.

Run: `node --test tests/store.test.mjs tests/router.test.mjs`

Expected: 10 tests PASS.

```bash
git add js/core/router.js tests/router.test.mjs index.html
git commit -m 'feat: add canonical hash router'
```

### Task 3: Replace ad-hoc navigation with the reception shell and settings page

**Files:**
- Create: `js/features/app-shell.js`
- Create: `js/features/settings.js`
- Create: `css/14-reception-shell.css`
- Create: `tests/app-shell.test.mjs`
- Create: `tests/shell-contract.test.mjs`
- Modify: `index.html` navigation, settings markup, and script order
- Modify: `script.js` navigation, settings adapters, startup, and logout

- [ ] **Step 1: Write the failing shell behavior test**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function element(id, route = null) {
  const attributes = new Map();
  return {
    id,
    dataset: route ? { route } : {},
    hidden: false,
    classList: {
      values: new Set(),
      add(value) { this.values.add(value); },
      remove(value) { this.values.delete(value); },
      toggle(value, force) { force ? this.values.add(value) : this.values.delete(value); }
    },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    removeAttribute(name) { attributes.delete(name); },
    getAttribute(name) { return attributes.get(name) || null; }
  };
}

function loadShell(documentRef) {
  const context = { window: { document: documentRef }, document: documentRef };
  vm.runInNewContext(fs.readFileSync('js/features/app-shell.js', 'utf8'), context);
  return context.window.GroupStayAppShell;
}

test('activation reveals one page, syncs nav, commits the route, and renders once', () => {
  const pages = [element('page-dashboard'), element('page-rooms')];
  const nav = [element('nav-oggi', 'oggi'), element('nav-camere', 'camere')];
  const mobileMore = element('mobileMoreMenu');
  mobileMore.hidden = false;
  const documentRef = {
    body: { dataset: {} },
    getElementById(id) {
      return [...pages, mobileMore].find((entry) => entry.id === id) || null;
    },
    querySelectorAll(selector) {
      if (selector === '.page') return pages;
      if (selector === '[data-route]') return nav;
      return [];
    }
  };
  const actions = [];
  const store = {
    setState(updater, action) {
      actions.push(action);
      this.state = updater(this.state || { ui: { activeRoute: 'oggi' } });
    }
  };
  let rendered = 0;
  const shell = loadShell(documentRef).createAppShell({
    documentRef,
    store,
    mainContent: { scrollTo() {} },
    renderers: { camere: () => { rendered += 1; } }
  });
  shell.activateRoute('camere', { pageId: 'page-rooms' });
  assert.equal(pages[0].hidden, true);
  assert.equal(pages[1].hidden, false);
  assert.equal(nav[0].getAttribute('aria-current'), null);
  assert.equal(nav[1].getAttribute('aria-current'), 'page');
  assert.equal(mobileMore.hidden, true);
  assert.equal(documentRef.body.dataset.activeRoute, 'camere');
  assert.equal(actions.at(-1), 'ui/route');
  assert.equal(rendered, 1);
});
```

- [ ] **Step 2: Write the failing semantic shell contract**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync('index.html', 'utf8');

test('desktop navigation exposes every canonical route in product order', () => {
  const routes = ['oggi', 'planning', 'prenotazioni', 'ospiti', 'camere', 'gestione', 'sicurezza', 'impostazioni'];
  const positions = routes.map((route) => html.indexOf(`href='#/${route}'`));
  positions.forEach((position) => assert.notEqual(position, -1));
  for (let index = 1; index < positions.length; index += 1) {
    assert.ok(positions[index] > positions[index - 1]);
  }
});

test('mobile navigation has four direct routes and an Altro menu', () => {
  const direct = html.match(/class='tab-item mobile-primary-route'/g) || [];
  assert.equal(direct.length, 4);
  assert.match(html, /id='mobileMoreToggle'/);
  assert.match(html, /id='mobileMoreMenu'/);
  assert.match(html, /href='#\/ospiti'/);
});

test('settings is a page, not a modal', () => {
  assert.match(html, /<section class='page settings-page' id='page-settings'/);
  assert.doesNotMatch(html, /id='settingsModal'/);
  assert.match(html, /id='settingsPreferencesForm'/);
  assert.match(html, /id='managementPinForm'/);
  assert.match(html, /Il PIN e un blocco privacy locale, non un'autorizzazione/);
});

test('shell modules load after the router and before the compatibility script', () => {
  const router = html.indexOf('js/core/router.js');
  const shell = html.indexOf('js/features/app-shell.js');
  const settings = html.indexOf('js/features/settings.js');
  const main = html.indexOf('script.js');
  assert.ok(router >= 0 && router < shell && shell < settings && settings < main);
});
```

- [ ] **Step 3: Run both tests and verify RED**

Run: `node --test tests/app-shell.test.mjs tests/shell-contract.test.mjs`

Expected: FAIL because the feature modules and canonical shell markup do not exist.

- [ ] **Step 4: Implement the shell controller**

```js
(function initAppShell(global) {
  'use strict';

  const MOBILE_DIRECT_ROUTES = new Set(['oggi', 'planning', 'prenotazioni', 'camere']);

  function createAppShell({
    documentRef = global.document,
    store,
    renderers = {},
    mainContent = documentRef.getElementById('mainContent')
  } = {}) {
    let initialized = false;

    function closeMobileMore() {
      const menu = documentRef.getElementById('mobileMoreMenu');
      const toggle = documentRef.getElementById('mobileMoreToggle');
      if (menu) menu.hidden = true;
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }

    function toggleMobileMore() {
      const menu = documentRef.getElementById('mobileMoreMenu');
      const toggle = documentRef.getElementById('mobileMoreToggle');
      if (!menu || !toggle) return;
      menu.hidden = !menu.hidden;
      toggle.setAttribute('aria-expanded', String(!menu.hidden));
      if (!menu.hidden) menu.querySelector('a')?.focus();
    }

    function activateRoute(route, config) {
      const page = documentRef.getElementById(config.pageId);
      if (!page) throw new Error(`Missing page element: ${config.pageId}`);

      documentRef.querySelectorAll('.page').forEach((candidate) => {
        const active = candidate === page;
        candidate.hidden = !active;
        candidate.classList.toggle('active', active);
      });
      documentRef.querySelectorAll('[data-route]').forEach((link) => {
        const active = link.dataset.route === route;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      });

      const moreToggle = documentRef.getElementById('mobileMoreToggle');
      const routeIsInMore = !MOBILE_DIRECT_ROUTES.has(route);
      moreToggle?.classList.toggle('active', routeIsInMore);
      if (routeIsInMore) moreToggle?.setAttribute('aria-current', 'page');
      else moreToggle?.removeAttribute('aria-current');
      closeMobileMore();

      documentRef.body.dataset.activeRoute = route;
      store.setState((state) => ({
        ...state,
        ui: { ...state.ui, activeRoute: route }
      }), 'ui/route');
      renderers[route]?.();
      mainContent?.scrollTo({ top: 0, behavior: 'auto' });
      return route;
    }

    function onClick(event) {
      if (event.target.closest('#mobileMoreToggle')) {
        toggleMobileMore();
        return;
      }
      if (event.target.closest('[data-action=close-mobile-more]')) closeMobileMore();
    }

    function init() {
      if (initialized) return;
      initialized = true;
      documentRef.addEventListener('click', onClick);
    }

    function destroy() {
      if (!initialized) return;
      documentRef.removeEventListener('click', onClick);
      initialized = false;
      closeMobileMore();
    }

    return { init, destroy, activateRoute, closeMobileMore, toggleMobileMore };
  }

  global.GroupStayAppShell = { MOBILE_DIRECT_ROUTES, createAppShell };
})(window);
```

- [ ] **Step 5: Replace desktop and mobile navigation with canonical links**

Replace the current sidebar navigation, mobile tab bar, and `mobileMoreModal` with this exact structure. Keep the existing logo SVG inside `sidebar-header`; the omitted logo is not part of the replaced range.

```html
<nav class='sidebar-nav' aria-label='Navigazione principale'>
  <p class='nav-group-label'>Reception</p>
  <a class='nav-item active' href='#/oggi' data-route='oggi'>
    <span>Oggi</span>
  </a>
  <a class='nav-item' href='#/planning' data-route='planning'>
    <span>Planning</span>
  </a>
  <a class='nav-item' href='#/prenotazioni' data-route='prenotazioni'>
    <span>Prenotazioni</span>
  </a>
  <a class='nav-item' href='#/ospiti' data-route='ospiti'>
    <span>Ospiti</span>
  </a>
  <a class='nav-item' href='#/camere' data-route='camere'>
    <span>Camere</span>
  </a>

  <p class='nav-group-label'>Struttura</p>
  <a class='nav-item' href='#/gestione' data-route='gestione'>
    <span>Gestione</span>
  </a>
  <a class='nav-item' href='#/sicurezza' data-route='sicurezza'>
    <span>Sicurezza</span>
  </a>
  <a class='nav-item' href='#/impostazioni' data-route='impostazioni'>
    <span>Impostazioni</span>
  </a>
</nav>
<div class='sidebar-footer'>
  <button class='settings-btn' type='button' data-action='logout'>
    <span>Esci</span>
  </button>
  <div class='sidebar-profile'>
    <div class='profile-info'>
      <span class='profile-name' id='profileName'>Reception</span>
      <span class='profile-role' id='profileRole'></span>
    </div>
  </div>
</div>
```

Use four direct mobile destinations; Ospiti and every secondary section remain one additional tap away:

```html
<nav class='mobile-tab-bar' id='mobileTabBar' aria-label='Navigazione mobile'>
  <a class='tab-item mobile-primary-route active' href='#/oggi' data-route='oggi'>
    <span>Oggi</span>
  </a>
  <a class='tab-item mobile-primary-route' href='#/planning' data-route='planning'>
    <span>Planning</span>
  </a>
  <a class='tab-item mobile-primary-route' href='#/prenotazioni' data-route='prenotazioni'>
    <span>Prenotazioni</span>
  </a>
  <a class='tab-item mobile-primary-route' href='#/camere' data-route='camere'>
    <span>Camere</span>
  </a>
  <button class='tab-item' id='mobileMoreToggle' type='button'
          aria-controls='mobileMoreMenu' aria-expanded='false'>
    <span>Altro</span>
  </button>
</nav>

<div class='mobile-more-backdrop' id='mobileMoreMenu' role='dialog'
     aria-modal='true' aria-labelledby='mobileMoreTitle' hidden>
  <div class='mobile-more-sheet'>
    <div class='mobile-more-header'>
      <h2 id='mobileMoreTitle'>Altro</h2>
      <button type='button' data-action='close-mobile-more' aria-label='Chiudi menu'>Chiudi</button>
    </div>
    <nav class='mobile-more-links' aria-label='Altre sezioni'>
      <a href='#/ospiti' data-route='ospiti'>Ospiti</a>
      <a href='#/gestione' data-route='gestione'>Gestione</a>
      <a href='#/sicurezza' data-route='sicurezza'>Sicurezza</a>
      <a href='#/impostazioni' data-route='impostazioni'>Impostazioni</a>
    </nav>
    <button class='mobile-more-logout' type='button' data-action='logout'>Esci</button>
  </div>
</div>
```

Do not retain `data-page`, `href='#'`, Mail destinations, or a settings-modal launcher in these ranges.

- [ ] **Step 6: Replace the settings modal with a dedicated page**

Delete the complete `settingsModal` overlay and add this section as the last child of `mainContent`, after `page-management`:

```html
<section class='page settings-page' id='page-settings'
         aria-labelledby='settingsPageTitle' hidden>
  <header class='page-header'>
    <div class='page-heading'>
      <p class='page-eyebrow'>Struttura</p>
      <h1 class='page-title' id='settingsPageTitle'>Impostazioni</h1>
      <p class='page-subtitle'>Preferenze di visualizzazione e accesso su questo account.</p>
    </div>
  </header>

  <div class='settings-layout'>
    <form class='settings-panel' id='settingsPreferencesForm'>
      <div class='settings-panel-heading'>
        <h2>Preferenze interfaccia</h2>
        <p>Queste preferenze non contengono dati operativi o credenziali.</p>
      </div>

      <fieldset class='settings-fieldset'>
        <legend>Lingua</legend>
        <label><input type='radio' name='settingsLanguage' value='it'> Italiano</label>
        <label><input type='radio' name='settingsLanguage' value='en'> English</label>
      </fieldset>

      <div class='settings-field'>
        <label for='settingColWidth'>Larghezza giorni nel planning</label>
        <div class='settings-range'>
          <input type='range' id='settingColWidth' name='plannerColumnWidth'
                 min='24' max='60' step='1'>
          <output id='settingColWidthVal' for='settingColWidth'></output>
        </div>
      </div>

      <div class='settings-field'>
        <label for='settingRowHeight'>Altezza righe nel planning</label>
        <div class='settings-range'>
          <input type='range' id='settingRowHeight' name='plannerRowHeight'
                 min='20' max='50' step='1'>
          <output id='settingRowHeightVal' for='settingRowHeight'></output>
        </div>
      </div>

      <fieldset class='settings-fieldset'>
        <legend>Piani camere</legend>
        <p>Definisce l'intervallo proposto nei moduli camera.</p>
        <div class='settings-floor-grid'>
          <label for='settingFloorStart'>Piano iniziale</label>
          <input type='number' id='settingFloorStart' name='floorStart' min='-5' max='100'>
          <label for='settingFloorEnd'>Piano finale</label>
          <input type='number' id='settingFloorEnd' name='floorEnd' min='-5' max='100'>
        </div>
      </fieldset>

      <p class='form-message' id='settingsPreferencesMessage' role='status' aria-live='polite'></p>
      <button class='btn btn-primary' type='submit'>Salva preferenze</button>
    </form>

    <form class='settings-panel' id='managementPinForm'>
      <div class='settings-panel-heading'>
        <h2>Blocco privacy Gestione</h2>
        <p>Il PIN e un blocco privacy locale, non un'autorizzazione. I ruoli server saranno introdotti in una fase backend.</p>
      </div>
      <label for='settingEmpPin'>PIN di 4 cifre</label>
      <input type='password' id='settingEmpPin' name='managementPin'
             maxlength='4' inputmode='numeric' pattern='[0-9]{4}'
             autocomplete='off'>
      <p class='form-message' id='managementPinMessage' role='status' aria-live='polite'></p>
      <div class='settings-actions'>
        <button class='btn btn-primary' type='submit'>Salva PIN</button>
        <button class='btn btn-secondary' type='button' data-action='remove-management-pin'>Rimuovi PIN</button>
      </div>
    </form>

    <section class='settings-panel' aria-labelledby='accountSettingsTitle'>
      <div class='settings-panel-heading'>
        <h2 id='accountSettingsTitle'>Account</h2>
        <p>Termina la sessione su questo dispositivo.</p>
      </div>
      <button class='btn btn-danger' type='button' data-action='logout'>Esci</button>
    </section>
  </div>
</section>
```

- [ ] **Step 7: Implement the settings-page controller**

```js
(function initSettingsFeature(global) {
  'use strict';

  let deps = null;
  let root = null;
  let bound = false;

  function writeMessage(id, message, type = 'success') {
    const element = root.querySelector(`#${id}`);
    element.textContent = message;
    element.dataset.type = type;
  }

  function render() {
    const language = deps.preferences.get('language', 'it');
    const languageInput = root.querySelector(`input[name=settingsLanguage][value=${language}]`);
    if (languageInput) languageInput.checked = true;

    const columnWidth = deps.preferences.get('plannerColumnWidth', 38);
    const rowHeight = deps.preferences.get('plannerRowHeight', 34);
    const floorStart = deps.preferences.get('floorStart', 1);
    const floorEnd = deps.preferences.get('floorEnd', 5);
    root.querySelector('#settingColWidth').value = String(columnWidth);
    root.querySelector('#settingColWidthVal').textContent = `${columnWidth}px`;
    root.querySelector('#settingRowHeight').value = String(rowHeight);
    root.querySelector('#settingRowHeightVal').textContent = `${rowHeight}px`;
    root.querySelector('#settingFloorStart').value = String(floorStart);
    root.querySelector('#settingFloorEnd').value = String(floorEnd);
  }

  function onInput(event) {
    if (event.target.id === 'settingColWidth') {
      root.querySelector('#settingColWidthVal').textContent = `${event.target.value}px`;
    }
    if (event.target.id === 'settingRowHeight') {
      root.querySelector('#settingRowHeightVal').textContent = `${event.target.value}px`;
    }
  }

  async function savePreferences(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const language = new FormData(form).get('settingsLanguage') || 'it';
    const plannerColumnWidth = Number(form.elements.plannerColumnWidth.value);
    const plannerRowHeight = Number(form.elements.plannerRowHeight.value);
    const floorStart = Number(form.elements.floorStart.value);
    const floorEnd = Number(form.elements.floorEnd.value);
    if (!Number.isInteger(floorStart) || !Number.isInteger(floorEnd) || floorStart > floorEnd) {
      writeMessage('settingsPreferencesMessage', 'Il piano iniziale deve essere minore o uguale al piano finale.', 'error');
      return;
    }

    deps.preferences.set('language', language);
    deps.preferences.set('plannerColumnWidth', plannerColumnWidth);
    deps.preferences.set('plannerRowHeight', plannerRowHeight);
    deps.preferences.set('floorStart', floorStart);
    deps.preferences.set('floorEnd', floorEnd);
    deps.setLanguage(language);
    deps.applyPlannerSize({ columnWidth: plannerColumnWidth, rowHeight: plannerRowHeight });
    deps.applyFloorRange({ floorStart, floorEnd });
    writeMessage('settingsPreferencesMessage', 'Preferenze salvate.');
  }

  async function savePin(event) {
    event.preventDefault();
    const pin = event.currentTarget.elements.managementPin.value.trim();
    if (!/^\d{4}$/.test(pin)) {
      writeMessage('managementPinMessage', 'Inserisci esattamente 4 cifre.', 'error');
      return;
    }
    try {
      await deps.saveManagementPin(pin);
      event.currentTarget.reset();
      writeMessage('managementPinMessage', 'PIN salvato.');
    } catch (error) {
      writeMessage('managementPinMessage', error.message || 'Impossibile salvare il PIN.', 'error');
    }
  }

  async function removePin() {
    try {
      await deps.removeManagementPin();
      root.querySelector('#managementPinForm').reset();
      writeMessage('managementPinMessage', 'PIN rimosso.');
    } catch (error) {
      writeMessage('managementPinMessage', error.message || 'Impossibile rimuovere il PIN.', 'error');
    }
  }

  function onClick(event) {
    if (event.target.closest('[data-action=remove-management-pin]')) removePin();
    if (event.target.closest('[data-action=logout]')) deps.logout();
  }

  function init(nextDeps) {
    deps = nextDeps;
    root = deps.documentRef.getElementById('page-settings');
    if (!root || bound) return;
    bound = true;
    root.addEventListener('input', onInput);
    root.addEventListener('click', onClick);
    root.querySelector('#settingsPreferencesForm').addEventListener('submit', savePreferences);
    root.querySelector('#managementPinForm').addEventListener('submit', savePin);
    render();
  }

  function destroy() {
    if (!bound) return;
    root.removeEventListener('input', onInput);
    root.removeEventListener('click', onClick);
    root.querySelector('#settingsPreferencesForm').removeEventListener('submit', savePreferences);
    root.querySelector('#managementPinForm').removeEventListener('submit', savePin);
    bound = false;
  }

  global.GroupStaySettings = { init, destroy, render };
})(window);
```

- [ ] **Step 8: Wire settings, route renderers, and compatibility navigation**

Replace the old local-storage settings block with allowlisted preference adapters:

```js
let PLANNER_ROW_HEIGHT = Number(GroupStayPreferences.get('plannerRowHeight', 34));

function getRoomFloorRange() {
  return normalizeFloorRange(
    GroupStayPreferences.get('floorStart', 1),
    GroupStayPreferences.get('floorEnd', 5),
    inferFloorRange(rooms)
  );
}

function applyFloorRange({ floorStart, floorEnd }) {
  const range = normalizeFloorRange(floorStart, floorEnd, getRoomFloorRange());
  GroupStayPreferences.set('floorStart', range.start);
  GroupStayPreferences.set('floorEnd', range.end);
}

function applyPlannerSize({ columnWidth, rowHeight }) {
  PLANNER_DAY_WIDTH = Number(columnWidth);
  PLANNER_ROW_HEIGHT = Number(rowHeight);
  if (appStore.getState().ui.activeRoute === 'planning') renderCalendar();
}
```

Change `saveEmpPin` to accept the validated PIN and return the API result; keep raw PIN values out of preferences and store:

```js
async function saveEmpPin(pin) {
  const result = await apiPost(`${API.auth}?action=setManagementPin`, { pin });
  managementPinEnabled = Boolean(result.managementPinEnabled);
  empPinUnlocked = false;
  return result;
}
```

Load the feature modules after `js/ui/feedback.js` and before domain features:

```html
<link rel='stylesheet' href='css/14-reception-shell.css'>
<script src='js/features/app-shell.js'></script>
<script src='js/features/settings.js'></script>
```

Extend `createAppShell` with a `logout = () => {}` dependency. Add this as the first branch of its `onClick` function so the sidebar and mobile buttons share one logout path:

```js
if (event.target.closest('[data-action=logout]')) {
  logout();
  return;
}
```

Add this composition block in `script.js` immediately before the navigation compatibility functions:

```js
let appRouter = null;
let appShell = null;

const ROUTE_RENDERERS = {
  oggi: () => renderDashboard(),
  planning: () => renderCalendar(),
  prenotazioni: () => renderReservations(),
  ospiti: () => renderGuests(),
  camere: () => renderRooms(),
  gestione: () => renderManagement(),
  sicurezza: () => renderCompliance(),
  impostazioni: () => GroupStaySettings.render()
};

function activateCanonicalRoute(route, config) {
  if (route === 'gestione' && managementPinEnabled && !empPinUnlocked) {
    const previous = appStore.getState().ui.activeRoute;
    openPinModal();
    appRouter.navigate(previous === 'gestione' ? 'oggi' : previous, { replace: true });
    return;
  }
  appShell.activateRoute(route, config);
}

function ensureAppNavigation() {
  if (appRouter) return appRouter;

  GroupStaySettings.init({
    documentRef: document,
    preferences: GroupStayPreferences,
    setLanguage,
    applyPlannerSize,
    applyFloorRange,
    saveManagementPin: saveEmpPin,
    removeManagementPin: removeEmpPin,
    logout: logoutUser
  });
  appShell = GroupStayAppShell.createAppShell({
    documentRef: document,
    store: appStore,
    mainContent: document.getElementById('mainContent'),
    renderers: ROUTE_RENDERERS,
    logout: logoutUser
  });
  appRouter = GroupStayRouter.createRouter({
    windowRef: window,
    onRoute: activateCanonicalRoute
  });
  appShell.init();
  return appRouter;
}
```

Replace the body of legacy `navigateTo` and the successful PIN branch with:

```js
function navigateTo(page) {
  if (page === 'more') {
    appShell?.toggleMobileMore();
    return;
  }
  const route = GroupStayRouter.ROUTES[page]
    ? page
    : GroupStayRouter.routeForLegacyPage(page);
  if (!route) {
    appRouter.navigate('oggi', { replace: true });
    return;
  }
  appRouter.navigate(route);
}

async function submitPin() {
  const input = document.getElementById('pinInput');
  const errorElement = document.getElementById('pinError');
  try {
    const result = await apiPost(`${API.auth}?action=verifyManagementPin`, { pin: input.value.trim() });
    if (!result.verified) throw new Error('wrong-pin');
    empPinUnlocked = true;
    closePinModal();
    appRouter.navigate('gestione', { replace: true });
    empPinUnlocked = false;
  } catch (error) {
    errorElement.style.display = 'block';
    input.value = '';
    input.focus();
  }
}
```

Delete `resolveActiveNavPage`, the document-level `.nav-item, .tab-item` listener, `getBootPage`, and the page-rendering switch inside the former `navigateTo`. In `startApplication`, after `loadAllData()` succeeds and after `await nextPaint()`, use:

```js
const router = ensureAppNavigation();
router.start();
```

Do not render Dashboard, Planning, or any other page directly during bootstrap; the current hash is the only initial-route input. On logout, call:

```js
appRouter?.stop();
appShell?.destroy();
appRouter = null;
appShell = null;
appStore.reset('session/logout');
```

Browser back/forward and refresh now flow only through `hashchange`; compatibility callers continue to call `navigateTo('calendar')`, but that adapter writes `#/planning`.

- [ ] **Step 9: Add the minimum structural shell styles**

Create `css/14-reception-shell.css` with these rules. Do not add gradients, fixed content heights, pulsing effects, or decorative card shadows:

```css
.nav-group-label {
  margin: 20px 14px 6px;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.page[hidden],
.mobile-more-backdrop[hidden] {
  display: none !important;
}

.mobile-more-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1400;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px;
  background: rgb(24 32 29 / .42);
}

.mobile-more-sheet {
  width: min(100%, 520px);
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-secondary);
}

.mobile-more-header,
.mobile-more-links a,
.mobile-more-logout {
  min-height: 44px;
}

.mobile-more-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.mobile-more-links {
  display: grid;
}

.mobile-more-links a,
.mobile-more-logout {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  color: var(--text-primary);
  text-decoration: none;
}

.settings-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}

.settings-panel {
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-secondary);
}

.settings-panel-heading,
.settings-field,
.settings-fieldset {
  margin: 0 0 20px;
}

.settings-range,
.settings-actions,
.settings-floor-grid {
  display: flex;
  gap: 12px;
  align-items: center;
}

.form-message[data-type='error'] {
  color: var(--red);
}

@media (max-width: 900px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .tab-item {
    min-width: 44px;
    min-height: 44px;
  }
  .settings-panel {
    padding: 16px;
  }
  .settings-floor-grid {
    display: grid;
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 10: Verify navigation behavior and commit**

Run: `node --test tests/app-shell.test.mjs tests/shell-contract.test.mjs tests/router.test.mjs tests/store.test.mjs`

Expected: 15 tests PASS.

Run: `npm.cmd test`

Expected: all tests PASS. Manually open `#/camere`, refresh, use browser Back/Forward, open `#/missing`, and confirm the resulting hashes are respectively `#/camere` and fallback `#/oggi`.

Run: `rg -n 'data-page=|settingsModal|navigateTo..mail|page-mail' index.html`

Expected: no matches.

```bash
git add index.html script.js js/features/app-shell.js js/features/settings.js css/14-reception-shell.css tests/app-shell.test.mjs tests/shell-contract.test.mjs
git commit -m 'feat: add reception navigation shell'
```

### Task 4: Build a pure, ranked search index

**Files:**
- Create: `js/core/search.js`
- Create: `tests/search.test.mjs`
- Modify: `index.html` (load `search.js` after `router.js` and before UI/feature modules)

- [ ] **Step 1: Write failing normalization, indexing, ranking, and grouping tests**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadSearch() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync('js/core/search.js', 'utf8'), context);
  return context.window.GroupStaySearch;
}

const dataset = {
  reservations: [
    {
      id: 'res-rossi',
      groupName: 'Famiglia Rossi',
      organizer: 'Giulia Bianchi',
      email: 'giulia@example.it',
      phone: '+39 333 111 2233',
      checkin: '2026-08-10',
      checkout: '2026-08-13'
    },
    {
      id: 'res-roma',
      groupName: 'Gruppo Roma',
      organizer: 'Mario Verdi',
      email: 'mario@example.it',
      phone: '333 000 0000',
      checkin: '2026-09-01',
      checkout: '2026-09-02'
    }
  ],
  guests: [
    {
      id: 'guest-1',
      reservationId: 'res-rossi',
      firstName: 'José',
      lastName: 'D Àngelo',
      docNumber: 'AB123CD',
      email: 'jose@example.it',
      phone: '339 222 3344'
    }
  ],
  rooms: [
    { id: 'room-101', number: '101', type: 'Doppia' },
    { id: 'room-1010', number: '1010', type: 'Suite' }
  ]
};

test('normalizes accents, punctuation, case, and repeated whitespace', () => {
  const search = loadSearch();
  assert.equal(search.normalizeSearchText('  José,  D ÀNGELO  '), 'jose d angelo');
  assert.equal(search.normalizeSearchText('+39 (333)-111'), '39 333 111');
});

test('builds routable records from only reservations, guests, and rooms', () => {
  const search = loadSearch();
  const before = JSON.stringify(dataset);
  const index = search.buildSearchIndex(dataset);
  assert.equal(index.length, 5);
  assert.deepEqual(
    { entity: index[0].entity, route: index[0].route, openAction: index[0].openAction },
    { entity: 'reservation', route: 'prenotazioni', openAction: 'reservation' }
  );
  assert.equal(index.find((record) => record.id === 'guest-1').route, 'ospiti');
  assert.equal(index.find((record) => record.id === 'room-101').route, 'camere');
  assert.equal(JSON.stringify(dataset), before);
});

test('finds accents, document numbers, contacts, room type, and identifiers', () => {
  const search = loadSearch();
  const index = search.buildSearchIndex(dataset);
  assert.equal(search.searchIndex(index, 'jose angelo').groups[0].results[0].id, 'guest-1');
  assert.equal(search.searchIndex(index, 'AB123CD').groups[0].results[0].id, 'guest-1');
  assert.equal(search.searchIndex(index, '333 111').groups[0].results[0].id, 'res-rossi');
  assert.equal(search.searchIndex(index, 'suite').groups[0].results[0].id, 'room-1010');
  assert.equal(search.searchIndex(index, 'res-roma').groups[0].results[0].id, 'res-roma');
});

test('exact and prefix title matches rank before broader matches', () => {
  const search = loadSearch();
  const result = search.searchIndex(search.buildSearchIndex(dataset), '101');
  assert.deepEqual(Array.from(result.groups[0].results, (record) => record.id), ['room-101', 'room-1010']);
});

test('groups in product order and enforces a per-group limit', () => {
  const search = loadSearch();
  const repeated = {
    reservations: Array.from({ length: 7 }, (_, index) => ({
      id: `r${index}`, groupName: `Rossi ${index}`
    })),
    guests: [{ id: 'g1', firstName: 'Rossi', lastName: 'Anna' }],
    rooms: [{ id: 'rm1', number: 'Rossi', type: 'Test' }]
  };
  const result = search.searchIndex(search.buildSearchIndex(repeated), 'rossi', { limitPerGroup: 3 });
  assert.deepEqual(Array.from(result.groups, (group) => group.entity), ['reservation', 'guest', 'room']);
  assert.equal(result.groups[0].results.length, 3);
  assert.equal(result.total, 9);
  assert.equal(result.visibleTotal, 5);
});

test('blank queries return an explicit empty result', () => {
  const search = loadSearch();
  assert.equal(JSON.stringify(search.searchIndex(search.buildSearchIndex(dataset), '  ')), JSON.stringify({
    query: '',
    total: 0,
    visibleTotal: 0,
    groups: []
  }));
});
```

- [ ] **Step 2: Run the search test and verify RED**

Run: `node --test tests/search.test.mjs`

Expected: FAIL because `js/core/search.js` does not exist.

- [ ] **Step 3: Implement normalization and index construction**

Start `js/core/search.js` with:

```js
(function initSearch(global) {
  'use strict';

  const ENTITY_META = Object.freeze({
    reservation: Object.freeze({ label: 'Prenotazioni', order: 0 }),
    guest: Object.freeze({ label: 'Ospiti', order: 1 }),
    room: Object.freeze({ label: 'Camere', order: 2 })
  });

  function normalizeSearchText(value) {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function nonEmpty(values) {
    return values.map((value) => String(value ?? '').trim()).filter(Boolean);
  }

  function createRecord({ entity, id, title, subtitle, route, openAction, fields }) {
    const normalizedFields = nonEmpty(fields).map(normalizeSearchText).filter(Boolean);
    return {
      entity,
      id: String(id),
      title: String(title || id),
      subtitle: nonEmpty(subtitle).join(' · '),
      route,
      openAction,
      normalizedTitle: normalizeSearchText(title || id),
      normalizedFields,
      searchText: Array.from(new Set(normalizedFields)).join(' ')
    };
  }

  function buildSearchIndex({ reservations = [], guests = [], rooms = [] } = {}) {
    const reservationRecords = reservations.map((reservation) => createRecord({
      entity: 'reservation',
      id: reservation.id,
      title: reservation.groupName || reservation.organizer || reservation.id,
      subtitle: [
        reservation.organizer,
        reservation.checkin && reservation.checkout
          ? `${reservation.checkin} → ${reservation.checkout}`
          : ''
      ],
      route: 'prenotazioni',
      openAction: 'reservation',
      fields: [
        reservation.id,
        reservation.groupName,
        reservation.organizer,
        reservation.email,
        reservation.phone
      ]
    }));

    const guestRecords = guests.map((guest) => {
      const fullName = nonEmpty([guest.firstName, guest.lastName]).join(' ');
      return createRecord({
        entity: 'guest',
        id: guest.id,
        title: fullName || guest.id,
        subtitle: [guest.docNumber, guest.email || guest.phone],
        route: 'ospiti',
        openAction: 'guest',
        fields: [
          guest.id,
          guest.firstName,
          guest.lastName,
          fullName,
          guest.docNumber,
          guest.email,
          guest.phone
        ]
      });
    });

    const roomRecords = rooms.map((room) => createRecord({
      entity: 'room',
      id: room.id,
      title: String(room.number || room.id),
      subtitle: [room.type],
      route: 'camere',
      openAction: 'room',
      fields: [room.id, room.number, room.type]
    }));

    return [...reservationRecords, ...guestRecords, ...roomRecords];
  }

  function scoreRecord(record, query, tokens) {
    if (!tokens.every((token) => record.searchText.includes(token))) return 0;
    if (record.normalizedTitle === query) return 1000;
    if (record.normalizedTitle.startsWith(query)) return 850;
    if (record.normalizedFields.some((field) => field === query)) return 750;
    if (record.normalizedFields.some((field) => field.startsWith(query))) return 650;
    if (record.searchText.includes(query)) return 500;
    return 350;
  }

  function searchIndex(index, rawQuery, { limitPerGroup = 5 } = {}) {
    const query = normalizeSearchText(rawQuery);
    if (!query) return { query: '', total: 0, visibleTotal: 0, groups: [] };
    const tokens = query.split(' ');
    const matches = index
      .map((record) => ({ record, score: scoreRecord(record, query, tokens) }))
      .filter((match) => match.score > 0)
      .sort((left, right) => (
        right.score - left.score
        || ENTITY_META[left.record.entity].order - ENTITY_META[right.record.entity].order
        || left.record.title.localeCompare(right.record.title, 'it', { numeric: true, sensitivity: 'base' })
        || left.record.id.localeCompare(right.record.id)
      ));

    const groups = Object.keys(ENTITY_META)
      .map((entity) => {
        const entityMatches = matches.filter((match) => match.record.entity === entity);
        return {
          entity,
          label: ENTITY_META[entity].label,
          count: entityMatches.length,
          results: entityMatches.slice(0, limitPerGroup).map((match) => ({
            ...match.record,
            score: match.score
          }))
        };
      })
      .filter((group) => group.count > 0);

    return {
      query,
      total: matches.length,
      visibleTotal: groups.reduce((total, group) => total + group.results.length, 0),
      groups
    };
  }

  global.GroupStaySearch = {
    ENTITY_META,
    buildSearchIndex,
    normalizeSearchText,
    searchIndex
  };
})(window);
```

- [ ] **Step 4: Load, verify, and commit the pure module**

Add after the router:

```html
<script src='js/core/search.js'></script>
```

Run: `node --test tests/search.test.mjs`

Expected: 6 tests PASS.

Run: `node --test tests/search.test.mjs tests/router.test.mjs tests/store.test.mjs`

Expected: 16 tests PASS.

```bash
git add js/core/search.js tests/search.test.mjs index.html
git commit -m 'feat: add property search index'
```

### Task 5: Add reusable dialog focus and network-status primitives

**Files:**
- Create: `js/ui/dialog.js`
- Create: `js/ui/network-status.js`
- Create: `tests/dialog.test.mjs`
- Create: `tests/network-status.test.mjs`
- Modify: `js/ui/feedback.js:1-180`
- Modify: `index.html` (network banner, live region, and script order)
- Modify: `script.js` (network controller composition and core request outcomes)

- [ ] **Step 1: Write the failing focus-controller test**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadDialog() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync('js/ui/dialog.js', 'utf8'), context);
  return context.window.GroupStayDialog;
}

function createFixture() {
  const listeners = new Map();
  const attributes = new Map([['role', 'dialog']]);
  const documentRef = {
    activeElement: null,
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    dispatch(type, event) { listeners.get(type)?.(event); }
  };
  function focusable(id) {
    return { id, focus() { documentRef.activeElement = this; } };
  }
  const first = focusable('first');
  const last = focusable('last');
  const trigger = focusable('trigger');
  const root = {
    hidden: true,
    classList: { add() {}, remove() {} },
    matches(selector) { return selector === '[role=dialog]'; },
    querySelector() { return null; },
    addEventListener() {},
    removeEventListener() {},
    getAttribute(name) { return attributes.get(name) || null; },
    setAttribute(name, value) { attributes.set(name, String(value)); }
  };
  return { documentRef, first, last, trigger, root };
}

test('open focuses the first control and Escape restores the trigger', () => {
  const fixture = createFixture();
  const reasons = [];
  const controller = loadDialog().createDialogController({
    root: fixture.root,
    documentRef: fixture.documentRef,
    getFocusable: () => [fixture.first, fixture.last],
    onClose: (reason) => reasons.push(reason)
  });
  controller.open(fixture.trigger);
  assert.equal(fixture.root.hidden, false);
  assert.equal(fixture.documentRef.activeElement, fixture.first);
  fixture.documentRef.dispatch('keydown', { key: 'Escape', preventDefault() {} });
  assert.equal(fixture.root.hidden, true);
  assert.equal(fixture.documentRef.activeElement, fixture.trigger);
  assert.deepEqual(reasons, ['escape']);
});

test('Tab and Shift+Tab remain inside the dialog', () => {
  const fixture = createFixture();
  const controller = loadDialog().createDialogController({
    root: fixture.root,
    documentRef: fixture.documentRef,
    getFocusable: () => [fixture.first, fixture.last]
  });
  controller.open(fixture.trigger);
  fixture.last.focus();
  fixture.documentRef.dispatch('keydown', { key: 'Tab', shiftKey: false, preventDefault() {} });
  assert.equal(fixture.documentRef.activeElement, fixture.first);
  fixture.first.focus();
  fixture.documentRef.dispatch('keydown', { key: 'Tab', shiftKey: true, preventDefault() {} });
  assert.equal(fixture.documentRef.activeElement, fixture.last);
});
```

- [ ] **Step 2: Write the failing network-state test**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadNetworkStatus() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync('js/ui/network-status.js', 'utf8'), context);
  return context.window.GroupStayNetworkStatus;
}

test('offline, degraded, retry, and recovery states remain explicit', async () => {
  const listeners = new Map();
  const message = { textContent: '' };
  const retry = { addEventListener(_type, listener) { this.listener = listener; }, removeEventListener() {} };
  const root = {
    hidden: true,
    dataset: {},
    querySelector(selector) {
      return selector === '[data-network-message]' ? message : retry;
    }
  };
  const windowRef = {
    navigator: { onLine: true },
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); }
  };
  const states = [];
  let retried = 0;
  const controller = loadNetworkStatus().createNetworkStatus({
    root,
    windowRef,
    onChange: (state) => states.push(state),
    onRetry: async () => { retried += 1; }
  });
  controller.init();
  assert.equal(root.hidden, true);
  controller.reportFailure();
  assert.equal(controller.current(), 'degraded');
  assert.equal(root.hidden, false);
  windowRef.navigator.onLine = false;
  listeners.get('offline')();
  assert.equal(controller.current(), 'offline');
  await retry.listener();
  assert.equal(retried, 1);
  windowRef.navigator.onLine = true;
  listeners.get('online')();
  assert.equal(controller.current(), 'online');
  assert.equal(root.hidden, true);
  assert.deepEqual(states, ['online', 'degraded', 'offline', 'online']);
});
```

- [ ] **Step 3: Run both tests and verify RED**

Run: `node --test tests/dialog.test.mjs tests/network-status.test.mjs`

Expected: FAIL because both UI primitive modules are missing.

- [ ] **Step 4: Implement the dialog controller**

```js
(function initDialog(global) {
  'use strict';

  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex=-1])'
  ].join(',');

  function defaultGetFocusable(panel) {
    return Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
  }

  function createDialogController({
    root,
    documentRef = global.document,
    getFocusable = defaultGetFocusable,
    onClose = () => {}
  } = {}) {
    if (!root) throw new TypeError('Dialog root is required');
    const panel = root.matches('[role=dialog]') ? root : root.querySelector('[role=dialog]');
    if (!panel) throw new TypeError('Dialog requires an element with role=dialog');
    let opened = false;
    let trigger = null;

    function focusFirst() {
      const controls = getFocusable(panel);
      if (controls.length) controls[0].focus();
      else {
        panel.setAttribute('tabindex', '-1');
        panel.focus();
      }
    }

    function close(reason = 'dismiss') {
      if (!opened) return;
      opened = false;
      root.hidden = true;
      root.classList.remove('open');
      root.setAttribute('aria-hidden', 'true');
      documentRef.removeEventListener('keydown', onKeydown);
      const restoreTarget = trigger;
      trigger = null;
      restoreTarget?.focus();
      onClose(reason);
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close('escape');
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = getFocusable(panel);
      if (!controls.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!event.shiftKey && documentRef.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && documentRef.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    }

    function onBackdropClick(event) {
      if (event.target === root) close('backdrop');
    }

    function open(nextTrigger = documentRef.activeElement) {
      if (opened) return;
      opened = true;
      trigger = nextTrigger;
      root.hidden = false;
      root.classList.add('open');
      root.setAttribute('aria-hidden', 'false');
      panel.setAttribute('aria-modal', 'true');
      documentRef.addEventListener('keydown', onKeydown);
      focusFirst();
    }

    root.addEventListener('click', onBackdropClick);

    return {
      open,
      close,
      isOpen: () => opened,
      destroy() {
        close('destroy');
        root.removeEventListener('click', onBackdropClick);
      }
    };
  }

  global.GroupStayDialog = { FOCUSABLE_SELECTOR, createDialogController };
})(window);
```

- [ ] **Step 5: Implement persistent network state and retry**

```js
(function initNetworkStatus(global) {
  'use strict';

  const COPY = Object.freeze({
    offline: 'Sei offline. I dati inseriti restano in questa schermata; riconnettiti e riprova.',
    degraded: 'Connessione instabile. I dati inseriti non sono stati scartati; verifica la rete e riprova.'
  });

  function createNetworkStatus({
    root,
    windowRef = global,
    onChange = () => {},
    onRetry = async () => {}
  } = {}) {
    if (!root) throw new TypeError('Network status root is required');
    const message = root.querySelector('[data-network-message]');
    const retryButton = root.querySelector('[data-network-retry]');
    let state = 'online';
    let initialized = false;

    function render(nextState) {
      state = nextState;
      root.dataset.state = state;
      root.hidden = state === 'online';
      message.textContent = COPY[state] || '';
      onChange(state);
    }

    function handleOffline() {
      render('offline');
    }

    function handleOnline() {
      render('online');
    }

    async function handleRetry() {
      retryButton.disabled = true;
      try {
        await onRetry();
      } finally {
        retryButton.disabled = false;
      }
    }

    function init() {
      if (initialized) return;
      initialized = true;
      windowRef.addEventListener('offline', handleOffline);
      windowRef.addEventListener('online', handleOnline);
      retryButton.addEventListener('click', handleRetry);
      render(windowRef.navigator.onLine === false ? 'offline' : 'online');
    }

    function destroy() {
      if (!initialized) return;
      windowRef.removeEventListener('offline', handleOffline);
      windowRef.removeEventListener('online', handleOnline);
      retryButton.removeEventListener('click', handleRetry);
      initialized = false;
    }

    function reportFailure() {
      render(windowRef.navigator.onLine === false ? 'offline' : 'degraded');
    }

    function reportSuccess() {
      if (windowRef.navigator.onLine !== false) render('online');
    }

    return { init, destroy, reportFailure, reportSuccess, current: () => state };
  }

  global.GroupStayNetworkStatus = { createNetworkStatus };
})(window);
```

- [ ] **Step 6: Add semantic shared UI markup and deterministic load order**

Insert immediately inside `body`, after the authentication surface:

```html
<div class='network-status-banner' id='networkStatusBanner'
     role='status' aria-live='assertive' aria-atomic='true' hidden>
  <span data-network-message></span>
  <button type='button' class='btn btn-secondary btn-sm' data-network-retry>Riprova</button>
</div>
<div class='sr-only' id='appLiveRegion' role='status'
     aria-live='polite' aria-atomic='true'></div>
```

Make the toast container explicit:

```html
<div class='toast-container' id='toastContainer'
     role='status' aria-live='polite' aria-atomic='true'></div>
```

Use this final core/UI order before feature modules:

```html
<script src='js/core/preferences.js'></script>
<script src='js/core/store.js'></script>
<script src='js/core/router.js'></script>
<script src='js/core/search.js'></script>
<script src='js/ui/datepicker.js'></script>
<script src='js/ui/dialog.js'></script>
<script src='js/ui/network-status.js'></script>
<script src='js/ui/feedback.js'></script>
```

- [ ] **Step 7: Use the focus controller in confirmation and mobile dialogs**

In `js/ui/feedback.js`, add `let customDialogController = null;`. At the end of `ensureDialogModal`, create it once:

```js
customDialogController = global.GroupStayDialog.createDialogController({
  root: modal,
  documentRef: document,
  onClose() {
    if (pendingDialog) {
      const { resolve, type } = pendingDialog;
      pendingDialog = null;
      resolve(type === 'confirm' ? false : null);
    }
    syncModalState();
  }
});
```

In `showConfirmDialog` and `showPromptDialog`, replace direct class changes and timeout focus calls with:

```js
customDialogController.open(document.activeElement);
syncModalState();
```

In the custom-dialog branch of `closeModal`, use:

```js
if (id === 'customDialogModal' && customDialogController) {
  customDialogController.close('programmatic');
  return;
}
```

Replace the existing confirmation-button listener so success also tears down the focus trap and restores focus:

```js
modal.querySelector('#customDialogOk').addEventListener('click', () => {
  if (!pendingDialog) return;
  const { resolve, type } = pendingDialog;
  const value = modal.querySelector('#customDialogInput').value;
  pendingDialog = null;
  customDialogController.close(type);
  resolve(type === 'prompt' ? value : true);
});
```

Create the mobile controller in `ensureAppNavigation`:

```js
const mobileMoreDialog = GroupStayDialog.createDialogController({
  root: document.getElementById('mobileMoreMenu'),
  documentRef: document
});
```

Add `mobileMoreDialog = null` to the `createAppShell` dependencies. Replace its two mobile-menu methods with:

```js
function closeMobileMore() {
  if (mobileMoreDialog?.isOpen()) mobileMoreDialog.close('navigation');
  const menu = documentRef.getElementById('mobileMoreMenu');
  const toggle = documentRef.getElementById('mobileMoreToggle');
  if (!mobileMoreDialog && menu) menu.hidden = true;
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
}

function toggleMobileMore() {
  const menu = documentRef.getElementById('mobileMoreMenu');
  const toggle = documentRef.getElementById('mobileMoreToggle');
  if (!menu || !toggle) return;
  if (mobileMoreDialog) {
    if (mobileMoreDialog.isOpen()) closeMobileMore();
    else {
      mobileMoreDialog.open(toggle);
      toggle.setAttribute('aria-expanded', 'true');
    }
    return;
  }
  menu.hidden = !menu.hidden;
  toggle.setAttribute('aria-expanded', String(!menu.hidden));
}
```

Pass `mobileMoreDialog` to `createAppShell`. On shell destruction call `mobileMoreDialog.destroy()` after removing shell listeners.

- [ ] **Step 8: Compose the network controller with data loading**

Add beside the shell/router variables in `script.js`:

```js
let networkStatus = null;

function ensureNetworkStatus() {
  if (networkStatus) return networkStatus;
  networkStatus = GroupStayNetworkStatus.createNetworkStatus({
    root: document.getElementById('networkStatusBanner'),
    windowRef: window,
    onChange(status) {
      appStore.setState((state) => ({
        ...state,
        ui: { ...state.ui, networkStatus: status }
      }), 'ui/network');
    },
    async onRetry() {
      const loaded = await loadAllData();
      if (loaded) {
        networkStatus.reportSuccess();
        appRouter?.sync();
      }
    }
  });
  networkStatus.init();
  return networkStatus;
}
```

Call `ensureNetworkStatus()` near the start of `startApplication`, before `loadAllData()`. At the successful end of `loadAllData()`, call:

```js
networkStatus?.reportSuccess();
```

In its catch branch, report only transport failures through the persistent banner. Field, authorization, conflict, and safe server errors remain in their workflow:

```js
if (err?.code === 'NETWORK_ERROR' || navigator.onLine === false) {
  networkStatus?.reportFailure();
}
```

In logout teardown, call `networkStatus?.destroy()` and set it to `null`.

Add these structural styles to `css/14-reception-shell.css`:

```css
.network-status-banner {
  position: fixed;
  z-index: 1700;
  top: max(12px, env(safe-area-inset-top));
  left: 50%;
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(calc(100% - 24px), 720px);
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--orange);
  border-radius: 8px;
  background: var(--orange-light);
  color: var(--text-primary);
  transform: translateX(-50%);
}

.network-status-banner[data-state='offline'] {
  border-color: var(--red);
  background: var(--red-light);
}
```

- [ ] **Step 9: Run primitive and integration tests, then commit**

Run: `node --test tests/dialog.test.mjs tests/network-status.test.mjs tests/app-shell.test.mjs tests/shell-contract.test.mjs`

Expected: 8 tests PASS.

Run: `npm.cmd test`

Expected: all tests PASS.

```bash
git add js/ui/dialog.js js/ui/network-status.js js/ui/feedback.js tests/dialog.test.mjs tests/network-status.test.mjs index.html script.js css/14-reception-shell.css
git commit -m 'feat: add accessible dialog and network primitives'
```

### Task 6: Add the Ctrl/Cmd+K global search dialog

**Files:**
- Create: `js/features/global-search.js`
- Create: `tests/global-search.test.mjs`
- Modify: `index.html` (visible trigger, dialog markup, and feature script)
- Modify: `script.js` (feature composition and entity openers)
- Modify: `css/14-reception-shell.css`

- [ ] **Step 1: Write failing keyboard, action, and markup contracts**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadFeature() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync('js/features/global-search.js', 'utf8'), context);
  return context.window.GroupStayGlobalSearch;
}

test('keyboard index wraps in both directions and handles an empty list', () => {
  const feature = loadFeature();
  assert.equal(feature.nextResultIndex(-1, 1, 3), 0);
  assert.equal(feature.nextResultIndex(2, 1, 3), 0);
  assert.equal(feature.nextResultIndex(0, -1, 3), 2);
  assert.equal(feature.nextResultIndex(0, 1, 0), -1);
});

test('results translate to one canonical route and one existing opener', () => {
  const feature = loadFeature();
  assert.deepEqual(
    { ...feature.actionForResult({ id: 'r1', route: 'prenotazioni', openAction: 'reservation' }) },
    { id: 'r1', route: 'prenotazioni', opener: 'openReservationDetail' }
  );
  assert.deepEqual(
    { ...feature.actionForResult({ id: 'g1', route: 'ospiti', openAction: 'guest' }) },
    { id: 'g1', route: 'ospiti', opener: 'openEditGuestModal' }
  );
  assert.deepEqual(
    { ...feature.actionForResult({ id: 'rm1', route: 'camere', openAction: 'room' }) },
    { id: 'rm1', route: 'camere', opener: 'openEditRoom' }
  );
});

test('search markup exposes a labelled dialog, combobox, listbox, and live status', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /id='globalSearchTrigger'/);
  assert.match(html, /id='globalSearchDialog'[^>]*role='dialog'[^>]*aria-modal='true'/);
  assert.match(html, /id='globalSearchInput'[^>]*role='combobox'/);
  assert.match(html, /aria-controls='globalSearchResults'/);
  assert.match(html, /id='globalSearchResults'[^>]*role='listbox'/);
  assert.match(html, /id='globalSearchStatus'[^>]*role='status'/);
});

test('feature contains complete keyboard handling and uses safe DOM construction', () => {
  const source = fs.readFileSync('js/features/global-search.js', 'utf8');
  assert.match(source, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /Enter/);
  assert.match(source, /textContent/);
  assert.match(source, /replaceChildren/);
  assert.doesNotMatch(source, /\.innerHTML\s*=/);
});
```

- [ ] **Step 2: Run the feature contract and verify RED**

Run: `node --test tests/global-search.test.mjs`

Expected: FAIL because `js/features/global-search.js` and the dialog markup do not exist.

- [ ] **Step 3: Add the visible trigger and semantic dialog**

Place this button below the sidebar logo and before the first navigation-group label:

```html
<button class='shell-search-trigger' id='globalSearchTrigger' type='button'
        aria-haspopup='dialog' aria-controls='globalSearchDialog'>
  <span>Cerca ospite, prenotazione o camera</span>
  <kbd>Ctrl/⌘ K</kbd>
</button>
```

Place this dialog near the end of `body`, before the toast container:

```html
<div class='global-search-backdrop' id='globalSearchDialog' role='dialog'
     aria-modal='true' aria-labelledby='globalSearchTitle'
     aria-describedby='globalSearchHint' hidden>
  <div class='global-search-panel'>
    <h2 class='sr-only' id='globalSearchTitle'>Ricerca globale</h2>
    <div class='global-search-input-row'>
      <input id='globalSearchInput' type='search' role='combobox'
             aria-autocomplete='list' aria-expanded='true'
             aria-controls='globalSearchResults'
             aria-describedby='globalSearchHint'
             placeholder='Nome, contatto, documento, camera...'
             autocomplete='off'>
      <button type='button' data-action='close-global-search'
              aria-label='Chiudi ricerca'>Chiudi</button>
    </div>
    <p class='global-search-hint' id='globalSearchHint'>
      Usa freccia su e giu per scegliere, Invio per aprire, Esc per chiudere.
    </p>
    <div class='global-search-results' id='globalSearchResults'
         role='listbox' aria-label='Risultati di ricerca'></div>
    <p class='global-search-status' id='globalSearchStatus'
       role='status' aria-live='polite'></p>
  </div>
</div>
```

- [ ] **Step 4: Implement feature state, shortcuts, and store subscription**

Create `js/features/global-search.js`:

```js
(function initGlobalSearch(global) {
  'use strict';

  const OPENER_BY_ACTION = Object.freeze({
    reservation: 'openReservationDetail',
    guest: 'openEditGuestModal',
    room: 'openEditRoom'
  });

  function nextResultIndex(current, direction, count) {
    if (!count) return -1;
    return (current + direction + count) % count;
  }

  function actionForResult(result) {
    const opener = OPENER_BY_ACTION[result.openAction];
    if (!opener) throw new RangeError(`Unknown search action: ${result.openAction}`);
    return { id: result.id, route: result.route, opener };
  }

  let deps = null;
  let dialog = null;
  let unsubscribe = null;
  let index = [];
  let flatResults = [];
  let activeIndex = -1;
  let trigger = null;
  let input = null;
  let resultsRoot = null;
  let statusRoot = null;

  function setStatus(message) {
    statusRoot.textContent = message;
  }

  function renderMessage(message) {
    const paragraph = deps.documentRef.createElement('p');
    paragraph.className = 'global-search-empty';
    paragraph.textContent = message;
    resultsRoot.replaceChildren(paragraph);
    flatResults = [];
    activeIndex = -1;
    input.removeAttribute('aria-activedescendant');
  }

  function rebuildIndex(data) {
    index = deps.search.buildSearchIndex(data);
    if (dialog?.isOpen()) runSearch(input.value);
  }

  function onStoreData(data) {
    rebuildIndex(data);
  }

  function open() {
    dialog.open(deps.documentRef.activeElement || trigger);
    input.value = '';
    input.focus();
    const status = deps.store.getState().ui.dataStatus;
    if (status === 'loading') renderMessage('Caricamento dati della struttura...');
    else renderMessage('Inizia a scrivere per cercare nella struttura.');
    setStatus('');
  }

  function close() {
    dialog.close('button');
  }

  function onDocumentKeydown(event) {
    const commandKey = event.metaKey || event.ctrlKey;
    if (commandKey && !event.altKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (dialog.isOpen()) close();
      else open();
    }
  }

  function renderResults(result) {
    flatResults = result.groups.flatMap((group) => group.results);
    activeIndex = flatResults.length ? 0 : -1;
    let resultIndex = 0;
    const groupNodes = result.groups.map((group) => {
      const section = deps.documentRef.createElement('section');
      section.className = 'global-search-group';
      section.setAttribute('role', 'group');
      section.setAttribute('aria-labelledby', `search-group-${group.entity}`);
      const heading = deps.documentRef.createElement('h3');
      heading.id = `search-group-${group.entity}`;
      heading.textContent = `${group.label} (${group.count})`;
      section.append(heading);

      group.results.forEach((record) => {
        const indexForRecord = resultIndex;
        resultIndex += 1;
        const option = deps.documentRef.createElement('button');
        option.type = 'button';
        option.id = `global-search-option-${indexForRecord}`;
        option.className = 'global-search-option';
        option.dataset.resultIndex = String(indexForRecord);
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(indexForRecord === activeIndex));

        const title = deps.documentRef.createElement('span');
        title.className = 'global-search-option-title';
        title.textContent = record.title;
        const subtitle = deps.documentRef.createElement('span');
        subtitle.className = 'global-search-option-subtitle';
        subtitle.textContent = record.subtitle;
        option.append(title, subtitle);
        section.append(option);
      });
      return section;
    });

    resultsRoot.replaceChildren(...groupNodes);
    syncActiveOption();
    setStatus(`${result.visibleTotal} risultati visibili su ${result.total}.`);
  }

  function runSearch(rawQuery) {
    if (deps.store.getState().ui.dataStatus === 'loading') {
      renderMessage('Caricamento dati della struttura...');
      setStatus('Ricerca disponibile al termine del caricamento.');
      return;
    }
    const result = deps.search.searchIndex(index, rawQuery, { limitPerGroup: 5 });
    if (!result.query) {
      renderMessage('Inizia a scrivere per cercare nella struttura.');
      setStatus('');
      return;
    }
    if (!result.total) {
      renderMessage('Nessun risultato. Controlla nome, contatto, documento o numero camera.');
      setStatus('Nessun risultato.');
      return;
    }
    renderResults(result);
  }

  function syncActiveOption() {
    const options = Array.from(resultsRoot.querySelectorAll('[data-result-index]'));
    options.forEach((option, indexForOption) => {
      const selected = indexForOption === activeIndex;
      option.classList.toggle('active', selected);
      option.setAttribute('aria-selected', String(selected));
      if (selected) {
        input.setAttribute('aria-activedescendant', option.id);
        option.scrollIntoView({ block: 'nearest' });
      }
    });
    if (activeIndex < 0) input.removeAttribute('aria-activedescendant');
  }

  function moveActive(direction) {
    activeIndex = nextResultIndex(activeIndex, direction, flatResults.length);
    syncActiveOption();
  }

  function selectResult(result) {
    if (!result) return;
    const action = actionForResult(result);
    dialog.close('selection');
    deps.navigate(action.route);
    deps.requestFrame(() => deps.openers[action.opener](action.id));
  }

  function onInput(event) {
    runSearch(event.target.value);
  }

  function onInputKeydown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      selectResult(flatResults[activeIndex]);
    }
  }

  function onResultsClick(event) {
    const option = event.target.closest('[data-result-index]');
    if (!option) return;
    selectResult(flatResults[Number(option.dataset.resultIndex)]);
  }

  function onResultsPointerMove(event) {
    const option = event.target.closest('[data-result-index]');
    if (!option) return;
    activeIndex = Number(option.dataset.resultIndex);
    syncActiveOption();
  }

  function init(nextDeps) {
    if (deps) return;
    deps = nextDeps;
    trigger = deps.documentRef.getElementById('globalSearchTrigger');
    input = deps.documentRef.getElementById('globalSearchInput');
    resultsRoot = deps.documentRef.getElementById('globalSearchResults');
    statusRoot = deps.documentRef.getElementById('globalSearchStatus');
    const root = deps.documentRef.getElementById('globalSearchDialog');
    dialog = deps.dialog.createDialogController({ root, documentRef: deps.documentRef });

    trigger.addEventListener('click', open);
    root.querySelector('[data-action=close-global-search]').addEventListener('click', close);
    input.addEventListener('input', onInput);
    input.addEventListener('keydown', onInputKeydown);
    resultsRoot.addEventListener('click', onResultsClick);
    resultsRoot.addEventListener('pointermove', onResultsPointerMove);
    deps.documentRef.addEventListener('keydown', onDocumentKeydown);
    unsubscribe = deps.store.subscribe(
      (state) => ({
        reservations: state.data.reservations,
        guests: state.data.guests,
        rooms: state.data.rooms
      }),
      onStoreData,
      {
        fireImmediately: true,
        equality: (left, right) => (
          left.reservations === right.reservations
          && left.guests === right.guests
          && left.rooms === right.rooms
        )
      }
    );
  }

  function destroy() {
    if (!deps) return;
    const root = deps.documentRef.getElementById('globalSearchDialog');
    trigger.removeEventListener('click', open);
    root.querySelector('[data-action=close-global-search]').removeEventListener('click', close);
    input.removeEventListener('input', onInput);
    input.removeEventListener('keydown', onInputKeydown);
    resultsRoot.removeEventListener('click', onResultsClick);
    resultsRoot.removeEventListener('pointermove', onResultsPointerMove);
    deps.documentRef.removeEventListener('keydown', onDocumentKeydown);
    unsubscribe?.();
    dialog.destroy();
    deps = null;
  }

  global.GroupStayGlobalSearch = {
    init,
    destroy,
    open,
    close,
    actionForResult,
    nextResultIndex
  };
})(window);
```

- [ ] **Step 5: Compose search with the store, router, and existing details**

Load after `settings.js`:

```html
<script src='js/features/global-search.js'></script>
```

After `appRouter` and `appShell` are created in `ensureAppNavigation`, initialize the feature exactly once:

```js
GroupStayGlobalSearch.init({
  documentRef: document,
  store: appStore,
  search: GroupStaySearch,
  dialog: GroupStayDialog,
  navigate: (route) => appRouter.navigate(route),
  requestFrame: (callback) => requestAnimationFrame(callback),
  openers: {
    openReservationDetail,
    openEditGuestModal,
    openEditRoom
  }
});
```

Call `GroupStayGlobalSearch.destroy()` before clearing shell/router references during logout. Do not call an API or save query/index data to browser storage.

- [ ] **Step 6: Add compact search-panel styles**

Append to `css/14-reception-shell.css`:

```css
.shell-search-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: calc(100% - 24px);
  min-height: 44px;
  margin: 8px 12px 4px;
  padding: 8px 10px;
  border: 1px solid rgb(255 255 255 / .18);
  border-radius: 8px;
  background: transparent;
  color: inherit;
  text-align: left;
}

.shell-search-trigger kbd {
  font: inherit;
  white-space: nowrap;
  opacity: .72;
}

.global-search-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1800;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: min(12vh, 96px) 16px 16px;
  background: rgb(24 32 29 / .48);
}

.global-search-backdrop[hidden] {
  display: none !important;
}

.global-search-panel {
  width: min(100%, 680px);
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-secondary);
}

.global-search-input-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--border);
}

.global-search-input-row input,
.global-search-input-row button {
  min-height: 44px;
}

.global-search-hint,
.global-search-status,
.global-search-empty {
  margin: 0;
  padding: 10px 14px;
  color: var(--text-secondary);
  font-size: 13px;
}

.global-search-results {
  max-height: min(56vh, 520px);
  overflow-y: auto;
  border-block: 1px solid var(--border-light);
}

.global-search-group h3 {
  margin: 0;
  padding: 8px 14px;
  color: var(--text-secondary);
  font-size: 11px;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.global-search-option {
  display: grid;
  width: 100%;
  min-height: 48px;
  padding: 9px 14px;
  border: 0;
  border-top: 1px solid var(--border-light);
  background: transparent;
  color: var(--text-primary);
  text-align: left;
}

.global-search-option.active,
.global-search-option:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  background: var(--accent-light);
}

.global-search-option-title {
  font-weight: 650;
}

.global-search-option-subtitle {
  color: var(--text-secondary);
  font-size: 12px;
}
```

- [ ] **Step 7: Verify all search states and commit**

Run: `node --test tests/search.test.mjs tests/global-search.test.mjs`

Expected: 10 tests PASS.

Run: `npm.cmd test`

Expected: all tests PASS.

Manual keyboard check with loaded fixture data:

1. Press `Ctrl+K` on Windows/Linux or `Cmd+K` on macOS; focus lands in the search field.
2. An empty query says `Inizia a scrivere per cercare nella struttura.`.
3. Search an accented guest without accents, a document number, a phone fragment, and a room type.
4. Use Down, Up, Enter, and Escape without the pointer.
5. Confirm Enter changes to the canonical hash and opens exactly one matching detail.
6. Force `ui.dataStatus='loading'` and confirm the loading message replaces results.
7. Search an absent value and confirm the no-result message and live status.
8. Close the panel and confirm focus returns to the search trigger.

```bash
git add js/features/global-search.js tests/global-search.test.mjs index.html script.js css/14-reception-shell.css
git commit -m 'feat: add keyboard global search'
```

### Task 7: Lock the phase integration contract

**Files:**
- Create: `tests/shell-search-integration.test.mjs`
- Verify: `index.html`, `script.js`, `js/core/store.js`, `js/core/router.js`, `js/core/search.js`, `js/features/app-shell.js`, `js/features/settings.js`, `js/features/global-search.js`, `js/ui/dialog.js`, `js/ui/network-status.js`

- [ ] **Step 1: Add a static integration guard**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync('index.html', 'utf8');
const main = fs.readFileSync('script.js', 'utf8');
const globalSearch = fs.readFileSync('js/features/global-search.js', 'utf8');

test('core modules load in dependency order before the composition root', () => {
  const paths = [
    'js/core/preferences.js',
    'js/core/store.js',
    'js/core/router.js',
    'js/core/search.js',
    'js/ui/dialog.js',
    'js/ui/network-status.js',
    'js/ui/feedback.js',
    'js/features/app-shell.js',
    'js/features/settings.js',
    'js/features/global-search.js',
    'script.js'
  ];
  const positions = paths.map((path) => html.indexOf(path));
  positions.forEach((position) => assert.notEqual(position, -1));
  for (let index = 1; index < positions.length; index += 1) {
    assert.ok(positions[index] > positions[index - 1], `${paths[index]} must load after ${paths[index - 1]}`);
  }
});

test('the composition root connects shell and search to the shared store', () => {
  assert.match(main, /store: appStore/);
  assert.match(main, /GroupStayRouter\.createRouter/);
  assert.match(main, /GroupStayGlobalSearch\.init/);
  assert.match(main, /replaceCoreDataSlice/);
  assert.match(main, /commitLoadedState/);
});

test('global search remains client-only', () => {
  assert.doesNotMatch(globalSearch, /\bfetch\s*\(/);
  assert.doesNotMatch(globalSearch, /\bapi(Get|Post|Put|Delete)\s*\(/);
  assert.doesNotMatch(globalSearch, /localStorage|sessionStorage/);
});

test('legacy page navigation and settings modal are absent from the shell', () => {
  assert.doesNotMatch(html, /data-page=/);
  assert.doesNotMatch(html, /id='settingsModal'/);
  assert.doesNotMatch(html, /href='#'/);
  assert.doesNotMatch(html, /page-mail|nav\.mail/);
});
```

- [ ] **Step 2: Run the complete phase suite**

Run:

```powershell
node --test tests/store.test.mjs tests/router.test.mjs tests/app-shell.test.mjs tests/shell-contract.test.mjs tests/search.test.mjs tests/dialog.test.mjs tests/network-status.test.mjs tests/global-search.test.mjs tests/shell-search-integration.test.mjs
```

Expected: 32 tests PASS and 0 FAIL.

Run: `npm.cmd test`

Expected: all repository tests PASS and 0 FAIL.

- [ ] **Step 3: Prove the serverless boundary and storage boundary did not regress**

Run:

```powershell
$publicRoutes = Get-ChildItem api -File -Filter '*.js' | Where-Object { $_.Name -notlike '_*' }
$publicRoutes.Count
```

Expected: `11`, inherited from Phase 01. No file in the Phase 02 commit list is under `api/`.

Run:

```powershell
rg -n 'localStorage|sessionStorage' js/core/store.js js/core/router.js js/core/search.js js/features/app-shell.js js/features/settings.js js/features/global-search.js
```

Expected: no matches. `GroupStayPreferences` is the only persistence adapter used by settings.

- [ ] **Step 4: Perform the phase acceptance walkthrough**

At 1440, 1024, 768, 375, and 320 CSS pixels confirm:

1. Oggi, Planning, Prenotazioni, Ospiti, and Camere are one click away on desktop.
2. Mobile exposes Oggi, Planning, Prenotazioni, and Camere directly; Ospiti, Gestione, Sicurezza, and Impostazioni require exactly one additional tap through Altro.
3. Direct hashes, refresh, Back, Forward, and an unknown hash all show one non-empty page.
4. The dedicated settings page saves only language, planner dimensions, and floor range; no modal or Mail control remains.
5. Search opens from both a visible trigger and `Ctrl/Cmd+K`, supports pointer and keyboard selection, and restores focus.
6. Simulated offline and rejected network requests keep a persistent retry banner visible without clearing forms.
7. No console error appears in these flows and no unintended horizontal overflow appears; Planning remains the documented horizontal-scroll exception.

- [ ] **Step 5: Check the diff and commit the integration guard**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: only the planned Phase 02 files are modified or untracked.

```bash
git add tests/shell-search-integration.test.mjs
git commit -m 'test: lock reception shell and search contracts'
```

## Phase 02 completion gate

Phase 02 is complete only when every task commit exists, all focused and full tests pass, the public route count is still exactly 11, canonical hashes survive history navigation and refresh, search never performs a network call, dialogs restore focus, and no sensitive or operational data is persisted by the new modules. Phase 03 may then consume `window.appStore`, `GroupStayRouter`, and the shared dialog/network contracts without recreating them.
