# Reception Core Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the unused Mail subsystem and establish a secure, migration-controlled foundation for the Reception Core without adding any public serverless route.

**Architecture:** Keep the build-free vanilla JavaScript frontend and the existing Vercel route topology, but make authentication cookie-only, browser persistence preference-only, database changes deployment-controlled, and public errors stable and safe. New reusable helpers live in underscore-prefixed API modules or focused browser core modules, so the public route count falls from 12 to exactly 11 when `api/init.js` is removed.

**Tech Stack:** Vanilla JavaScript (browser IIFEs and ES modules), Node.js test runner, Vercel Functions, Neon PostgreSQL, JSON hosting configuration

---

## File map and fixed contracts

This phase owns only foundation concerns. Booking lifecycle fields are introduced by Phase 03; room housekeeping fields are introduced by Phase 04; the final removal of every inline handler and the strict CSP without `unsafe-inline` belong to Phase 05.

The contracts established here are:

- `window.GroupStayApi.AppError` has `{ status, code, message, fieldErrors, conflicts }`; every API verb uses cookies through `credentials: 'include'` and never reads or writes a bearer token.
- `window.GroupStayPreferences` stores one allowlisted object under `gs_preferences_v1` and exposes `get(key, fallback)`, `set(key, value)`, and `snapshot()`.
- `api/_http.js` is the only formatter for new public API errors; internal exceptions are logged server-side and become `INTERNAL_ERROR` without raw details.
- `scripts/lib/migration-runner.mjs` executes ordered idempotent migrations recorded in `schema_migrations`; database DDL never runs from a request handler.
- `api/_alloggiati-auth.js` denies access unless the authenticated user id exactly matches a comma-separated entry in `ALLOGGIATI_ALLOWED_USER_IDS`.
- Public route files are the eleven non-underscore `.js` files listed in Task 4. Helpers beginning with `_` do not create Vercel routes.

### Task 1: Remove Mail as a product and dependency

**Files:**
- Create: `tests/mail-removal-contract.test.mjs`
- Modify: `index.html`
- Modify: `script.js`
- Modify: `api/auth.js`
- Modify: `api/reservations.js`
- Modify: `js/features/reservation-detail.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Delete: `api/_mail.js`
- Delete: `api/_mail-utils.js`
- Delete: `api/_mail-crypto.js`
- Delete: `js/features/mail.js`
- Delete: `js/features/mail-ui.js`
- Delete: `css/12-new-mail.css`
- Delete: `tests/mail-crypto.test.mjs`
- Delete: `tests/mail-feature.test.mjs`
- Delete: `tests/mail-service.test.mjs`
- Delete: `tests/mail-utils.test.mjs`

- [ ] **Step 1: Write the failing removal contract**

```js
// tests/mail-removal-contract.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const removedFiles = [
  'api/_mail.js',
  'api/_mail-utils.js',
  'api/_mail-crypto.js',
  'js/features/mail.js',
  'js/features/mail-ui.js',
  'css/12-new-mail.css',
  'tests/mail-crypto.test.mjs',
  'tests/mail-feature.test.mjs',
  'tests/mail-service.test.mjs',
  'tests/mail-utils.test.mjs'
];

const activeFiles = [
  'index.html',
  'script.js',
  'api/auth.js',
  'api/reservations.js',
  'js/features/reservation-detail.js'
];

test('Mail production and test files are absent', () => {
  for (const file of removedFiles) {
    assert.equal(fs.existsSync(file), false, `${file} must be deleted`);
  }
});

test('active application surfaces contain no Mail feature hooks', () => {
  const source = activeFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  const forbidden = [
    'page-mail', 'nav.mail', 'MailUI', 'GroupStayMail', 'mailAccount',
    'mailMessages', 'mailList', 'mailDetail', 'syncMail', 'saveMailSettings',
    'testMailConnection', 'mailDetailModal', '12-new-mail.css', './_mail.js'
  ];
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `found removed Mail token: ${token}`);
  }
});

test('Mail transport packages are absent from manifests', () => {
  const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const lock = fs.readFileSync('package-lock.json', 'utf8');
  for (const dependency of ['imapflow', 'mailparser', 'nodemailer']) {
    assert.equal(manifest.dependencies?.[dependency], undefined);
    assert.equal(lock.includes(`node_modules/${dependency}`), false);
  }
});
```

- [ ] **Step 2: Run the contract and confirm the intended failure**

Run: `node --test tests/mail-removal-contract.test.mjs`

Expected: FAIL reporting `api/_mail.js must be deleted` and the three dependencies still present.

- [ ] **Step 3: Delete Mail-only files and package dependencies**

Run: `npm.cmd uninstall imapflow mailparser nodemailer`

Expected: `package.json` and `package-lock.json` no longer contain those packages; npm reports zero vulnerabilities.

Delete exactly the ten files listed under **Delete**. Do not retain stubs, archived copies, feature flags, or hidden imports in shipped paths.

- [ ] **Step 4: Remove every Mail surface and wiring point**

In `index.html`, remove the `css/12-new-mail.css` link, desktop and mobile Mail navigation entries, `#page-mail`, compose/assign overlays, `#mailDetailModal`, the `.settings-mail-section`, and both Mail script tags.

In `script.js`, remove the Mail dependency injection blocks near the feature initialization, `mailAccount` and `mailMessages`, the conditional Mail fetch from `loadAllData`, Mail state from `applyAuthState` and logout, all translation entries whose key is `nav.mail` or starts with `mail.`, the eleven Mail wrapper functions, the `case 'mail'` navigation branch, `mail` from mobile-more routing, and all three boot-time Mail branches. Preserve reservation and guest email fields: ordinary contact email is not the removed Mail product.

Make the main data load resolve only the five active datasets:

```js
const [resData, roomData, guestData, empData, agendaData] = await Promise.all([
  apiGet(API.reservations),
  apiGet(API.rooms),
  apiGet(API.guests),
  apiGet(API.employees).catch(() => ({
    employees: [], workEntries: [], monthOverrides: [], advances: []
  })),
  apiGet(API.agenda).catch(() => [])
]);
```

In `api/auth.js`, keep only authentication and management-PIN imports:

```js
import crypto from 'node:crypto';
import {
  createSession,
  destroySession,
  getAuthenticatedUser,
  hashPassword,
  verifyPassword
} from './_auth.js';
import { ensureAuthTables, getSQL } from './_db.js';
```

The authenticated `GET /api/auth` result becomes:

```js
return res.status(200).json({
  user,
  managementPinEnabled: Boolean(rows[0]?.management_pin_hash)
});
```

In `api/reservations.js`, remove the `_mail.js` import and the actions `mailList`, `mailDetail`, `mailSync`, `mailAssign`, and `mailSend`. The normal reservation email columns remain unchanged. In `js/features/reservation-detail.js`, delete only the linked-Mail section; retain the contact-email row.

- [ ] **Step 5: Verify removal and the remaining regression suite**

Run: `node --test tests/mail-removal-contract.test.mjs`

Expected: PASS, 3 tests.

Run: `npm.cmd test`

Expected: PASS; the four Mail test files are no longer discovered and every non-Mail baseline test remains green.

Run: `rg -n 'page-mail|nav\.mail|MailUI|GroupStayMail|mailAccount|mailMessages|mailList|mailDetail|syncMail|saveMailSettings|testMailConnection|12-new-mail|_mail' index.html script.js api js css package.json package-lock.json tests`

Expected: no matches. Matches for ordinary `email` fields are acceptable and must not be removed.

- [ ] **Step 6: Commit the complete feature removal**

```bash
git add -A
git commit -m 'refactor: remove unused mail subsystem'
```

### Task 2: Make authentication cookie-only and normalize browser API failures

**Files:**
- Create: `api/_http.js`
- Create: `tests/auth-security.test.mjs`
- Create: `tests/api-client.test.mjs`
- Modify: `api/_auth.js`
- Modify: `api/auth.js`
- Modify: `js/core/api-client.js`
- Modify: `index.html`
- Modify: `script.js`

- [ ] **Step 1: Write cookie and registration security tests**

```js
// tests/auth-security.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import authHandler from '../api/auth.js';

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader() {}
  };
}

test('registration fails closed before database access', async () => {
  delete process.env.PUBLIC_REGISTRATION_ENABLED;
  const req = {
    method: 'POST',
    query: { action: 'register' },
    body: { email: 'new@example.it', password: 'password123' },
    headers: {}
  };
  const res = responseRecorder();
  await authHandler(req, res);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    error: { code: 'REGISTRATION_DISABLED', message: 'Registrazione pubblica non disponibile' }
  });
});

test('authentication source accepts only the HttpOnly cookie', () => {
  const auth = fs.readFileSync('api/_auth.js', 'utf8');
  const handler = fs.readFileSync('api/auth.js', 'utf8');
  assert.equal(auth.includes('x-session-token'), false);
  assert.equal(auth.includes('X-Session-Token'), false);
  assert.equal(handler.includes('sessionToken'), false);
  assert.match(auth, /HttpOnly/);
  assert.match(auth, /SameSite=Lax/);
});

test('public login UI has no registration or remembered-password controls', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const script = fs.readFileSync('script.js', 'utf8');
  for (const token of ['registerForm', 'authTabRegister', 'loginRemember', 'submitRegister', 'REMEMBERED_LOGIN_KEY']) {
    assert.equal((html + script).includes(token), false, token);
  }
});
```

- [ ] **Step 2: Run the auth test and confirm it fails**

Run: `node --test tests/auth-security.test.mjs`

Expected: FAIL because registration currently reaches the database, the header token is accepted, and registration/remember controls still exist.

- [ ] **Step 3: Write API client behavior tests**

```js
// tests/api-client.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadClient(fetchImpl) {
  const context = { window: {}, fetch: fetchImpl, URLSearchParams };
  vm.runInNewContext(fs.readFileSync('js/core/api-client.js', 'utf8'), context);
  return context.window.GroupStayApi;
}

test('all verbs send cookies and never add a bearer header', async () => {
  const calls = [];
  const api = loadClient(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  });
  await api.apiGet('/api/rooms');
  await api.apiPost('/api/rooms', { id: 'r1' });
  await api.apiPut('/api/rooms', { id: 'r1' });
  await api.apiDelete('/api/rooms', 'r1');
  assert.equal(calls.length, 4);
  for (const call of calls) {
    assert.equal(call.options.credentials, 'include');
    assert.equal('X-Session-Token' in (call.options.headers || {}), false);
    assert.equal('Authorization' in (call.options.headers || {}), false);
  }
});

test('failure payload becomes the stable AppError shape', async () => {
  const api = loadClient(async () => ({
    ok: false,
    status: 409,
    json: async () => ({
      error: {
        code: 'ROOM_AVAILABILITY_CONFLICT',
        message: 'La camera non è disponibile',
        fieldErrors: { roomIds: 'Seleziona un’altra camera' },
        conflicts: [{ roomId: 'r1', reservationId: 'res2' }]
      }
    })
  }));
  await assert.rejects(
    api.apiPost('/api/reservations', {}),
    (error) => error.name === 'AppError'
      && error.status === 409
      && error.code === 'ROOM_AVAILABILITY_CONFLICT'
      && error.fieldErrors.roomIds === 'Seleziona un’altra camera'
      && error.conflicts[0].reservationId === 'res2'
  );
});

test('invalid or server error bodies use a generic safe message', async () => {
  const api = loadClient(async () => ({
    ok: false,
    status: 500,
    json: async () => { throw new Error('not json'); }
  }));
  await assert.rejects(
    api.apiGet('/api/rooms'),
    (error) => error.code === 'INTERNAL_ERROR'
      && error.message === 'Si è verificato un errore. Riprova.'
  );
});
```

- [ ] **Step 4: Run the client test and confirm it fails**

Run: `node --test tests/api-client.test.mjs`

Expected: FAIL because the current client reads `localStorage`, adds `X-Session-Token`, and does not expose `AppError`.

- [ ] **Step 5: Add the server error formatter and close registration by default**

```js
// api/_http.js
export function sendApiError(
  res,
  status,
  code,
  message,
  { fieldErrors, conflicts } = {}
) {
  const error = { code, message };
  if (fieldErrors && Object.keys(fieldErrors).length > 0) error.fieldErrors = fieldErrors;
  if (Array.isArray(conflicts) && conflicts.length > 0) error.conflicts = conflicts;
  return res.status(status).json({ error });
}

export function sendInternalError(res, context, error) {
  console.error(`[${context}]`, {
    name: error?.name || 'Error',
    code: error?.code || 'UNEXPECTED'
  });
  return sendApiError(
    res,
    500,
    'INTERNAL_ERROR',
    'Si è verificato un errore. Riprova.'
  );
}

export function sendMethodNotAllowed(res) {
  return sendApiError(res, 405, 'METHOD_NOT_ALLOWED', 'Metodo non consentito');
}
```

Import `sendApiError`, `sendInternalError`, and `sendMethodNotAllowed` in `api/auth.js`. Compute the action before initializing SQL, and add this guard before the `try` block:

```js
const action = req.query.action || req.body?.action;

if (
  req.method === 'POST'
  && action === 'register'
  && process.env.PUBLIC_REGISTRATION_ENABLED !== 'true'
) {
  return sendApiError(
    res,
    403,
    'REGISTRATION_DISABLED',
    'Registrazione pubblica non disponibile'
  );
}
```

Keep the existing registration implementation only behind that explicit server environment switch. Replace the auth handler's method response with `sendMethodNotAllowed(res)`, its unauthenticated responses with `sendApiError(res, 401, 'UNAUTHORIZED', 'Sessione non valida o scaduta')`, and its outer catch with `sendInternalError(res, 'auth', error)`.

- [ ] **Step 6: Remove the JavaScript-readable session token**

In `api/_auth.js`, make the cookie the only token source:

```js
function getSessionToken(req) {
  return parseCookies(req)[SESSION_COOKIE] || null;
}
```

`createSession(res, userId)` still generates and stores the database token and sets the HttpOnly cookie, but it returns no value. Update both successful auth actions as follows:

```js
await createSession(res, id);
return res.status(201).json({ user: sanitizeUser(created[0]) });

// login branch
await createSession(res, rows[0].id);
return res.status(200).json({ user: sanitizeUser(rows[0]) });
```

Do not weaken `HttpOnly`, `SameSite=Lax`, `Path=/`, expiry, or production `Secure` attributes.

- [ ] **Step 7: Replace the API client with one cookie-only request path**

```js
// js/core/api-client.js
(function initApiClient(global) {
  const SAFE_MESSAGES = {
    401: 'Sessione scaduta. Accedi di nuovo.',
    403: 'Non hai i permessi per questa operazione.',
    409: 'L’operazione è in conflitto con dati aggiornati.',
    500: 'Si è verificato un errore. Riprova.'
  };

  class AppError extends Error {
    constructor({ status = 0, code = 'REQUEST_FAILED', message, fieldErrors, conflicts } = {}) {
      super(message || 'Richiesta non riuscita');
      this.name = 'AppError';
      this.status = status;
      this.code = code;
      this.fieldErrors = fieldErrors || {};
      this.conflicts = Array.isArray(conflicts) ? conflicts : [];
    }
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  function toAppError(status, payload) {
    const raw = payload?.error;
    const details = raw && typeof raw === 'object'
      ? raw
      : { message: typeof raw === 'string' ? raw : '' };
    const isServerError = status >= 500;
    return new AppError({
      status,
      code: isServerError ? 'INTERNAL_ERROR' : (details.code || 'REQUEST_FAILED'),
      message: isServerError
        ? SAFE_MESSAGES[500]
        : (details.message || SAFE_MESSAGES[status] || 'Richiesta non riuscita'),
      fieldErrors: details.fieldErrors,
      conflicts: details.conflicts
    });
  }

  async function request(url, { method = 'GET', data } = {}) {
    const headers = data === undefined ? {} : { 'Content-Type': 'application/json' };
    const response = await fetch(url, {
      method,
      credentials: 'include',
      headers,
      ...(data === undefined ? {} : { body: JSON.stringify(data) })
    });
    const payload = response.status === 204 ? null : await readJson(response);
    if (!response.ok) throw toAppError(response.status, payload);
    return payload;
  }

  const apiGet = (url) => request(url);
  const apiPost = (url, data) => request(url, { method: 'POST', data });
  const apiPut = (url, data) => request(url, { method: 'PUT', data });
  const apiDelete = (url, id) => {
    const separator = url.includes('?') ? '&' : '?';
    return request(`${url}${separator}id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  };

  global.GroupStayApi = { AppError, apiDelete, apiGet, apiPost, apiPut };
})(window);
```

Delete `SESSION_TOKEN_KEY`, `inMemorySessionToken`, token headers, token persistence, `primeSessionToken`, and `clearSessionToken`; do not keep no-op compatibility exports.

- [ ] **Step 8: Reduce the login surface to provisioned-account access**

In `index.html`, delete the auth tabs, `#registerForm`, both create-account switches, and the `#loginRemember` checkbox and copy. Keep one heading, one email field, one current-password field, `#loginError`, `#authDebug`, and the submit button. The resulting form contract is:

```html
<form id='loginForm' class='auth-form' onsubmit='submitLogin(event)'>
  <div class='form-group'>
    <label for='loginEmail'>Email</label>
    <input type='email' id='loginEmail' autocomplete='email' required>
  </div>
  <div class='form-group'>
    <label for='loginPassword'>Password</label>
    <input type='password' id='loginPassword' autocomplete='current-password' required>
  </div>
  <p class='auth-error' id='loginError' role='alert'></p>
  <p class='auth-debug' id='authDebug' aria-live='polite'></p>
  <button type='submit' class='btn btn-primary auth-submit'>Accedi</button>
</form>
```

In `script.js`, remove `currentAuthMode`, all remembered-login functions, `switchAuthMode`, `submitRegister`, registration error handling, token priming/clearing, registration resets, and the persistent cache removal from logout. The login success path is:

```js
const data = await apiPost(`${API.auth}?action=login`, { email, password });
currentUser = data.user;
authStateLoaded = false;
updateProfileHeader();
const sessionUser = await ensureSessionReady();
if (!sessionUser) throw new Error('Sessione non confermata. Riprova tra un attimo.');
setAuthLocked(false);
await startApplication(true);
```

- [ ] **Step 9: Run focused and full verification**

Run: `node --test tests/auth-security.test.mjs tests/api-client.test.mjs tests/mail-removal-contract.test.mjs`

Expected: PASS, 9 tests.

Run: `npm.cmd test`

Expected: PASS with no session-token, Mail, or registration regressions.

Run: `rg -n 'gs_session_token|X-Session-Token|x-session-token|sessionToken|primeSessionToken|clearSessionToken|gs_remembered_login|loginRemember|registerForm|submitRegister' api js script.js index.html tests`

Expected: no matches except the negative assertions inside `tests/auth-security.test.mjs`.

- [ ] **Step 10: Commit the authentication boundary**

```bash
git add api/_http.js api/_auth.js api/auth.js js/core/api-client.js index.html script.js tests/auth-security.test.mjs tests/api-client.test.mjs
git commit -m 'security: use cookie-only sessions'
```

### Task 3: Restrict browser persistence to allowlisted preferences

**Files:**
- Create: `js/core/preferences.js`
- Create: `tests/preferences.test.mjs`
- Create: `tests/browser-storage-contract.test.mjs`
- Modify: `js/core/config.js`
- Modify: `index.html`
- Modify: `script.js`
- Delete: `js/core/bootstrap.js`
- Delete: `tests/bootstrap.test.mjs`

- [ ] **Step 1: Write the preference-store unit tests**

```js
// tests/preferences.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function createStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    keys() { return [...values.keys()]; }
  };
}

function loadPreferences(storage) {
  const context = { window: { localStorage: storage } };
  vm.runInNewContext(fs.readFileSync('js/core/preferences.js', 'utf8'), context);
  return context.window.GroupStayPreferences;
}

test('stores only sanitized allowlisted preferences under one key', () => {
  const storage = createStorage({ gs_session_token: 'secret', 'gs_data_cache:u1': 'pii' });
  const preferences = loadPreferences(storage);
  preferences.set('language', 'en');
  preferences.set('plannerDimensions', { dayWidth: 999, rowHeight: 20 });
  preferences.set('plannerFloorRange', { start: 4, end: -2 });
  preferences.set('sidebarCollapsed', true);
  assert.deepEqual(storage.keys(), ['gs_preferences_v1']);
  assert.equal(preferences.get('language'), 'en');
  assert.deepEqual(
    JSON.parse(JSON.stringify(preferences.get('plannerDimensions'))),
    { dayWidth: 80, rowHeight: 28 }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(preferences.get('plannerFloorRange'))),
    { start: -2, end: 4 }
  );
  assert.equal(preferences.get('sidebarCollapsed'), true);
});

test('rejects unknown keys and recovers from malformed JSON', () => {
  const storage = createStorage({ gs_preferences_v1: '{bad json' });
  const preferences = loadPreferences(storage);
  assert.equal(preferences.get('language', 'it'), 'it');
  assert.throws(() => preferences.set('password', 'secret'), /Unknown preference/);
  assert.deepEqual(
    JSON.parse(JSON.stringify(preferences.snapshot())),
    {
      language: 'it',
      plannerDimensions: { dayWidth: 38, rowHeight: 34 },
      plannerFloorRange: null,
      sidebarCollapsed: false
    }
  );
});
```

- [ ] **Step 2: Run the unit test and confirm it fails**

Run: `node --test tests/preferences.test.mjs`

Expected: FAIL with `ENOENT: js/core/preferences.js`.

- [ ] **Step 3: Write the browser-storage contract**

```js
// tests/browser-storage-contract.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function activeBrowserSources() {
  const core = fs.readdirSync('js/core')
    .filter((name) => name.endsWith('.js') && name !== 'preferences.js')
    .map((name) => `js/core/${name}`);
  const features = fs.readdirSync('js/features')
    .filter((name) => name.endsWith('.js'))
    .map((name) => `js/features/${name}`);
  return ['script.js', ...core, ...features];
}

test('only the preference module touches localStorage', () => {
  for (const file of activeBrowserSources()) {
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(source.includes('localStorage'), false, file);
  }
});

test('persistent PII cache and browser bootstrap are absent', () => {
  const source = [
    fs.readFileSync('script.js', 'utf8'),
    fs.readFileSync('js/core/config.js', 'utf8'),
    fs.readFileSync('index.html', 'utf8')
  ].join('\n');
  for (const token of ['CACHE_KEY', 'CACHE_TTL', 'saveDataCache', 'loadDataCache', 'GroupStayBootstrap', '/api/init']) {
    assert.equal(source.includes(token), false, token);
  }
  assert.equal(fs.existsSync('js/core/bootstrap.js'), false);
  assert.equal(fs.existsSync('tests/bootstrap.test.mjs'), false);
});
```

- [ ] **Step 4: Run the storage contract and confirm it fails**

Run: `node --test tests/browser-storage-contract.test.mjs`

Expected: FAIL on direct `localStorage` calls, cache symbols, and both bootstrap files.

- [ ] **Step 5: Implement the allowlisted preference module**

```js
// js/core/preferences.js
(function initPreferences(global) {
  const STORAGE_KEY = 'gs_preferences_v1';
  const DEFAULTS = Object.freeze({
    language: 'it',
    plannerDimensions: Object.freeze({ dayWidth: 38, rowHeight: 34 }),
    plannerFloorRange: null,
    sidebarCollapsed: false
  });

  const clampInt = (value, min, max, fallback) => {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };

  function sanitize(key, value) {
    if (key === 'language') return value === 'en' ? 'en' : 'it';
    if (key === 'sidebarCollapsed') return value === true;
    if (key === 'plannerDimensions') {
      return {
        dayWidth: clampInt(value?.dayWidth, 24, 80, 38),
        rowHeight: clampInt(value?.rowHeight, 28, 64, 34)
      };
    }
    if (key === 'plannerFloorRange') {
      if (!value || typeof value !== 'object') return null;
      const first = clampInt(value.start, -20, 200, 0);
      const second = clampInt(value.end, -20, 200, first);
      return { start: Math.min(first, second), end: Math.max(first, second) };
    }
    throw new TypeError(`Unknown preference: ${key}`);
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  let storage = null;
  try {
    storage = global.localStorage;
  } catch {
    storage = null;
  }

  function purgeDisallowedStorage() {
    if (!storage) return;
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .filter(Boolean);
    for (const key of keys) {
      if (key.startsWith('gs_') && key !== STORAGE_KEY) storage.removeItem(key);
    }
  }

  function read() {
    let candidate = {};
    try {
      candidate = JSON.parse(storage?.getItem(STORAGE_KEY) || '{}');
    } catch {
      candidate = {};
    }
    return {
      language: sanitize('language', candidate.language),
      plannerDimensions: sanitize('plannerDimensions', candidate.plannerDimensions),
      plannerFloorRange: sanitize('plannerFloorRange', candidate.plannerFloorRange),
      sidebarCollapsed: sanitize('sidebarCollapsed', candidate.sidebarCollapsed)
    };
  }

  purgeDisallowedStorage();
  let state = read();

  function persist() {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function get(key, fallback) {
    return Object.prototype.hasOwnProperty.call(DEFAULTS, key)
      ? clone(state[key])
      : fallback;
  }

  function set(key, value) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
      throw new TypeError(`Unknown preference: ${key}`);
    }
    state = { ...state, [key]: sanitize(key, value) };
    persist();
    return get(key);
  }

  function snapshot() {
    return clone(state);
  }

  global.GroupStayPreferences = { get, set, snapshot };
})(window);
```

The module deliberately removes every legacy `gs_*` key except its single allowlisted object. This purges remembered credentials, session tokens, decrypted entity caches, PIN remnants, bootstrap markers, and superseded planner keys on first load.

- [ ] **Step 6: Wire preferences and remove cache/bootstrap behavior**

In `js/core/config.js`, remove `API.init`, `CACHE_KEY`, and `CACHE_TTL`. In `index.html`, replace the bootstrap script with the preference script immediately after config:

```html
<script src='js/core/config.js'></script>
<script src='js/core/preferences.js'></script>
<script src='js/core/api-client.js'></script>
```

Delete `js/core/bootstrap.js` and `tests/bootstrap.test.mjs`. In `script.js`, remove the bootstrap destructuring, `saveDataCache`, `loadDataCache`, `getBootstrapStorage`, `ensureBootstrapSchema`, every invocation of those functions, and the legacy management-PIN migration that reads `gs_emp_pin`.

Read and write the four preferences only through the shared module:

```js
const preferences = window.GroupStayPreferences;
let currentLang = preferences.get('language', 'it');
let PLANNER_ROW_HEIGHT = preferences.get('plannerDimensions').rowHeight;

function setLanguage(lang) {
  currentLang = preferences.set('language', lang);
  applyTranslations();
  updateProfileHeader();
  const activePage = document.querySelector('.page.active');
  if (activePage) navigateTo(activePage.id.replace('page-', ''));
}

function getRoomFloorRange() {
  const fallback = inferFloorRange(rooms);
  return parseFloorRange(preferences.get('plannerFloorRange', fallback), fallback);
}

function setRoomFloorRange(start, end) {
  const range = normalizeFloorRange(start, end, getRoomFloorRange());
  return preferences.set('plannerFloorRange', range);
}

function savePlannerDimensions(dayWidth, rowHeight) {
  const dimensions = preferences.set('plannerDimensions', { dayWidth, rowHeight });
  PLANNER_DAY_WIDTH = dimensions.dayWidth;
  PLANNER_ROW_HEIGHT = dimensions.rowHeight;
  return dimensions;
}
```

Change `updateCalendarSize` and `initSettingsModal` to call `savePlannerDimensions` and `preferences.get('plannerDimensions')`. Do not persist any entity arrays. The startup path always awaits a fresh server load:

```js
showLoading('Caricamento dati...');
const ok = await loadAllData();
hideLoading();
if (!ok) {
  appStarting = false;
  return false;
}
await nextPaint();
if (getBootPage() === 'calendar') renderCalendar();
else renderDashboard();
```

- [ ] **Step 7: Verify storage policy and regressions**

Run: `node --test tests/preferences.test.mjs tests/browser-storage-contract.test.mjs`

Expected: PASS, 4 tests.

Run: `npm.cmd test`

Expected: PASS.

Run: `rg -n 'localStorage' script.js js --glob '*.js'`

Expected: matches only in `js/core/preferences.js`.

Run: `rg -n 'gs_data_cache|gs_session_token|gs_remembered_login|gs_emp_pin|gs_init_cache|gs_lang|gs_col_width|gs_row_height|gs_room_floor_range' script.js js index.html`

Expected: no matches.

- [ ] **Step 8: Commit the browser-storage boundary**

```bash
git add -A
git commit -m 'security: restrict persistent browser storage'
```

### Task 4: Add a deterministic migration runner

**Files:**
- Create: `scripts/lib/migration-runner.mjs`
- Create: `tests/migration-runner.test.mjs`

- [ ] **Step 1: Write runner tests for ordering, dry-run, and idempotency**

```js
// tests/migration-runner.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { runMigrations } from '../scripts/lib/migration-runner.mjs';

function createSqlFake() {
  const applied = new Set();
  const statements = [];
  async function sql(strings, ...values) {
    const text = strings.join('?').replace(/\s+/g, ' ').trim();
    statements.push({ text, values });
    if (text.includes('SELECT id FROM schema_migrations')) {
      return [...applied].map((id) => ({ id }));
    }
    if (text.includes('INSERT INTO schema_migrations')) applied.add(values[0]);
    return [];
  }
  return { sql, applied, statements };
}

test('dry-run reports sorted migrations without touching the database', async () => {
  const fake = createSqlFake();
  const migrations = [
    { id: '002-second', up: async () => {} },
    { id: '001-first', up: async () => {} }
  ];
  const result = await runMigrations({ sql: fake.sql, migrations, apply: false });
  assert.deepEqual(result, [
    { id: '001-first', status: 'pending' },
    { id: '002-second', status: 'pending' }
  ]);
  assert.equal(fake.statements.length, 0);
});

test('apply records each migration and a second run skips it', async () => {
  const fake = createSqlFake();
  const calls = [];
  const migrations = [
    { id: '001-first', up: async ({ options }) => calls.push(['first', options.owner]) },
    { id: '002-second', up: async () => calls.push(['second']) }
  ];
  const first = await runMigrations({
    sql: fake.sql, migrations, apply: true, options: { owner: 'u1' }
  });
  const second = await runMigrations({ sql: fake.sql, migrations, apply: true });
  assert.deepEqual(calls, [['first', 'u1'], ['second']]);
  assert.deepEqual(first.map((entry) => entry.status), ['applied', 'applied']);
  assert.deepEqual(second.map((entry) => entry.status), ['skipped', 'skipped']);
});

test('duplicate or malformed migration ids are rejected', async () => {
  const fake = createSqlFake();
  await assert.rejects(
    runMigrations({
      sql: fake.sql,
      migrations: [
        { id: '001-valid', up: async () => {} },
        { id: '001-valid', up: async () => {} }
      },
      apply: false
    }),
    /unique/
  );
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --test tests/migration-runner.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `migration-runner.mjs`.

- [ ] **Step 3: Implement the minimal runner**

```js
// scripts/lib/migration-runner.mjs
function orderedMigrations(migrations) {
  const ordered = [...migrations].sort((a, b) => a.id.localeCompare(b.id));
  const ids = new Set();
  for (const migration of ordered) {
    if (!/^\d{3}-[a-z0-9-]+$/.test(migration.id) || typeof migration.up !== 'function') {
      throw new TypeError('Migration requires an id like 001-name and an up function');
    }
    if (ids.has(migration.id)) throw new TypeError('Migration ids must be unique');
    ids.add(migration.id);
  }
  return ordered;
}

export async function runMigrations({
  sql,
  migrations,
  apply = false,
  options = {},
  logger = console
}) {
  const ordered = orderedMigrations(migrations);
  if (!apply) return ordered.map(({ id }) => ({ id, status: 'pending' }));

  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  const rows = await sql`SELECT id FROM schema_migrations ORDER BY id`;
  const applied = new Set(rows.map((row) => row.id));
  const result = [];

  for (const migration of ordered) {
    if (applied.has(migration.id)) {
      result.push({ id: migration.id, status: 'skipped' });
      continue;
    }
    logger.info(`Applying ${migration.id}`);
    await migration.up({ sql, options });
    await sql`INSERT INTO schema_migrations (id) VALUES (${migration.id})`;
    result.push({ id: migration.id, status: 'applied' });
  }
  return result;
}
```

Migrations must themselves be idempotent because Neon HTTP statements are not treated as one implicit multi-statement transaction. The runner records an id only after its `up` function resolves.

- [ ] **Step 4: Run focused and full tests**

Run: `node --test tests/migration-runner.test.mjs`

Expected: PASS, 3 tests.

Run: `npm.cmd test`

Expected: PASS.

- [ ] **Step 5: Commit the runner**

```bash
git add scripts/lib/migration-runner.mjs tests/migration-runner.test.mjs
git commit -m 'chore: add controlled migration runner'
```

### Task 5: Move all schema mutation to migrations and reduce public routes to eleven

**Files:**
- Create: `scripts/migrate.mjs`
- Create: `scripts/migrations/001-baseline-schema.mjs`
- Create: `scripts/migrations/002-remove-mail.mjs`
- Create: `tests/schema-migrations.test.mjs`
- Create: `tests/api-route-contract.test.mjs`
- Modify: `package.json`
- Modify: `api/_db.js`
- Modify: `api/_auth.js`
- Modify: `api/auth.js`
- Modify: `api/alloggiati.js`
- Delete: `api/init.js`

- [ ] **Step 1: Write the route and no-runtime-DDL contract**

```js
// tests/api-route-contract.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const expectedRoutes = [
  'agenda.js',
  'alloggiati.js',
  'assignments.js',
  'auth.js',
  'compliance.js',
  'employees.js',
  'files.js',
  'guests.js',
  'menus.js',
  'reservations.js',
  'rooms.js'
];

test('the deployment exposes exactly eleven serverless route files', () => {
  const actual = fs.readdirSync('api')
    .filter((name) => name.endsWith('.js') && !name.startsWith('_'))
    .sort();
  assert.deepEqual(actual, expectedRoutes);
  assert.equal(fs.existsSync('api/init.js'), false);
});

test('request-time API code contains no schema DDL', () => {
  for (const name of fs.readdirSync('api').filter((file) => file.endsWith('.js'))) {
    const source = fs.readFileSync(path.join('api', name), 'utf8');
    assert.doesNotMatch(
      source,
      /\b(?:CREATE\s+TABLE|ALTER\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX|DROP\s+TABLE)\b/i,
      name
    );
  }
});

test('schema migration has a package command', () => {
  const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(manifest.scripts['migrate:schema'], 'node scripts/migrate.mjs');
});
```

- [ ] **Step 2: Run the route contract and confirm it fails**

Run: `node --test tests/api-route-contract.test.mjs`

Expected: FAIL because `api/init.js` is still the twelfth route and request handlers contain DDL.

- [ ] **Step 3: Write migration safety tests**

```js
// tests/schema-migrations.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import * as baseline from '../scripts/migrations/001-baseline-schema.mjs';
import * as removeMail from '../scripts/migrations/002-remove-mail.mjs';

function sqlFake({ unownedCount = 0, mailTables = [] } = {}) {
  const statements = [];
  async function sql(strings, ...values) {
    const text = strings.join('?').replace(/\s+/g, ' ').trim();
    statements.push({ text, values });
    if (text.includes('AS unowned_count')) return [{ unowned_count: unownedCount }];
    if (text.includes('FROM information_schema.tables')) {
      return mailTables.map((table_name) => ({ table_name }));
    }
    if (text.includes('SELECT id FROM users')) {
      return values[0] === 'owner-1' ? [{ id: 'owner-1' }] : [];
    }
    return [];
  }
  return { sql, statements };
}

test('baseline refuses an ambiguous legacy ownership backfill', async () => {
  const fake = sqlFake({ unownedCount: 2 });
  await assert.rejects(
    baseline.up({ sql: fake.sql, options: {} }),
    /--legacy-owner-user-id/
  );
});

test('baseline backfills only the explicitly selected existing owner', async () => {
  const fake = sqlFake({ unownedCount: 2 });
  await baseline.up({
    sql: fake.sql,
    options: { legacyOwnerUserId: 'owner-1' }
  });
  const source = fake.statements.map((entry) => entry.text).join('\n');
  assert.match(source, /UPDATE rooms SET owner_user_id/);
  assert.match(source, /UPDATE reservations SET owner_user_id/);
  assert.match(source, /UPDATE agenda_items SET owner_user_id/);
});

test('Mail tables require explicit backup acknowledgement before drop', async () => {
  const blocked = sqlFake({ mailTables: ['mail_accounts', 'mail_messages'] });
  await assert.rejects(
    removeMail.up({ sql: blocked.sql, options: {} }),
    /--ack-mail-backup/
  );

  const allowed = sqlFake({ mailTables: ['mail_accounts', 'mail_messages'] });
  await removeMail.up({
    sql: allowed.sql,
    options: { mailBackupAcknowledged: true }
  });
  const source = allowed.statements.map((entry) => entry.text).join('\n');
  assert.match(source, /DROP TABLE IF EXISTS mail_messages/);
  assert.match(source, /DROP TABLE IF EXISTS mail_accounts/);
});

test('fresh databases with no Mail tables need no acknowledgement', async () => {
  const fake = sqlFake({ mailTables: [] });
  await removeMail.up({ sql: fake.sql, options: {} });
  assert.equal(
    fake.statements.some((entry) => entry.text.includes('DROP TABLE')),
    false
  );
});
```

- [ ] **Step 4: Run the migration tests and confirm they fail**

Run: `node --test tests/schema-migrations.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `001-baseline-schema.mjs`.

- [ ] **Step 5: Build the idempotent baseline migration from existing schema code**

Create `scripts/migrations/001-baseline-schema.mjs` with `export const id = '001-baseline-schema'` and `export async function up({ sql, options })`. Relocate, without semantic rewriting, these existing SQL blocks into `up` before deleting their sources:

- all `users` and `auth_sessions` DDL from `ensureAuthTables` in `api/_db.js`;
- all DDL from `api/init.js` except `ensureMailTables`, the request-dependent ownership updates, and the response handler;
- the `alloggiati_submissions` table and index DDL currently duplicated in `ensureAlloggiatiSubmissionTable`.

The resulting baseline creates or upgrades exactly these tables: `users`, `auth_sessions`, `rooms`, `reservations`, `guests`, `room_assignments`, `planner_configs`, `employees`, `work_entries`, `employee_month_overrides`, `employee_advances`, `menus`, `daily_menus`, `reservation_files`, `compliance_certs`, `compliance_docs`, `agenda_items`, and `alloggiati_submissions`. Preserve every current column, foreign key, default, unique constraint, index, the room-number constraint repair, and the legacy `menus` to `daily_menus` copy. Do not create either Mail table.

Before any ownership update, count every nullable legacy owner:

```js
const [ownership] = await sql`
  SELECT (
    (SELECT COUNT(*) FROM rooms WHERE owner_user_id IS NULL) +
    (SELECT COUNT(*) FROM reservations WHERE owner_user_id IS NULL) +
    (SELECT COUNT(*) FROM guests WHERE owner_user_id IS NULL) +
    (SELECT COUNT(*) FROM room_assignments WHERE owner_user_id IS NULL) +
    (SELECT COUNT(*) FROM planner_configs WHERE owner_user_id IS NULL) +
    (SELECT COUNT(*) FROM employees WHERE owner_user_id IS NULL) +
    (SELECT COUNT(*) FROM work_entries WHERE owner_user_id IS NULL) +
    (SELECT COUNT(*) FROM employee_month_overrides WHERE owner_user_id IS NULL) +
    (SELECT COUNT(*) FROM employee_advances WHERE owner_user_id IS NULL) +
    (SELECT COUNT(*) FROM menus WHERE owner_user_id IS NULL) +
    (SELECT COUNT(*) FROM reservation_files WHERE owner_user_id IS NULL) +
    (SELECT COUNT(*) FROM compliance_certs WHERE owner_user_id IS NULL) +
    (SELECT COUNT(*) FROM compliance_docs WHERE owner_user_id IS NULL) +
    (SELECT COUNT(*) FROM agenda_items WHERE owner_user_id IS NULL)
  )::INTEGER AS unowned_count
`;

const legacyOwnerUserId = String(options.legacyOwnerUserId || '').trim();
if (Number(ownership.unowned_count) > 0 && !legacyOwnerUserId) {
  throw new Error(
    'Legacy rows have no owner; rerun with --legacy-owner-user-id=<existing-user-id>'
  );
}
```

When unowned rows exist, verify the selected owner and update every counted table explicitly:

```js
if (Number(ownership.unowned_count) > 0) {
  const owners = await sql`SELECT id FROM users WHERE id = ${legacyOwnerUserId} LIMIT 1`;
  if (owners.length === 0) {
    throw new Error('The --legacy-owner-user-id value does not identify an existing user');
  }
  await sql`UPDATE rooms SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
  await sql`UPDATE reservations SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
  await sql`UPDATE guests SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
  await sql`UPDATE room_assignments SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
  await sql`UPDATE planner_configs SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
  await sql`UPDATE employees SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
  await sql`UPDATE work_entries SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
  await sql`UPDATE employee_month_overrides SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
  await sql`UPDATE employee_advances SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
  await sql`UPDATE menus SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
  await sql`UPDATE reservation_files SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
  await sql`UPDATE compliance_certs SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
  await sql`UPDATE compliance_docs SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
  await sql`UPDATE agenda_items SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
}
```

Run the existing `menus` to `daily_menus` insert only after this block. In that insert, use `COALESCE(m.owner_user_id, r.owner_user_id)` because the migration has already rejected or repaired null ownership; never substitute the identity of a web request.

- [ ] **Step 6: Implement the guarded Mail-table removal migration**

```js
// scripts/migrations/002-remove-mail.mjs
export const id = '002-remove-mail';

export async function up({ sql, options }) {
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('mail_messages', 'mail_accounts')
    ORDER BY table_name
  `;
  if (tables.length === 0) return;
  if (options.mailBackupAcknowledged !== true) {
    throw new Error(
      'Mail tables exist; back them up and rerun with --ack-mail-backup'
    );
  }
  await sql`DROP TABLE IF EXISTS mail_messages`;
  await sql`DROP TABLE IF EXISTS mail_accounts`;
}
```

- [ ] **Step 7: Add the migration CLI and package command**

```js
// scripts/migrate.mjs
import { neon } from '@neondatabase/serverless';
import { runMigrations } from './lib/migration-runner.mjs';
import * as baseline from './migrations/001-baseline-schema.mjs';
import * as removeMail from './migrations/002-remove-mail.mjs';

const args = process.argv.slice(2);
const valueFor = (name) => {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || '';
};

if (args.includes('--help') || args.includes('-h')) {
  console.log([
    'Usage: npm run migrate:schema -- [--apply] [options]',
    '--apply                       execute pending migrations',
    '--legacy-owner-user-id=<id>   owner for legacy rows that have no owner',
    '--ack-mail-backup             confirm legacy Mail tables were backed up'
  ].join('\n'));
  process.exit(0);
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const result = await runMigrations({
  sql: neon(process.env.DATABASE_URL),
  migrations: [baseline, removeMail],
  apply: args.includes('--apply'),
  options: {
    legacyOwnerUserId: valueFor('legacy-owner-user-id'),
    mailBackupAcknowledged: args.includes('--ack-mail-backup')
  }
});

for (const entry of result) console.log(`${entry.id}: ${entry.status}`);
if (!args.includes('--apply')) {
  console.log('Dry-run only. Re-run with --apply after reviewing the pending list.');
}
```

Add the exact `package.json` entry `migrate:schema` with value `node scripts/migrate.mjs` beside the existing test and guest-encryption scripts.

- [ ] **Step 8: Remove all request-time schema mutation**

Reduce `api/_db.js` to:

```js
import { neon } from '@neondatabase/serverless';

export function getSQL() {
  return neon(process.env.DATABASE_URL);
}
```

Remove `ensureAuthTables` imports and calls from `api/_auth.js` and `api/auth.js`. Delete `ensureAlloggiatiSubmissionTable` and both calls from `api/alloggiati.js`; those actions now rely on migration `001`. Delete `api/init.js` completely. No replacement public route is allowed.

- [ ] **Step 9: Run migration and route verification**

Run: `node --test tests/migration-runner.test.mjs tests/schema-migrations.test.mjs tests/api-route-contract.test.mjs`

Expected: PASS, 10 tests.

Run: `npm.cmd test`

Expected: PASS.

Run: `npm.cmd run migrate:schema -- --help`

Expected: prints the four documented CLI lines and exits with status 0 without connecting to the database.

Run: `rg -n 'CREATE TABLE|ALTER TABLE|CREATE INDEX|CREATE UNIQUE INDEX|DROP TABLE|ensureAuthTables|ensureAlloggiatiSubmissionTable' api --glob '*.js'`

Expected: no matches.

Run: `Get-ChildItem api -File -Filter '*.js' | Where-Object { -not $_.Name.StartsWith('_') } | Select-Object -ExpandProperty Name`

Expected: exactly the eleven filenames asserted by `tests/api-route-contract.test.mjs`.

Do not run `--apply` against production as part of this code task. The release operator first backs up the database, resolves the real existing user id for any legacy rows, reviews dry-run output, and then invokes `--apply` with `--ack-mail-backup` and the verified owner id.

- [ ] **Step 10: Commit the controlled schema boundary**

```bash
git add -A
git commit -m 'chore: move schema changes to controlled migrations'
```

### Task 6: Fail closed around shared Alloggiati credentials

**Files:**
- Create: `api/_alloggiati-auth.js`
- Create: `tests/alloggiati-authorization.test.mjs`
- Modify: `api/alloggiati.js`

- [ ] **Step 1: Write exact allowlist and handler-order tests**

```js
// tests/alloggiati-authorization.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  isAlloggiatiUserAllowed,
  parseAllowedUserIds,
  requireAlloggiatiAccess
} from '../api/_alloggiati-auth.js';

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('allowlist is trimmed, exact, and empty means deny', () => {
  assert.deepEqual([...parseAllowedUserIds(' user-1, user-2 ,,')], ['user-1', 'user-2']);
  assert.equal(isAlloggiatiUserAllowed('user-1', {}), false);
  assert.equal(
    isAlloggiatiUserAllowed('user-1', { ALLOGGIATI_ALLOWED_USER_IDS: 'user-1,user-2' }),
    true
  );
  assert.equal(
    isAlloggiatiUserAllowed('user', { ALLOGGIATI_ALLOWED_USER_IDS: 'user-1' }),
    false
  );
});

test('denied users receive a stable 403 response', () => {
  const res = responseRecorder();
  const allowed = requireAlloggiatiAccess(
    { id: 'user-2' },
    res,
    { ALLOGGIATI_ALLOWED_USER_IDS: 'user-1' }
  );
  assert.equal(allowed, false);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    error: {
      code: 'ALLOGGIATI_NOT_AUTHORIZED',
      message: 'Account non autorizzato per Alloggiati Web'
    }
  });
});

test('handler checks authorization before reading shared credentials', () => {
  const source = fs.readFileSync('api/alloggiati.js', 'utf8');
  const guard = source.indexOf('requireAlloggiatiAccess(user, res)');
  const credential = source.indexOf('process.env.ALLOGGIATI_UTENTE');
  assert.notEqual(guard, -1);
  assert.notEqual(credential, -1);
  assert.ok(guard < credential);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --test tests/alloggiati-authorization.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `api/_alloggiati-auth.js`.

- [ ] **Step 3: Implement the fail-closed helper**

```js
// api/_alloggiati-auth.js
import { sendApiError } from './_http.js';

export function parseAllowedUserIds(raw = '') {
  return new Set(
    String(raw)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

export function isAlloggiatiUserAllowed(userId, env = process.env) {
  if (!userId) return false;
  const allowed = parseAllowedUserIds(env.ALLOGGIATI_ALLOWED_USER_IDS);
  return allowed.size > 0 && allowed.has(String(userId));
}

export function requireAlloggiatiAccess(user, res, env = process.env) {
  if (isAlloggiatiUserAllowed(user?.id, env)) return true;
  sendApiError(
    res,
    403,
    'ALLOGGIATI_NOT_AUTHORIZED',
    'Account non autorizzato per Alloggiati Web'
  );
  return false;
}
```

- [ ] **Step 4: Guard the route before credentials, database, or SOAP**

Add the import and guard at the top of the authenticated handler:

```js
import { requireAlloggiatiAccess } from './_alloggiati-auth.js';
import { sendApiError, sendInternalError } from './_http.js';

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  if (!requireAlloggiatiAccess(user, res)) return;

  const UTENTE = process.env.ALLOGGIATI_UTENTE;
  const PASSWORD = process.env.ALLOGGIATI_PASSWORD;
  const WSKEY = process.env.ALLOGGIATI_WSKEY;
  const APARTMENT_ID = normalizeApartmentId(process.env.ALLOGGIATI_IDAPPARTAMENTO);
  const FORCE_APARTMENT_MODE = String(
    process.env.ALLOGGIATI_GESTIONE_APPARTAMENTI || ''
  ).trim().toLowerCase() === 'true';
```

Replace the credential-configuration response with a safe public error that does not name environment variables:

```js
if (!UTENTE || !PASSWORD || !WSKEY) {
  return sendApiError(
    res,
    503,
    'ALLOGGIATI_NOT_CONFIGURED',
    'Servizio Alloggiati Web non configurato'
  );
}
```

This guard applies to every action, including token generation, preview, test, send, reference tables, and receipts. The allowlist is a temporary single-property control, not a role system.

- [ ] **Step 5: Run focused and full tests**

Run: `node --test tests/alloggiati-authorization.test.mjs`

Expected: PASS, 3 tests.

Run: `npm.cmd test`

Expected: PASS.

- [ ] **Step 6: Commit the credential boundary**

```bash
git add api/_alloggiati-auth.js api/alloggiati.js tests/alloggiati-authorization.test.mjs
git commit -m 'security: restrict alloggiati credentials by account'
```

### Task 7: Stop exposing internal exceptions from public APIs

**Files:**
- Create: `tests/http-errors.test.mjs`
- Modify: `api/_auth.js`
- Modify: `api/agenda.js`
- Modify: `api/alloggiati.js`
- Modify: `api/assignments.js`
- Modify: `api/auth.js`
- Modify: `api/compliance.js`
- Modify: `api/employees.js`
- Modify: `api/files.js`
- Modify: `api/guests.js`
- Modify: `api/menus.js`
- Modify: `api/reservations.js`
- Modify: `api/rooms.js`

- [ ] **Step 1: Write formatter and static leak tests**

```js
// tests/http-errors.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { sendApiError, sendInternalError } from '../api/_http.js';

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('public formatter preserves only the stable error contract', () => {
  const res = responseRecorder();
  sendApiError(res, 422, 'INVALID_INPUT', 'Controlla i campi', {
    fieldErrors: { checkin: 'Data non valida' },
    conflicts: [{ roomId: 'r1' }]
  });
  assert.deepEqual(res.body, {
    error: {
      code: 'INVALID_INPUT',
      message: 'Controlla i campi',
      fieldErrors: { checkin: 'Data non valida' },
      conflicts: [{ roomId: 'r1' }]
    }
  });
});

test('internal formatter never returns exception text', () => {
  const res = responseRecorder();
  const original = console.error;
  console.error = () => {};
  try {
    sendInternalError(res, 'test', new Error('DATABASE_URL=secret'));
  } finally {
    console.error = original;
  }
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Si è verificato un errore. Riprova.'
    }
  });
  assert.equal(JSON.stringify(res.body).includes('secret'), false);
});

test('public routes contain no raw exception payloads', () => {
  const routes = fs.readdirSync('api')
    .filter((name) => name.endsWith('.js') && !name.startsWith('_'));
  for (const route of routes) {
    const source = fs.readFileSync(`api/${route}`, 'utf8');
    assert.doesNotMatch(source, /error:\s*(?:err|error)\??\.message/);
    assert.doesNotMatch(source, /details:\s*(?:err|error)\??\./);
    assert.doesNotMatch(source, /diagnosticsError|submissionLogError/);
  }
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --test tests/http-errors.test.mjs`

Expected: FAIL on the current raw `err.message` responses in the public routes.

- [ ] **Step 3: Centralize sanitized logging and terminal catches**

Add this export to `api/_http.js` and make `sendInternalError` call it:

```js
export function logInternalError(context, error) {
  console.error(`[${context}]`, {
    name: error?.name || 'Error',
    code: error?.code || 'UNEXPECTED'
  });
}

export function sendInternalError(res, context, error) {
  logInternalError(context, error);
  return sendApiError(
    res,
    500,
    'INTERNAL_ERROR',
    'Si è verificato un errore. Riprova.'
  );
}
```

Import `sendInternalError` in every public route and use these exact terminal catches:

```js
// api/agenda.js
} catch (error) { return sendInternalError(res, 'agenda', error); }
// api/alloggiati.js
} catch (error) { return sendInternalError(res, 'alloggiati', error); }
// api/assignments.js
} catch (error) { return sendInternalError(res, 'assignments', error); }
// api/auth.js
} catch (error) { return sendInternalError(res, 'auth', error); }
// api/compliance.js
} catch (error) { return sendInternalError(res, 'compliance', error); }
// api/employees.js
} catch (error) { return sendInternalError(res, 'employees', error); }
// api/files.js
} catch (error) { return sendInternalError(res, 'files', error); }
// api/guests.js
} catch (error) { return sendInternalError(res, 'guests', error); }
// api/menus.js
} catch (error) { return sendInternalError(res, 'menus', error); }
// api/reservations.js
} catch (error) { return sendInternalError(res, 'reservations', error); }
// api/rooms.js
} catch (error) { return sendInternalError(res, 'rooms', error); }
```

In `api/_auth.js`, use `sendApiError(res, 401, 'UNAUTHORIZED', 'Sessione non valida o scaduta')` in `requireAuth`.

- [ ] **Step 4: Sanitize nested Alloggiati failures without hiding operational results**

Import `logInternalError` in `api/alloggiati.js`. Keep the official parsed row-level `EsitoOperazioneServizio` data returned for a completed test/send because reception needs it, but never serialize a caught JavaScript exception.

Use these stable replacements:

```js
// token-generation catch
logInternalError('alloggiati:token', error);
return sendApiError(
  res, 502, 'ALLOGGIATI_TOKEN_FAILED', 'Connessione ad Alloggiati Web non riuscita'
);

// optional diagnostics catch inside a successful test response
logInternalError('alloggiati:diagnostics', diagnosticError);
responsePayload.diagnosticsUnavailable = true;

// submission-log catch after a successful police send
logInternalError('alloggiati:submission-log', submissionError);
responsePayload.submissionRecorded = false;
responsePayload.warning = {
  code: 'SUBMISSION_LOG_FAILED',
  message: 'Invio riuscito, ma registrazione locale non completata'
};

// receipt-token catch
logInternalError('alloggiati:receipt-token', tokenError);
return sendApiError(
  res, 502, 'ALLOGGIATI_RECEIPT_FAILED', 'Ricevuta non recuperabile in questo momento'
);
```

For missing apartment configuration use `503`, code `ALLOGGIATI_NOT_CONFIGURED`, and message `Servizio Alloggiati Web non configurato`. Do not include environment names, SOAP bodies, database text, stack traces, or exception messages in JSON.

- [ ] **Step 5: Run focused, static, and full verification**

Run: `node --test tests/http-errors.test.mjs tests/auth-security.test.mjs tests/alloggiati-authorization.test.mjs tests/api-client.test.mjs`

Expected: PASS, 11 tests.

Run: `rg -n 'error:\s*(err|error)\??\.message|details:\s*(err|error)\??\.|diagnosticsError|submissionLogError' api --glob '*.js'`

Expected: no matches.

Run: `npm.cmd test`

Expected: PASS.

- [ ] **Step 6: Commit public error sanitization**

```bash
git add api tests/http-errors.test.mjs
git commit -m 'security: sanitize public api failures'
```

### Task 8: Establish safe rendering primitives and migrate reception-core sinks

**Files:**
- Create: `js/core/safe-dom.js`
- Create: `tests/safe-dom.test.mjs`
- Create: `tests/safe-rendering-contract.test.mjs`
- Modify: `index.html`
- Modify: `js/core/utils.js`
- Modify: `js/features/reservations-list.js`
- Modify: `js/features/reservation-detail.js`
- Modify: `js/features/rooms.js`
- Modify: `script.js`

- [ ] **Step 1: Write pure encoding tests**

```js
// tests/safe-dom.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadSafeDom() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync('js/core/safe-dom.js', 'utf8'), context);
  return context.window.GroupStaySafeDom;
}

test('escapeHtml encodes text and both quote styles without dropping zero', () => {
  const safe = loadSafeDom();
  assert.equal(
    safe.escapeHtml(`<&"' >`),
    '&lt;&amp;&quot;&#39; &gt;'
  );
  assert.equal(safe.escapeHtml(0), '0');
  assert.equal(safe.escapeHtml(null), '');
});

test('safeToken permits CSS tokens only', () => {
  const safe = loadSafeDom();
  assert.equal(safe.safeToken('checked-in'), 'checked-in');
  assert.equal(safe.safeToken('x" onclick=alert(1)', 'unknown'), 'unknown');
});

test('setText uses textContent rather than HTML parsing', () => {
  const safe = loadSafeDom();
  const element = { textContent: '' };
  safe.setText(element, '<img src=x onerror=alert(1)>');
  assert.equal(element.textContent, '<img src=x onerror=alert(1)>');
});
```

- [ ] **Step 2: Write the core-rendering static contract**

```js
// tests/safe-rendering-contract.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const delegatedFeatures = [
  'js/features/reservations-list.js',
  'js/features/reservation-detail.js',
  'js/features/rooms.js'
];

test('core cards and detail actions contain no inline event attributes', () => {
  for (const file of delegatedFeatures) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /\bon(?:click|change|input|submit|mouseenter|mouseleave)\s*=/i, file);
    assert.match(source, /data-action/);
  }
});

test('safe DOM loads before utilities and reception features', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const safe = html.indexOf('js/core/safe-dom.js');
  const utils = html.indexOf('js/core/utils.js');
  const rooms = html.indexOf('js/features/rooms.js');
  assert.ok(safe >= 0 && safe < utils && utils < rooms);
});

test('API error text is never interpolated into innerHTML', () => {
  const source = fs.readFileSync('script.js', 'utf8');
  assert.doesNotMatch(
    source,
    /innerHTML\s*=\s*`[^`]*\$\{(?:err|error)\??\.message\}/
  );
});
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `node --test tests/safe-dom.test.mjs tests/safe-rendering-contract.test.mjs`

Expected: FAIL because `safe-dom.js` is absent and the three features render inline handlers.

- [ ] **Step 4: Implement and load the safe DOM module**

```js
// js/core/safe-dom.js
(function initSafeDom(global) {
  const ENTITIES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '\u0022': '&quot;',
    '\u0027': '&#39;'
  };

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>\u0022\u0027]/g, (character) => ENTITIES[character]);
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function safeToken(value, fallback = 'unknown') {
    const token = String(value ?? '');
    return /^[a-z0-9_-]+$/i.test(token) ? token : fallback;
  }

  function setText(element, value) {
    if (element) element.textContent = String(value ?? '');
    return element;
  }

  global.GroupStaySafeDom = { escapeAttribute, escapeHtml, safeToken, setText };
})(window);
```

Load `js/core/safe-dom.js` after preferences and before `js/core/utils.js`. In `js/core/utils.js`, remove the temporary-element encoder and use the shared pure implementation:

```js
const { escapeHtml } = global.GroupStaySafeDom;
```

Keep `escapeHtml` in `GroupStayUtils` for existing consumers; it is now the same function instance as `GroupStaySafeDom.escapeHtml`.

- [ ] **Step 5: Replace interpolated identifiers with delegated actions**

In `js/features/reservations-list.js`, render each card as a semantic button with only encoded data and fixed action text:

```js
const { escapeAttribute, safeToken } = global.GroupStaySafeDom;

return `
  <button type='button'
          class='reservation-card'
          data-action='open-reservation'
          data-reservation-id='${escapeAttribute(reservation.id)}'>
    <span class='res-color-bar ${safeToken(reservation.status)}'></span>
    <span class='res-info'>
      <span class='res-group-name'>${escapeHtml(reservation.groupName)}${typeBadge}</span>
      <span class='res-organizer'>${escapeHtml(subtitle)}</span>
    </span>
    <span class='res-meta'>
      <span class='res-meta-item'>
        <span class='res-meta-value'>${Number(reservation.guestCount) || 0}</span>
        <span class='res-meta-label'>${escapeHtml(t('res.guests'))}</span>
      </span>
      <span class='res-meta-item'>
        <span class='res-meta-value'>${Number(reservation.roomCount) || 0}</span>
        <span class='res-meta-label'>${escapeHtml(t('res.rooms'))}</span>
      </span>
      <span class='res-meta-item'>
        <span class='res-meta-value'>${Number(nights) || 0}</span>
        <span class='res-meta-label'>${escapeHtml(t('res.nights'))}</span>
      </span>
    </span>
    <span class='res-dates'>
      ${escapeHtml(formatDateDisplay(reservation.checkin))}
      &rarr;
      ${escapeHtml(formatDateDisplay(reservation.checkout))}
    </span>
    <span class='status-badge ${safeToken(reservation.status)}'>
      ${escapeHtml(statusLabel)}
    </span>
  </button>
`;
```

The retained fields are group name, type label, organizer/contact, guest count, room count, nights, formatted dates, and status label. Coerce the three counts with `Number(...)`; call `escapeHtml` for every label, contact, formatted date, group name, and status label.

Bind one listener once on `#reservationsList`:

```js
function bindReservationListActions() {
  const list = document.getElementById('reservationsList');
  if (!list || list.dataset.actionsBound === 'true') return;
  list.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action=open-reservation]');
    if (action && list.contains(action)) {
      requireDeps().openReservationDetail(action.dataset.reservationId);
    }
  });
  list.dataset.actionsBound = 'true';
}
```

Call this from `renderReservations` before either return, and add `openReservationDetail` to the dependency injection in `script.js`.

In `js/features/rooms.js`, render the complete card with encoded data, text, and class tokens:

```js
const { escapeAttribute, escapeHtml, safeToken } = global.GroupStaySafeDom;

return `
  <button type='button'
          class='room-card ${safeToken(room.status)}'
          data-action='open-room'
          data-room-id='${escapeAttribute(room.id)}'>
    <span class='room-number'>${escapeHtml(room.number)}</span>
    <span class='room-type'>
      <span class='room-status-dot ${safeToken(room.status)}'></span>
      ${escapeHtml(room.type)}
    </span>
    <span class='room-details'>
      <span class='room-capacity'>
        ${Number(room.capacity) || 0} ${escapeHtml(t('rooms.pax'))}
        &middot; ${escapeHtml(t('rooms.floor'))} ${Number(room.floor) || 0}
      </span>
    </span>
  </button>
`;
```

Replace `statusField.onchange = ...` with one guarded listener:

```js
if (statusField.dataset.maintenanceBound !== 'true') {
  statusField.addEventListener('change', () => {
    syncRoomMaintenanceNoteVisibility();
    if (statusField.value !== 'maintenance') setRoomMaintenanceNoteValue('');
  });
  statusField.dataset.maintenanceBound = 'true';
}
```

```js
function bindRoomGridActions() {
  const grid = document.getElementById('roomsGrid');
  if (!grid || grid.dataset.actionsBound === 'true') return;
  grid.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action=open-room]');
    if (action && grid.contains(action)) openEditRoom(action.dataset.roomId);
  });
  grid.dataset.actionsBound = 'true';
}
```

- [ ] **Step 6: Delegate reservation-detail commands and keep text out of handler attributes**

In `js/features/reservation-detail.js`, remove `onclick` from every toolbar, notes, menu, print, and upload button. Give each a fixed `data-action` value from this set: `edit-reservation`, `open-assignment`, `open-guests`, `delete-reservation`, `save-notes`, `save-menus`, `print-menu`, `upload-file`.

After resolving the reservation but before assigning `body.innerHTML`, set the identifiers through DOM properties:

```js
const { safeToken } = global.GroupStaySafeDom;
body.dataset.reservationId = reservation.id;
body.dataset.reservationType = reservation.resType;
badge.className = `status-badge ${safeToken(reservation.status)}`;
```

Continue using `escapeHtml` for group/contact/room/extra-cost/date/translation text, use `safeToken` for status and meal-plan class fragments, and coerce prices and counts with `Number`. Render `#detailNotesField` empty in the template and assign `notesField.value = reservation.notes || ''` after insertion, rather than placing notes inside HTML.

Bind one listener once:

```js
function bindDetailActions() {
  const body = document.getElementById('reservationDetailBody');
  if (!body || body.dataset.actionsBound === 'true') return;
  body.addEventListener('click', async (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger || !body.contains(trigger)) return;
    const id = body.dataset.reservationId;
    const type = body.dataset.reservationType;
    const actions = requireDeps();
    switch (trigger.dataset.action) {
      case 'edit-reservation':
        if (type === 'individual') actions.openEditIndividualReservation(id);
        else actions.openEditReservation(id);
        break;
      case 'open-assignment': actions.openRoomAssignment(id); break;
      case 'open-guests': actions.openGuestsList(id); break;
      case 'delete-reservation': await actions.deleteReservation(id); break;
      case 'save-notes': await saveDetailNotes(id); break;
      case 'save-menus': await actions.saveAllMenus(id); break;
      case 'print-menu': actions.printMenu(id); break;
      case 'upload-file': await actions.uploadReservationFile(id); break;
    }
  });
  body.dataset.actionsBound = 'true';
}
```

Call `bindDetailActions()` before setting detail content. Inject all eight named callbacks from `script.js`; do not look them up from string names on `window`.

- [ ] **Step 7: Render reception error messages as text nodes**

Add this local helper in `script.js` near the Alloggiati action functions:

```js
function renderInlineMessage(container, message, tone = 'neutral') {
  if (!container) return;
  const paragraph = document.createElement('p');
  paragraph.className = `inline-message ${GroupStaySafeDom.safeToken(tone)}`;
  GroupStaySafeDom.setText(paragraph, message);
  container.replaceChildren(paragraph);
}
```

Replace every `innerHTML` interpolation of `err.message` or `error.message` in Alloggiati build/test/send/receipt flows with `renderInlineMessage(container, error.message, 'error')`. Use the same helper for their success and neutral messages, passing already formatted text; do not reintroduce string-built HTML.

- [ ] **Step 8: Run focused and full verification**

Run: `node --test tests/safe-dom.test.mjs tests/safe-rendering-contract.test.mjs`

Expected: PASS, 6 tests.

Run: `npm.cmd test`

Expected: PASS.

Run: `rg -n 'on(click|change|input|submit|mouseenter|mouseleave)=' js/features/reservations-list.js js/features/reservation-detail.js js/features/rooms.js`

Expected: no matches.

- [ ] **Step 9: Commit the safe rendering foundation**

```bash
git add index.html script.js js/core/safe-dom.js js/core/utils.js js/features/reservations-list.js js/features/reservation-detail.js js/features/rooms.js tests/safe-dom.test.mjs tests/safe-rendering-contract.test.mjs
git commit -m 'security: harden reception core rendering'
```

### Task 9: Add restrictive hosting headers without adding a route

**Files:**
- Create: `vercel.json`
- Create: `tests/security-headers.test.mjs`

- [ ] **Step 1: Write the hosting-header contract**

```js
// tests/security-headers.test.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('every application path receives the required security headers', () => {
  const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
  const rule = config.headers.find((entry) => entry.source === '/(.*)');
  assert.ok(rule);
  const headers = Object.fromEntries(rule.headers.map(({ key, value }) => [key, value]));
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.match(headers['Permissions-Policy'], /camera=\(\)/);
  assert.match(headers['Strict-Transport-Security'], /max-age=31536000/);
  assert.match(headers['Content-Security-Policy'], /default-src 'self'/);
  assert.match(headers['Content-Security-Policy'], /object-src 'none'/);
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.match(headers['Content-Security-Policy'], /connect-src 'self'/);
});

test('hosting config does not alter the eleven API routes', () => {
  const routes = fs.readdirSync('api')
    .filter((name) => name.endsWith('.js') && !name.startsWith('_'));
  assert.equal(routes.length, 11);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --test tests/security-headers.test.mjs`

Expected: FAIL with `ENOENT: vercel.json`.

- [ ] **Step 3: Add the interim CSP and standard headers**

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.sheetjs.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob: https://cdnjs.cloudflare.com; frame-src 'self' blob: data:; manifest-src 'self'; upgrade-insecure-requests"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=(), payment=()"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        },
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        }
      ]
    }
  ]
}
```

The two `unsafe-inline` allowances are temporary and explicit because legacy secondary screens still use inline style and event attributes. Phase 05 removes those attributes, externalizes the PDF worker setup, and then replaces this policy with `script-src-attr 'none'` and no inline script allowance. `connect-src` remains same-origin because browser code talks only to the existing API routes.

- [ ] **Step 4: Run header, route, and full verification**

Run: `node --test tests/security-headers.test.mjs tests/api-route-contract.test.mjs`

Expected: PASS, 5 tests.

Run: `npm.cmd test`

Expected: PASS.

Run: `git diff --check`

Expected: no output and exit status 0.

- [ ] **Step 5: Commit the hosting policy**

```bash
git add vercel.json tests/security-headers.test.mjs
git commit -m 'security: add application security headers'
```
