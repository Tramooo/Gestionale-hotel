# Aruba IMAP Mail Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a PMS-only mail inbox that syncs the latest 200 Aruba IMAP messages per user, stores them locally, and links each message to one group reservation.

**Architecture:** Do not add new Vercel API route files. Add route-safe helpers under `api/_*.js`, extend `api/auth.js`, `api/reservations.js`, and `api/init.js`, then add a focused frontend mail feature module wired into the existing global IIFE app.

**Tech Stack:** Node ESM, Neon Postgres, Vercel serverless functions, `imapflow`, `mailparser`, browser JavaScript modules loaded by `index.html`, Node test runner.

---

## File Structure

- Create `api/_mail-crypto.js`: encrypt and decrypt IMAP passwords with `MAIL_CREDENTIALS_SECRET`.
- Create `api/_mail-utils.js`: normalize settings, sanitize account rows, normalize parsed mail messages, compute PMS status.
- Create `api/_mail.js`: DB operations and IMAP sync using `imapflow` and `mailparser`.
- Modify `api/init.js`: create `mail_accounts` and `mail_messages`.
- Modify `api/auth.js`: add actions for mail settings and connection tests.
- Modify `api/reservations.js`: add mail list, detail, sync, assignment, and status actions.
- Create `js/features/mail.js`: render Mail page, sync, filters, details, assignment, archive/handled states, settings calls.
- Modify `script.js`: initialize mail feature, add wrappers, translations, state refresh hooks, navigation case.
- Modify `index.html`: add Mail navigation, mobile More item, Mail page, mail detail modal, settings fields, script include.
- Modify `css/02-lists-data.css`: Mail list and detail styles.
- Modify `package.json` and `package-lock.json`: add `imapflow` and `mailparser`.
- Create tests:
  - `tests/mail-crypto.test.mjs`
  - `tests/mail-utils.test.mjs`
  - `tests/mail-feature.test.mjs`

---

### Task 1: Dependencies And Pure Helpers

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `api/_mail-crypto.js`
- Create: `api/_mail-utils.js`
- Test: `tests/mail-crypto.test.mjs`
- Test: `tests/mail-utils.test.mjs`

- [ ] **Step 1: Install IMAP dependencies**

Run:

```powershell
npm install imapflow mailparser
```

Expected: `package.json` contains `imapflow` and `mailparser`; `package-lock.json` updates.

- [ ] **Step 2: Write failing crypto tests**

Create `tests/mail-crypto.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptSecret, encryptSecret } from '../api/_mail-crypto.js';

test('encryptSecret returns a versioned token that decrypts to the original value', () => {
  const encrypted = encryptSecret('password-aruba', '0123456789abcdef0123456789abcdef');

  assert.match(encrypted, /^v1:/);
  assert.notEqual(encrypted, 'password-aruba');
  assert.equal(decryptSecret(encrypted, '0123456789abcdef0123456789abcdef'), 'password-aruba');
});

test('decryptSecret rejects malformed tokens', () => {
  assert.throws(
    () => decryptSecret('not-a-token', '0123456789abcdef0123456789abcdef'),
    /Invalid encrypted secret/
  );
});

test('encryptSecret requires a configured secret', () => {
  assert.throws(() => encryptSecret('password-aruba', ''), /MAIL_CREDENTIALS_SECRET/);
});
```

- [ ] **Step 3: Run crypto test to verify it fails**

Run:

```powershell
node --test tests/mail-crypto.test.mjs
```

Expected: FAIL with module not found for `api/_mail-crypto.js`.

- [ ] **Step 4: Implement `api/_mail-crypto.js`**

Create `api/_mail-crypto.js`:

```js
import crypto from 'node:crypto';

function resolveSecret(explicitSecret) {
  const secret = explicitSecret || process.env.MAIL_CREDENTIALS_SECRET || '';
  if (!secret || secret.length < 16) {
    throw new Error('MAIL_CREDENTIALS_SECRET must be configured with at least 16 characters');
  }
  return secret;
}

function keyFromSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(value, explicitSecret = '') {
  const plainText = String(value || '');
  const secret = resolveSecret(explicitSecret);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFromSecret(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    'v1',
    iv.toString('base64url'),
    authTag.toString('base64url'),
    encrypted.toString('base64url')
  ].join(':');
}

export function decryptSecret(token, explicitSecret = '') {
  const secret = resolveSecret(explicitSecret);
  const parts = String(token || '').split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Invalid encrypted secret');
  }
  const [, ivRaw, tagRaw, encryptedRaw] = parts;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    keyFromSecret(secret),
    Buffer.from(ivRaw, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final()
  ]).toString('utf8');
}
```

- [ ] **Step 5: Run crypto test to verify it passes**

Run:

```powershell
node --test tests/mail-crypto.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Write failing utility tests**

Create `tests/mail-utils.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMailPreview,
  computeMailStatus,
  normalizeMailAccountInput,
  normalizeParsedMail,
  sanitizeMailAccount
} from '../api/_mail-utils.js';

test('normalizeMailAccountInput applies Aruba defaults and keeps editable fields', () => {
  const input = normalizeMailAccountInput({
    email: ' INFO@EXAMPLE.IT ',
    username: ' info@example.it ',
    password: ' secret ',
    host: '',
    port: '993',
    secure: true
  });

  assert.deepEqual(input, {
    email: 'info@example.it',
    username: 'info@example.it',
    password: 'secret',
    host: 'imaps.aruba.it',
    port: 993,
    secure: true
  });
});

test('sanitizeMailAccount never exposes encrypted password', () => {
  const account = sanitizeMailAccount({
    imap_email: 'info@example.it',
    imap_username: 'info@example.it',
    imap_host: 'imaps.aruba.it',
    imap_port: 993,
    imap_secure: true,
    encrypted_password: 'v1:secret',
    last_tested_at: '2026-05-04T10:00:00.000Z',
    last_sync_at: null
  });

  assert.deepEqual(account, {
    configured: true,
    email: 'info@example.it',
    username: 'info@example.it',
    host: 'imaps.aruba.it',
    port: 993,
    secure: true,
    lastTestedAt: '2026-05-04T10:00:00.000Z',
    lastSyncAt: null
  });
  assert.equal(Object.hasOwn(account, 'encryptedPassword'), false);
});

test('computeMailStatus derives assigned status unless handled or archived is explicit', () => {
  assert.equal(computeMailStatus(null, ''), 'unassigned');
  assert.equal(computeMailStatus('res-1', ''), 'assigned');
  assert.equal(computeMailStatus('res-1', 'handled'), 'handled');
  assert.equal(computeMailStatus('res-1', 'archived'), 'archived');
});

test('normalizeParsedMail creates stable frontend fields', () => {
  const normalized = normalizeParsedMail({
    uid: 42,
    mailbox: 'INBOX',
    parsed: {
      messageId: '<abc@example.it>',
      subject: ' Richiesta gruppo ',
      date: new Date('2026-05-03T12:00:00.000Z'),
      from: { value: [{ name: 'Mario Rossi', address: 'mario@example.it' }] },
      to: { text: 'info@example.it' },
      text: 'Prima riga\n\nSeconda riga',
      html: '<p>Prima riga</p>',
      attachments: [{ filename: 'offerta.pdf' }]
    }
  });

  assert.equal(normalized.providerUid, 'INBOX:42');
  assert.equal(normalized.messageId, '<abc@example.it>');
  assert.equal(normalized.fromName, 'Mario Rossi');
  assert.equal(normalized.fromEmail, 'mario@example.it');
  assert.equal(normalized.subject, 'Richiesta gruppo');
  assert.equal(normalized.previewText, 'Prima riga Seconda riga');
  assert.equal(normalized.hasAttachments, true);
});

test('buildMailPreview collapses whitespace and limits length', () => {
  assert.equal(buildMailPreview(' Uno  due\n tre ', 9), 'Uno due...');
});
```

- [ ] **Step 7: Run utility test to verify it fails**

Run:

```powershell
node --test tests/mail-utils.test.mjs
```

Expected: FAIL with module not found for `api/_mail-utils.js`.

- [ ] **Step 8: Implement `api/_mail-utils.js`**

Create `api/_mail-utils.js`:

```js
export const MAIL_STATUSES = new Set(['unassigned', 'assigned', 'handled', 'archived']);

export function normalizeMailAccountInput(input = {}) {
  const email = String(input.email || '').trim().toLowerCase();
  const username = String(input.username || email).trim().toLowerCase();
  const password = String(input.password || '').trim();
  const host = String(input.host || 'imaps.aruba.it').trim().toLowerCase();
  const port = Number.parseInt(input.port, 10) || 993;
  const secure = input.secure !== false;

  if (!email) throw new Error('Email IMAP obbligatoria');
  if (!username) throw new Error('Username IMAP obbligatorio');
  if (port < 1 || port > 65535) throw new Error('Porta IMAP non valida');

  return { email, username, password, host, port, secure };
}

export function sanitizeMailAccount(row) {
  if (!row) return { configured: false };
  return {
    configured: true,
    email: row.imap_email || '',
    username: row.imap_username || '',
    host: row.imap_host || 'imaps.aruba.it',
    port: Number(row.imap_port) || 993,
    secure: row.imap_secure !== false,
    lastTestedAt: row.last_tested_at || null,
    lastSyncAt: row.last_sync_at || null
  };
}

export function computeMailStatus(reservationId, requestedStatus) {
  const status = String(requestedStatus || '').trim();
  if (status === 'handled' || status === 'archived') return status;
  return reservationId ? 'assigned' : 'unassigned';
}

export function buildMailPreview(text, maxLength = 180) {
  const compact = String(text || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function firstAddress(addressList) {
  return addressList?.value?.[0] || {};
}

export function normalizeParsedMail({ uid, mailbox = 'INBOX', parsed }) {
  const from = firstAddress(parsed.from);
  const text = parsed.text || '';
  const subject = String(parsed.subject || '(Senza oggetto)').trim() || '(Senza oggetto)';
  const sentAt = parsed.date instanceof Date && !Number.isNaN(parsed.date.getTime())
    ? parsed.date.toISOString()
    : new Date().toISOString();

  return {
    providerUid: `${mailbox}:${uid}`,
    messageId: parsed.messageId || '',
    mailbox,
    fromName: from.name || '',
    fromEmail: from.address || '',
    toText: parsed.to?.text || '',
    subject,
    sentAt,
    previewText: buildMailPreview(text),
    bodyText: text,
    bodyHtml: parsed.html || '',
    hasAttachments: Array.isArray(parsed.attachments) && parsed.attachments.length > 0
  };
}

export function mapMailRow(row) {
  return {
    id: row.id,
    providerUid: row.provider_uid,
    messageId: row.message_id || '',
    mailbox: row.mailbox || 'INBOX',
    fromName: row.from_name || '',
    fromEmail: row.from_email || '',
    toText: row.to_text || '',
    subject: row.subject || '(Senza oggetto)',
    sentAt: row.sent_at,
    previewText: row.preview_text || '',
    bodyText: row.body_text || '',
    bodyHtml: row.body_html || '',
    hasAttachments: Boolean(row.has_attachments),
    reservationId: row.reservation_id || '',
    pmsStatus: row.pms_status || computeMailStatus(row.reservation_id, ''),
    syncedAt: row.synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
```

- [ ] **Step 9: Run utility test to verify it passes**

Run:

```powershell
node --test tests/mail-utils.test.mjs
```

Expected: PASS.

- [ ] **Step 10: Run all tests and commit**

Run:

```powershell
npm test
```

Expected: PASS.

Commit:

```powershell
git add package.json package-lock.json api\_mail-crypto.js api\_mail-utils.js tests\mail-crypto.test.mjs tests\mail-utils.test.mjs
git commit -m "feat: add mail security helpers"
```

---

### Task 2: Database Schema And Mail Backend Service

**Files:**
- Modify: `api/init.js`
- Create: `api/_mail.js`
- Test: `tests/mail-utils.test.mjs`

- [ ] **Step 1: Extend utility tests for row mapping**

Append to `tests/mail-utils.test.mjs`:

```js
import { mapMailRow } from '../api/_mail-utils.js';

test('mapMailRow converts database columns to frontend fields', () => {
  const mapped = mapMailRow({
    id: 'mail-1',
    provider_uid: 'INBOX:42',
    message_id: '<abc@example.it>',
    mailbox: 'INBOX',
    from_name: 'Mario',
    from_email: 'mario@example.it',
    to_text: 'info@example.it',
    subject: 'Preventivo',
    sent_at: '2026-05-03T12:00:00.000Z',
    preview_text: 'Richiesta',
    body_text: 'Richiesta completa',
    body_html: '',
    has_attachments: false,
    reservation_id: 'res-1',
    pms_status: 'assigned',
    synced_at: '2026-05-04T08:00:00.000Z',
    created_at: '2026-05-04T08:00:00.000Z',
    updated_at: '2026-05-04T08:00:00.000Z'
  });

  assert.equal(mapped.id, 'mail-1');
  assert.equal(mapped.providerUid, 'INBOX:42');
  assert.equal(mapped.reservationId, 'res-1');
  assert.equal(mapped.pmsStatus, 'assigned');
});
```

- [ ] **Step 2: Run utility test to verify it fails**

Run:

```powershell
node --test tests/mail-utils.test.mjs
```

Expected: FAIL until `mapMailRow` is exported with the expected shape if Task 1 did not already include it.

- [ ] **Step 3: Add mail tables to `api/init.js`**

In `api/init.js`, after the `agenda_items` table block and before `alloggiati_submissions`, add:

```js
    await sql`
      CREATE TABLE IF NOT EXISTS mail_accounts (
        owner_user_id TEXT PRIMARY KEY,
        imap_email TEXT NOT NULL,
        imap_username TEXT NOT NULL,
        imap_host TEXT NOT NULL DEFAULT 'imaps.aruba.it',
        imap_port INTEGER NOT NULL DEFAULT 993,
        imap_secure BOOLEAN NOT NULL DEFAULT TRUE,
        encrypted_password TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        last_tested_at TIMESTAMPTZ,
        last_sync_at TIMESTAMPTZ
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS mail_messages (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        provider_uid TEXT NOT NULL,
        message_id TEXT DEFAULT '',
        mailbox TEXT NOT NULL DEFAULT 'INBOX',
        from_name TEXT DEFAULT '',
        from_email TEXT DEFAULT '',
        to_text TEXT DEFAULT '',
        subject TEXT DEFAULT '',
        sent_at TIMESTAMPTZ,
        preview_text TEXT DEFAULT '',
        body_text TEXT DEFAULT '',
        body_html TEXT DEFAULT '',
        has_attachments BOOLEAN NOT NULL DEFAULT FALSE,
        reservation_id TEXT REFERENCES reservations(id) ON DELETE SET NULL,
        pms_status TEXT NOT NULL DEFAULT 'unassigned',
        synced_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_messages_owner_provider_uid ON mail_messages(owner_user_id, provider_uid)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_mail_messages_owner_sent_at ON mail_messages(owner_user_id, sent_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_mail_messages_owner_reservation ON mail_messages(owner_user_id, reservation_id)`;
```

- [ ] **Step 4: Create `api/_mail.js` service**

Create `api/_mail.js`:

```js
import crypto from 'node:crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { decryptSecret, encryptSecret } from './_mail-crypto.js';
import {
  computeMailStatus,
  mapMailRow,
  normalizeMailAccountInput,
  normalizeParsedMail,
  sanitizeMailAccount
} from './_mail-utils.js';

const MAIL_LIMIT = 200;
const MAILBOX = 'INBOX';

export async function getMailAccount(sql, userId) {
  const rows = await sql`
    SELECT *
    FROM mail_accounts
    WHERE owner_user_id = ${userId}
    LIMIT 1
  `;
  return rows[0] || null;
}

export async function getSanitizedMailAccount(sql, userId) {
  return sanitizeMailAccount(await getMailAccount(sql, userId));
}

export async function saveMailAccount(sql, userId, payload) {
  const settings = normalizeMailAccountInput(payload);
  const existing = await getMailAccount(sql, userId);
  const encryptedPassword = settings.password
    ? encryptSecret(settings.password)
    : existing?.encrypted_password;

  if (!encryptedPassword) throw new Error('Password IMAP obbligatoria');

  const rows = await sql`
    INSERT INTO mail_accounts (
      owner_user_id, imap_email, imap_username, imap_host, imap_port,
      imap_secure, encrypted_password, updated_at
    )
    VALUES (
      ${userId}, ${settings.email}, ${settings.username}, ${settings.host},
      ${settings.port}, ${settings.secure}, ${encryptedPassword}, NOW()
    )
    ON CONFLICT (owner_user_id) DO UPDATE SET
      imap_email = EXCLUDED.imap_email,
      imap_username = EXCLUDED.imap_username,
      imap_host = EXCLUDED.imap_host,
      imap_port = EXCLUDED.imap_port,
      imap_secure = EXCLUDED.imap_secure,
      encrypted_password = EXCLUDED.encrypted_password,
      updated_at = NOW()
    RETURNING *
  `;

  return sanitizeMailAccount(rows[0]);
}

function connectionConfig(account) {
  return {
    host: account.imap_host,
    port: Number(account.imap_port) || 993,
    secure: account.imap_secure !== false,
    auth: {
      user: account.imap_username,
      pass: decryptSecret(account.encrypted_password)
    },
    logger: false
  };
}

export async function testMailConnection(sql, userId) {
  const account = await getMailAccount(sql, userId);
  if (!account) throw new Error('Configura prima la casella email');

  const client = new ImapFlow(connectionConfig(account));
  await client.connect();
  await client.mailboxOpen(MAILBOX, { readOnly: true });
  await client.logout();

  const rows = await sql`
    UPDATE mail_accounts
    SET last_tested_at = NOW(), updated_at = NOW()
    WHERE owner_user_id = ${userId}
    RETURNING *
  `;
  return sanitizeMailAccount(rows[0]);
}

async function upsertMailMessage(sql, userId, message) {
  const id = crypto.randomUUID();
  const rows = await sql`
    INSERT INTO mail_messages (
      id, owner_user_id, provider_uid, message_id, mailbox, from_name, from_email,
      to_text, subject, sent_at, preview_text, body_text, body_html,
      has_attachments, pms_status, synced_at, updated_at
    )
    VALUES (
      ${id}, ${userId}, ${message.providerUid}, ${message.messageId}, ${message.mailbox},
      ${message.fromName}, ${message.fromEmail}, ${message.toText}, ${message.subject},
      ${message.sentAt}, ${message.previewText}, ${message.bodyText}, ${message.bodyHtml},
      ${message.hasAttachments}, 'unassigned', NOW(), NOW()
    )
    ON CONFLICT (owner_user_id, provider_uid) DO UPDATE SET
      message_id = EXCLUDED.message_id,
      mailbox = EXCLUDED.mailbox,
      from_name = EXCLUDED.from_name,
      from_email = EXCLUDED.from_email,
      to_text = EXCLUDED.to_text,
      subject = EXCLUDED.subject,
      sent_at = EXCLUDED.sent_at,
      preview_text = EXCLUDED.preview_text,
      body_text = EXCLUDED.body_text,
      body_html = EXCLUDED.body_html,
      has_attachments = EXCLUDED.has_attachments,
      synced_at = NOW(),
      updated_at = NOW()
    RETURNING *
  `;
  return mapMailRow(rows[0]);
}

export async function syncMailMessages(sql, userId) {
  const account = await getMailAccount(sql, userId);
  if (!account) throw new Error('Configura prima la casella email');

  const client = new ImapFlow(connectionConfig(account));
  const synced = [];

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen(MAILBOX, { readOnly: true });
    const exists = Number(mailbox.exists) || 0;
    if (exists > 0) {
      const start = Math.max(1, exists - MAIL_LIMIT + 1);
      for await (const msg of client.fetch(`${start}:*`, { uid: true, source: true }, { uid: false })) {
        const parsed = await simpleParser(msg.source, { skipImageLinks: true });
        const normalized = normalizeParsedMail({ uid: msg.uid, mailbox: MAILBOX, parsed });
        synced.push(await upsertMailMessage(sql, userId, normalized));
      }
    }
    await sql`
      UPDATE mail_accounts
      SET last_sync_at = NOW(), updated_at = NOW()
      WHERE owner_user_id = ${userId}
    `;
  } finally {
    try {
      await client.logout();
    } catch (error) {
      if (client.usable) throw error;
    }
  }

  return { syncedCount: synced.length, messages: synced };
}

export async function listMailMessages(sql, userId, { status = 'all', reservationId = '', search = '' } = {}) {
  const rows = await sql`
    SELECT *
    FROM mail_messages
    WHERE owner_user_id = ${userId}
      AND (${status} = 'all' OR pms_status = ${status})
      AND (${reservationId} = '' OR reservation_id = ${reservationId})
      AND (
        ${search} = ''
        OR LOWER(subject) LIKE LOWER(${'%' + search + '%'})
        OR LOWER(from_email) LIKE LOWER(${'%' + search + '%'})
        OR LOWER(from_name) LIKE LOWER(${'%' + search + '%'})
        OR LOWER(preview_text) LIKE LOWER(${'%' + search + '%'})
      )
    ORDER BY sent_at DESC NULLS LAST, created_at DESC
    LIMIT 250
  `;
  return rows.map(mapMailRow);
}

export async function getMailMessage(sql, userId, id) {
  const rows = await sql`
    SELECT *
    FROM mail_messages
    WHERE owner_user_id = ${userId} AND id = ${id}
    LIMIT 1
  `;
  if (!rows[0]) throw new Error('Email non trovata');
  return mapMailRow(rows[0]);
}

export async function updateMailMessage(sql, userId, { id, reservationId = '', pmsStatus = '' }) {
  if (!id) throw new Error('ID email obbligatorio');

  const nextReservationId = reservationId || null;
  if (nextReservationId) {
    const reservationRows = await sql`
      SELECT id
      FROM reservations
      WHERE id = ${nextReservationId}
        AND owner_user_id = ${userId}
        AND COALESCE(res_type, 'group') = 'group'
      LIMIT 1
    `;
    if (!reservationRows[0]) throw new Error('Prenotazione gruppo non trovata');
  }

  const status = computeMailStatus(nextReservationId, pmsStatus);
  const rows = await sql`
    UPDATE mail_messages
    SET reservation_id = ${nextReservationId},
        pms_status = ${status},
        updated_at = NOW()
    WHERE id = ${id} AND owner_user_id = ${userId}
    RETURNING *
  `;
  if (!rows[0]) throw new Error('Email non trovata');
  return mapMailRow(rows[0]);
}
```

- [ ] **Step 5: Run helper tests**

Run:

```powershell
node --test tests/mail-utils.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Run all tests and commit**

Run:

```powershell
npm test
```

Expected: PASS.

Commit:

```powershell
git add api\init.js api\_mail.js tests\mail-utils.test.mjs
git commit -m "feat: add mail database service"
```

---

### Task 3: Extend Existing API Routes Without Adding Serverless Functions

**Files:**
- Modify: `api/auth.js`
- Modify: `api/reservations.js`

- [ ] **Step 1: Extend `api/auth.js` imports**

Add below the existing imports:

```js
import { getSanitizedMailAccount, saveMailAccount, testMailConnection } from './_mail.js';
```

- [ ] **Step 2: Include mail settings in authenticated GET**

Replace the current authenticated GET return in `api/auth.js`:

```js
return res.status(200).json({ user, managementPinEnabled: Boolean(rows[0]?.management_pin_hash) });
```

with:

```js
const mailAccount = await getSanitizedMailAccount(sql, user.id);
return res.status(200).json({
  user,
  managementPinEnabled: Boolean(rows[0]?.management_pin_hash),
  mailAccount
});
```

- [ ] **Step 3: Add mail POST actions in `api/auth.js`**

Add this block after the management PIN action block and before `register`:

```js
    if (action === 'saveMailSettings' || action === 'testMailConnection') {
      const user = await getAuthenticatedUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      if (action === 'saveMailSettings') {
        const mailAccount = await saveMailAccount(sql, user.id, req.body || {});
        return res.status(200).json({ mailAccount });
      }

      const mailAccount = await testMailConnection(sql, user.id);
      return res.status(200).json({ mailAccount, success: true });
    }
```

- [ ] **Step 4: Extend `api/reservations.js` imports**

Add below existing imports:

```js
import {
  getMailMessage,
  listMailMessages,
  syncMailMessages,
  updateMailMessage
} from './_mail.js';
```

- [ ] **Step 5: Add mail GET actions before reservation GET default**

Inside `api/reservations.js`, at the start of the `if (req.method === 'GET')` block, add:

```js
      const action = req.query.action || '';
      if (action === 'mailList') {
        const messages = await listMailMessages(sql, user.id, {
          status: req.query.status || 'all',
          reservationId: req.query.reservationId || '',
          search: String(req.query.search || '').trim()
        });
        return res.status(200).json({ messages });
      }

      if (action === 'mailDetail') {
        const message = await getMailMessage(sql, user.id, req.query.id);
        return res.status(200).json({ message });
      }
```

- [ ] **Step 6: Add mail POST actions before reservation POST default**

Inside `api/reservations.js`, at the start of the `if (req.method === 'POST')` block, add:

```js
      const action = req.query.action || req.body?.action || '';
      if (action === 'syncMail') {
        const result = await syncMailMessages(sql, user.id);
        return res.status(200).json(result);
      }

      if (action === 'updateMailMessage') {
        const message = await updateMailMessage(sql, user.id, req.body || {});
        return res.status(200).json({ message });
      }
```

- [ ] **Step 7: Run tests and commit**

Run:

```powershell
npm test
```

Expected: PASS.

Commit:

```powershell
git add api\auth.js api\reservations.js
git commit -m "feat: expose mail actions on existing APIs"
```

---

### Task 4: Mail Frontend Feature Module

**Files:**
- Create: `js/features/mail.js`
- Modify: `script.js`
- Test: `tests/mail-feature.test.mjs`

- [ ] **Step 1: Write failing frontend feature test**

Create `tests/mail-feature.test.mjs`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function createElement() {
  return {
    classList: { add() {}, remove() {}, toggle() {} },
    dataset: {},
    innerHTML: '',
    style: {},
    textContent: '',
    value: '',
    addEventListener() {},
    querySelectorAll() { return []; }
  };
}

function loadMailFeature() {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElement());
      return elements.get(id);
    }
  };
  const context = { document, window: {} };
  vm.runInNewContext(fs.readFileSync('js/features/mail.js', 'utf8'), context);
  return { elements, mail: context.window.GroupStayMail };
}

test('renderMailPage shows empty configuration prompt when mail is not configured', () => {
  const { elements, mail } = loadMailFeature();
  mail.init({
    escapeHtml: String,
    formatDateDisplay: String,
    getMailAccount: () => ({ configured: false }),
    getMailMessages: () => [],
    getReservations: () => [],
    openModal() {},
    showToast() {},
    t: (key) => key
  });

  mail.renderMailPage();

  assert.match(elements.get('mailList').innerHTML, /mail.configurePrompt/);
});

test('renderMailPage lists sender subject and linked reservation', () => {
  const { elements, mail } = loadMailFeature();
  mail.init({
    escapeHtml: String,
    formatDateDisplay: (value) => value,
    getMailAccount: () => ({ configured: true }),
    getMailMessages: () => [{
      id: 'mail-1',
      fromName: 'Mario',
      fromEmail: 'mario@example.it',
      subject: 'Gruppo maggio',
      sentAt: '2026-05-03',
      previewText: 'Vorrei un preventivo',
      pmsStatus: 'assigned',
      reservationId: 'res-1'
    }],
    getReservations: () => [{ id: 'res-1', groupName: 'Gruppo Verdi', resType: 'group' }],
    openModal() {},
    showToast() {},
    t: (key) => key
  });

  mail.renderMailPage();

  assert.match(elements.get('mailList').innerHTML, /Gruppo maggio/);
  assert.match(elements.get('mailList').innerHTML, /Gruppo Verdi/);
});
```

- [ ] **Step 2: Run frontend feature test to verify it fails**

Run:

```powershell
node --test tests/mail-feature.test.mjs
```

Expected: FAIL with missing `js/features/mail.js`.

- [ ] **Step 3: Implement `js/features/mail.js`**

Create `js/features/mail.js`:

```js
(function initMailFeature(global) {
    let deps = null;
    let currentFilter = 'all';
    let currentSearch = '';

    function requireDeps() {
        if (!deps) throw new Error('GroupStayMail not initialized');
        return deps;
    }

    function reservationName(reservationId) {
        const { getReservations } = requireDeps();
        const reservation = getReservations().find((entry) => entry.id === reservationId);
        return reservation ? reservation.groupName : '';
    }

    function statusLabel(status) {
        const { t } = requireDeps();
        return t(`mail.status.${status || 'unassigned'}`);
    }

    function filteredMessages() {
        const { getMailMessages } = requireDeps();
        const search = currentSearch.trim().toLowerCase();
        return getMailMessages().filter((message) => {
            if (currentFilter !== 'all' && message.pmsStatus !== currentFilter) return false;
            if (!search) return true;
            return [
                message.fromName,
                message.fromEmail,
                message.subject,
                message.previewText,
                reservationName(message.reservationId)
            ].some((value) => String(value || '').toLowerCase().includes(search));
        });
    }

    function renderMailPage() {
        const { escapeHtml, formatDateDisplay, getMailAccount, openModal, t } = requireDeps();
        const account = getMailAccount();
        const list = document.getElementById('mailList');
        const lastSync = document.getElementById('mailLastSync');
        if (!list) return;

        if (lastSync) {
            lastSync.textContent = account?.lastSyncAt ? `${t('mail.lastSync')} ${formatDateDisplay(account.lastSyncAt)}` : t('mail.neverSynced');
        }

        if (!account?.configured) {
            list.innerHTML = `
                <div class="empty-state">
                    <p>${t('mail.configurePrompt')}</p>
                    <button class="btn btn-primary" type="button" onclick="openModal('settingsModal')">${t('mail.openSettings')}</button>
                </div>
            `;
            return;
        }

        const messages = filteredMessages();
        if (messages.length === 0) {
            list.innerHTML = `<div class="empty-state"><p>${t('mail.empty')}</p></div>`;
            return;
        }

        list.innerHTML = messages.map((message) => {
            const linkedName = reservationName(message.reservationId);
            const sender = message.fromName || message.fromEmail || t('mail.unknownSender');
            return `
                <button class="mail-row" type="button" onclick="openMailDetail('${message.id}')">
                    <span class="mail-row-main">
                        <span class="mail-row-title">${escapeHtml(message.subject)}</span>
                        <span class="mail-row-meta">${escapeHtml(sender)} · ${formatDateDisplay(message.sentAt)}</span>
                        <span class="mail-row-preview">${escapeHtml(message.previewText || '')}</span>
                    </span>
                    <span class="mail-row-side">
                        <span class="mail-status mail-status-${message.pmsStatus || 'unassigned'}">${statusLabel(message.pmsStatus)}</span>
                        ${linkedName ? `<span class="mail-linked-res">${escapeHtml(linkedName)}</span>` : ''}
                    </span>
                </button>
            `;
        }).join('');
    }

    async function loadMailMessages() {
        const { API, apiGet, setMailMessages, showToast, t } = requireDeps();
        try {
            const response = await apiGet(`${API.reservations}?action=mailList`);
            setMailMessages(response.messages || []);
            renderMailPage();
        } catch (error) {
            showToast(error.message || t('mail.loadFail'), 'error');
        }
    }

    async function syncMail() {
        const { API, apiPost, setMailMessages, showToast, t } = requireDeps();
        try {
            const response = await apiPost(`${API.reservations}?action=syncMail`, {});
            setMailMessages(response.messages || []);
            showToast(t('mail.syncDone'), 'success');
            await loadMailMessages();
        } catch (error) {
            showToast(error.message || t('mail.syncFail'), 'error');
        }
    }

    function renderReservationOptions(selectedId) {
        const { escapeHtml, getReservations, t } = requireDeps();
        const groups = getReservations().filter((reservation) => (reservation.resType || 'group') === 'group');
        return [
            `<option value="">${t('mail.noReservation')}</option>`,
            ...groups.map((reservation) => `
                <option value="${reservation.id}" ${reservation.id === selectedId ? 'selected' : ''}>
                    ${escapeHtml(reservation.groupName)}
                </option>
            `)
        ].join('');
    }

    function openMailDetail(id) {
        const { escapeHtml, formatDateDisplay, getMailMessages, openModal, t } = requireDeps();
        const message = getMailMessages().find((entry) => entry.id === id);
        if (!message) return;

        document.getElementById('mailDetailTitle').textContent = message.subject || t('mail.detailTitle');
        document.getElementById('mailDetailBody').innerHTML = `
            <div class="mail-detail-meta">
                <div><strong>${t('mail.from')}</strong> ${escapeHtml(message.fromName || message.fromEmail || '')}</div>
                <div><strong>${t('mail.to')}</strong> ${escapeHtml(message.toText || '')}</div>
                <div><strong>${t('mail.date')}</strong> ${formatDateDisplay(message.sentAt)}</div>
                ${message.hasAttachments ? `<div><strong>${t('mail.attachments')}</strong> ${t('mail.attachmentsPresent')}</div>` : ''}
            </div>
            <div class="mail-detail-actions">
                <select id="mailReservationSelect">${renderReservationOptions(message.reservationId)}</select>
                <button class="btn btn-primary btn-sm" type="button" onclick="assignMailToReservation('${message.id}')">${t('mail.assign')}</button>
                <button class="btn btn-secondary btn-sm" type="button" onclick="markMailHandled('${message.id}')">${t('mail.markHandled')}</button>
                <button class="btn btn-secondary btn-sm" type="button" onclick="archiveMail('${message.id}')">${t('mail.archive')}</button>
            </div>
            <div class="mail-detail-body-text">${escapeHtml(message.bodyText || message.previewText || '')}</div>
        `;
        openModal('mailDetailModal');
    }

    async function updateMailMessage(id, payload) {
        const { API, apiPost, getMailMessages, setMailMessages, showToast, t } = requireDeps();
        try {
            const response = await apiPost(`${API.reservations}?action=updateMailMessage`, { id, ...payload });
            const updated = response.message;
            setMailMessages(getMailMessages().map((message) => message.id === updated.id ? updated : message));
            renderMailPage();
            openMailDetail(updated.id);
            showToast(t('mail.updated'), 'success');
        } catch (error) {
            showToast(error.message || t('mail.updateFail'), 'error');
        }
    }

    function assignMailToReservation(id) {
        const select = document.getElementById('mailReservationSelect');
        updateMailMessage(id, { reservationId: select ? select.value : '' });
    }

    function markMailHandled(id) {
        const select = document.getElementById('mailReservationSelect');
        updateMailMessage(id, { reservationId: select ? select.value : '', pmsStatus: 'handled' });
    }

    function archiveMail(id) {
        const select = document.getElementById('mailReservationSelect');
        updateMailMessage(id, { reservationId: select ? select.value : '', pmsStatus: 'archived' });
    }

    function setMailFilter(filter) {
        currentFilter = filter || 'all';
        document.querySelectorAll('#page-mail .chip').forEach((chip) => {
            chip.classList.toggle('active', chip.dataset.mailFilter === currentFilter);
        });
        renderMailPage();
    }

    function filterMail() {
        const input = document.getElementById('mailSearchInput');
        currentSearch = input ? input.value : '';
        renderMailPage();
    }

    async function saveMailSettings() {
        const { API, apiPost, setMailAccount, showToast, t } = requireDeps();
        const payload = {
            email: document.getElementById('mailSettingEmail').value,
            username: document.getElementById('mailSettingUsername').value,
            password: document.getElementById('mailSettingPassword').value,
            host: document.getElementById('mailSettingHost').value,
            port: document.getElementById('mailSettingPort').value,
            secure: document.getElementById('mailSettingSecure').checked
        };
        try {
            const response = await apiPost(`${API.auth}?action=saveMailSettings`, payload);
            setMailAccount(response.mailAccount);
            document.getElementById('mailSettingPassword').value = '';
            showToast(t('mail.settingsSaved'), 'success');
            renderMailPage();
        } catch (error) {
            showToast(error.message || t('mail.settingsSaveFail'), 'error');
        }
    }

    async function testMailConnection() {
        const { API, apiPost, setMailAccount, showToast, t } = requireDeps();
        try {
            const response = await apiPost(`${API.auth}?action=testMailConnection`, {});
            setMailAccount(response.mailAccount);
            showToast(t('mail.connectionOk'), 'success');
        } catch (error) {
            showToast(error.message || t('mail.connectionFail'), 'error');
        }
    }

    function syncMailSettingsInputs(account) {
        if (!account?.configured) return;
        const fields = {
            mailSettingEmail: account.email || '',
            mailSettingUsername: account.username || '',
            mailSettingHost: account.host || 'imaps.aruba.it',
            mailSettingPort: account.port || 993
        };
        Object.entries(fields).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        });
        const secure = document.getElementById('mailSettingSecure');
        if (secure) secure.checked = account.secure !== false;
    }

    global.GroupStayMail = {
        init(nextDeps) {
            deps = nextDeps;
        },
        archiveMail,
        assignMailToReservation,
        filterMail,
        loadMailMessages,
        markMailHandled,
        openMailDetail,
        renderMailPage,
        saveMailSettings,
        setMailFilter,
        syncMail,
        syncMailSettingsInputs,
        testMailConnection
    };
})(window);
```

- [ ] **Step 4: Wire mail state and feature init in `script.js`**

Add `mailAccount` and `mailMessages` near other state variables:

```js
let mailAccount = { configured: false };
let mailMessages = [];
```

Add after `window.GroupStayReservationDetail.init(...)`:

```js
window.GroupStayMail.init({
    API,
    apiGet,
    apiPost,
    escapeHtml,
    formatDateDisplay,
    getMailAccount: () => mailAccount,
    getMailMessages: () => mailMessages,
    getReservations: () => reservations,
    openModal,
    setMailAccount: (nextAccount) => { mailAccount = nextAccount || { configured: false }; },
    setMailMessages: (nextMessages) => { mailMessages = nextMessages || []; },
    showToast,
    t
});
```

In `loadAllData`, after setting `agendaItems`, add:

```js
        const authData = await apiGet(API.auth).catch(() => ({}));
        mailAccount = authData.mailAccount || { configured: false };
        if (mailAccount.configured) {
            const mailData = await apiGet(`${API.reservations}?action=mailList`).catch(() => ({ messages: [] }));
            mailMessages = mailData.messages || [];
        } else {
            mailMessages = [];
        }
        syncMailSettingsInputs(mailAccount);
```

In `navigateTo(page)`, add:

```js
        case 'mail': renderMailPage(); break;
```

Add wrappers near other feature wrappers:

```js
function renderMailPage() { return window.GroupStayMail.renderMailPage(); }
function syncMail() { return window.GroupStayMail.syncMail(); }
function openMailDetail(id) { return window.GroupStayMail.openMailDetail(id); }
function setMailFilter(filter) { return window.GroupStayMail.setMailFilter(filter); }
function filterMail() { return window.GroupStayMail.filterMail(); }
function assignMailToReservation(id) { return window.GroupStayMail.assignMailToReservation(id); }
function markMailHandled(id) { return window.GroupStayMail.markMailHandled(id); }
function archiveMail(id) { return window.GroupStayMail.archiveMail(id); }
function saveMailSettings() { return window.GroupStayMail.saveMailSettings(); }
function testMailConnection() { return window.GroupStayMail.testMailConnection(); }
function syncMailSettingsInputs(account) { return window.GroupStayMail.syncMailSettingsInputs(account); }
```

- [ ] **Step 5: Run frontend feature test**

Run:

```powershell
node --test tests/mail-feature.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Run all tests and commit**

Run:

```powershell
npm test
```

Expected: PASS.

Commit:

```powershell
git add js\features\mail.js script.js tests\mail-feature.test.mjs
git commit -m "feat: add mail frontend module"
```

---

### Task 5: HTML Integration And Styling

**Files:**
- Modify: `index.html`
- Modify: `css/02-lists-data.css`
- Modify: `script.js`

- [ ] **Step 1: Add Mail navigation to desktop sidebar**

In `index.html`, add this after the Calendar nav item:

```html
            <a href="#" class="nav-item" data-page="mail">
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="m4.5 7 7.5 6 7.5-6"/></svg>
                <span data-i18n="nav.mail">Mail</span>
            </a>
```

- [ ] **Step 2: Add Mail to mobile More menu**

In `index.html`, add this as the first `.mobile-more-action` inside `mobileMoreModal`:

```html
                <button class="mobile-more-action" type="button" onclick="closeModal('mobileMoreModal'); navigateTo('mail')">
                    <span class="mobile-more-action-copy">
                        <strong data-i18n="nav.mail">Mail</strong>
                        <span>Richieste e conversazioni collegate ai gruppi</span>
                    </span>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
```

Update `resolveActiveNavPage` in `script.js`:

```js
    if (isMobileViewport() && ['management', 'compliance', 'guests', 'mail'].includes(page)) {
```

- [ ] **Step 3: Add Mail page markup**

In `index.html`, add after `page-reservations`:

```html
        <section class="page" id="page-mail">
            <div class="page-header">
                <div>
                    <h1 data-i18n="mail.title">Mail</h1>
                    <p class="page-subtitle" data-i18n="mail.subtitle">Richieste in arrivo e conversazioni collegate ai gruppi</p>
                </div>
                <div class="page-actions">
                    <span class="mail-last-sync" id="mailLastSync">Mai sincronizzata</span>
                    <button class="btn btn-primary" type="button" onclick="syncMail()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 1-15.5 6.25"/><path d="M3 12A9 9 0 0 1 18.5 5.75"/><path d="M18 2v4h4"/><path d="M6 22v-4H2"/></svg>
                        <span data-i18n="mail.sync">Aggiorna mail</span>
                    </button>
                </div>
            </div>
            <div class="filters-bar">
                <div class="search-box">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input id="mailSearchInput" type="text" aria-label="Cerca mail" oninput="filterMail()">
                </div>
                <div class="filter-chips">
                    <button class="chip active" type="button" data-mail-filter="all" onclick="setMailFilter('all')" data-i18n="mail.filter.all">Tutte</button>
                    <button class="chip" type="button" data-mail-filter="unassigned" onclick="setMailFilter('unassigned')" data-i18n="mail.filter.unassigned">Non assegnate</button>
                    <button class="chip" type="button" data-mail-filter="assigned" onclick="setMailFilter('assigned')" data-i18n="mail.filter.assigned">Assegnate</button>
                    <button class="chip" type="button" data-mail-filter="handled" onclick="setMailFilter('handled')" data-i18n="mail.filter.handled">Gestite</button>
                    <button class="chip" type="button" data-mail-filter="archived" onclick="setMailFilter('archived')" data-i18n="mail.filter.archived">Archiviate</button>
                </div>
            </div>
            <div class="mail-list" id="mailList"></div>
        </section>
```

- [ ] **Step 4: Add mail settings fields**

In `index.html`, inside `settingsModal` before the Scidoo import section, add:

```html
                <div class="settings-section">
                    <label class="settings-label" data-i18n="mail.settingsTitle">Casella email Aruba</label>
                    <p style="font-size:12px;color:var(--text-secondary);margin:0 0 10px" data-i18n="mail.settingsDesc">Configura la casella IMAP da sincronizzare in sola lettura.</p>
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="mailSettingEmail">Email</label>
                            <input type="email" id="mailSettingEmail" aria-label="Email Aruba">
                        </div>
                        <div class="form-group">
                            <label for="mailSettingUsername">Username IMAP</label>
                            <input type="text" id="mailSettingUsername" aria-label="Username IMAP">
                        </div>
                        <div class="form-group">
                            <label for="mailSettingPassword">Password IMAP</label>
                            <input type="password" id="mailSettingPassword" autocomplete="new-password" aria-label="Password IMAP">
                        </div>
                        <div class="form-group">
                            <label for="mailSettingHost">Host IMAP</label>
                            <input type="text" id="mailSettingHost" value="imaps.aruba.it">
                        </div>
                        <div class="form-group">
                            <label for="mailSettingPort">Porta</label>
                            <input type="number" id="mailSettingPort" value="993" min="1" max="65535">
                        </div>
                        <div class="form-group">
                            <label class="auth-remember" for="mailSettingSecure" style="margin-top:28px">
                                <input type="checkbox" id="mailSettingSecure" checked>
                                <span>Connessione sicura SSL/TLS</span>
                            </label>
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
                        <button class="btn btn-primary" type="button" onclick="saveMailSettings()" data-i18n="mail.saveSettings">Salva casella</button>
                        <button class="btn btn-secondary" type="button" onclick="testMailConnection()" data-i18n="mail.testConnection">Test connessione</button>
                    </div>
                </div>
```

- [ ] **Step 5: Add mail detail modal**

In `index.html`, before `settingsModal`, add:

```html
    <div class="modal-overlay" id="mailDetailModal">
        <div class="modal" style="max-width:760px">
            <div class="modal-header">
                <h2 id="mailDetailTitle">Mail</h2>
                <button class="modal-close" onclick="closeModal('mailDetailModal')">&times;</button>
            </div>
            <div class="modal-body" id="mailDetailBody"></div>
        </div>
    </div>
```

- [ ] **Step 6: Include mail script**

In `index.html`, add before `js/features/reservation-detail.js` or directly after it:

```html
    <script src="js/features/mail.js"></script>
```

Place it before `script.js`.

- [ ] **Step 7: Add mail styles**

Append to `css/02-lists-data.css`:

```css
/* =============================================
   MAIL
   ============================================= */

.mail-last-sync {
    color: var(--text-secondary);
    font-size: 13px;
}

.mail-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.mail-row {
    align-items: center;
    background: var(--bg-secondary);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    color: inherit;
    cursor: pointer;
    display: flex;
    font-family: inherit;
    gap: 16px;
    padding: 16px 18px;
    text-align: left;
    transition: all var(--transition);
    width: 100%;
}

.mail-row:hover {
    border-color: var(--border);
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
}

.mail-row-main {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
}

.mail-row-title {
    color: var(--text-primary);
    font-size: 15px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.mail-row-meta,
.mail-row-preview,
.mail-linked-res {
    color: var(--text-secondary);
    font-size: 12px;
}

.mail-row-preview {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.mail-row-side {
    align-items: flex-end;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.mail-status {
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    padding: 4px 8px;
}

.mail-status-unassigned { background: var(--bg-tertiary); color: var(--text-secondary); }
.mail-status-assigned { background: var(--accent-light); color: var(--accent); }
.mail-status-handled { background: rgba(52, 199, 89, 0.12); color: var(--green); }
.mail-status-archived { background: rgba(142, 142, 147, 0.14); color: var(--text-secondary); }

.mail-detail-meta {
    border-bottom: 1px solid var(--border-light);
    color: var(--text-secondary);
    display: grid;
    gap: 8px;
    font-size: 13px;
    padding-bottom: 14px;
}

.mail-detail-actions {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 16px 0;
}

.mail-detail-actions select {
    min-width: 220px;
}

.mail-detail-body-text {
    background: var(--bg-primary);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    color: var(--text-primary);
    font-size: 14px;
    line-height: 1.55;
    max-height: 420px;
    overflow: auto;
    padding: 14px;
    white-space: pre-wrap;
}
```

- [ ] **Step 8: Add translations in `script.js`**

Inside the translations object, add:

```js
    'nav.mail': { en: 'Mail', it: 'Mail' },
    'mail.title': { en: 'Mail', it: 'Mail' },
    'mail.subtitle': { en: 'Incoming requests and conversations linked to groups', it: 'Richieste in arrivo e conversazioni collegate ai gruppi' },
    'mail.sync': { en: 'Sync mail', it: 'Aggiorna mail' },
    'mail.lastSync': { en: 'Last sync:', it: 'Ultima sincronizzazione:' },
    'mail.neverSynced': { en: 'Never synced', it: 'Mai sincronizzata' },
    'mail.configurePrompt': { en: 'Configure your Aruba mailbox to start syncing mail.', it: 'Configura la casella Aruba per iniziare a sincronizzare le mail.' },
    'mail.openSettings': { en: 'Open settings', it: 'Apri impostazioni' },
    'mail.empty': { en: 'No mail found', it: 'Nessuna mail trovata' },
    'mail.unknownSender': { en: 'Unknown sender', it: 'Mittente sconosciuto' },
    'mail.filter.all': { en: 'All', it: 'Tutte' },
    'mail.filter.unassigned': { en: 'Unassigned', it: 'Non assegnate' },
    'mail.filter.assigned': { en: 'Assigned', it: 'Assegnate' },
    'mail.filter.handled': { en: 'Handled', it: 'Gestite' },
    'mail.filter.archived': { en: 'Archived', it: 'Archiviate' },
    'mail.status.unassigned': { en: 'Unassigned', it: 'Non assegnata' },
    'mail.status.assigned': { en: 'Assigned', it: 'Assegnata' },
    'mail.status.handled': { en: 'Handled', it: 'Gestita' },
    'mail.status.archived': { en: 'Archived', it: 'Archiviata' },
    'mail.detailTitle': { en: 'Mail detail', it: 'Dettaglio mail' },
    'mail.from': { en: 'From', it: 'Da' },
    'mail.to': { en: 'To', it: 'A' },
    'mail.date': { en: 'Date', it: 'Data' },
    'mail.attachments': { en: 'Attachments', it: 'Allegati' },
    'mail.attachmentsPresent': { en: 'Present but not saved in PMS', it: 'Presenti ma non salvati nel PMS' },
    'mail.noReservation': { en: 'No reservation', it: 'Nessuna prenotazione' },
    'mail.assign': { en: 'Assign', it: 'Assegna' },
    'mail.markHandled': { en: 'Mark handled', it: 'Segna gestita' },
    'mail.archive': { en: 'Archive in PMS', it: 'Archivia nel PMS' },
    'mail.updated': { en: 'Mail updated', it: 'Mail aggiornata' },
    'mail.updateFail': { en: 'Unable to update mail', it: 'Impossibile aggiornare la mail' },
    'mail.loadFail': { en: 'Unable to load mail', it: 'Impossibile caricare le mail' },
    'mail.syncDone': { en: 'Mail synchronized', it: 'Mail sincronizzate' },
    'mail.syncFail': { en: 'Unable to synchronize mail', it: 'Impossibile sincronizzare le mail' },
    'mail.settingsTitle': { en: 'Aruba mailbox', it: 'Casella email Aruba' },
    'mail.settingsDesc': { en: 'Configure the IMAP mailbox to sync read-only.', it: 'Configura la casella IMAP da sincronizzare in sola lettura.' },
    'mail.saveSettings': { en: 'Save mailbox', it: 'Salva casella' },
    'mail.testConnection': { en: 'Test connection', it: 'Test connessione' },
    'mail.settingsSaved': { en: 'Mailbox settings saved', it: 'Impostazioni casella salvate' },
    'mail.settingsSaveFail': { en: 'Unable to save mailbox settings', it: 'Impossibile salvare le impostazioni della casella' },
    'mail.connectionOk': { en: 'Connection successful', it: 'Connessione riuscita' },
    'mail.connectionFail': { en: 'Connection failed', it: 'Connessione non riuscita' },
```

- [ ] **Step 9: Run all tests and commit**

Run:

```powershell
npm test
```

Expected: PASS.

Commit:

```powershell
git add index.html css\02-lists-data.css script.js
git commit -m "feat: add mail interface"
```

---

### Task 6: Reservation Detail Linked Mail

**Files:**
- Modify: `js/features/reservation-detail.js`
- Modify: `script.js`
- Test: `tests/mail-feature.test.mjs`

- [ ] **Step 1: Extend mail feature test for reservation-linked rendering helper**

Append to `tests/mail-feature.test.mjs`:

```js
test('renderLinkedReservationMail returns compact linked mail rows', () => {
  const { mail } = loadMailFeature();
  mail.init({
    escapeHtml: String,
    formatDateDisplay: (value) => value,
    getMailAccount: () => ({ configured: true }),
    getMailMessages: () => [{
      id: 'mail-1',
      fromName: 'Mario',
      fromEmail: 'mario@example.it',
      subject: 'Gruppo maggio',
      sentAt: '2026-05-03',
      previewText: 'Vorrei un preventivo',
      pmsStatus: 'assigned',
      reservationId: 'res-1'
    }],
    getReservations: () => [{ id: 'res-1', groupName: 'Gruppo Verdi', resType: 'group' }],
    openModal() {},
    showToast() {},
    t: (key) => key
  });

  const html = mail.renderLinkedReservationMail('res-1');

  assert.match(html, /Gruppo maggio/);
  assert.match(html, /openMailDetail\('mail-1'\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
node --test tests/mail-feature.test.mjs
```

Expected: FAIL because `renderLinkedReservationMail` is not exported.

- [ ] **Step 3: Add linked mail renderer to `js/features/mail.js`**

Add before `global.GroupStayMail = {`:

```js
    function renderLinkedReservationMail(reservationId) {
        const { escapeHtml, formatDateDisplay, getMailMessages, t } = requireDeps();
        const linked = getMailMessages().filter((message) => message.reservationId === reservationId);
        if (linked.length === 0) {
            return `<div class="files-empty">${t('mail.noLinkedMail')}</div>`;
        }
        return linked.map((message) => `
            <button class="mail-linked-row" type="button" onclick="openMailDetail('${message.id}')">
                <span>
                    <strong>${escapeHtml(message.subject)}</strong>
                    <small>${escapeHtml(message.fromName || message.fromEmail || '')} · ${formatDateDisplay(message.sentAt)}</small>
                </span>
                <span class="mail-status mail-status-${message.pmsStatus || 'unassigned'}">${statusLabel(message.pmsStatus)}</span>
            </button>
        `).join('');
    }
```

Add `renderLinkedReservationMail` to the exported object.

- [ ] **Step 4: Wire dependency into reservation detail init**

In `script.js`, inside `window.GroupStayReservationDetail.init({ ... })`, add:

```js
    renderLinkedReservationMail: (reservationId) => window.GroupStayMail.renderLinkedReservationMail(reservationId),
```

- [ ] **Step 5: Add section to `js/features/reservation-detail.js`**

In the destructuring at the top of `openReservationDetail`, add:

```js
            renderLinkedReservationMail,
```

In the HTML template, place this block before the files section and only for group reservations:

```js
            ${reservation.resType !== 'individual' ? `
            <div class="detail-files-section">
                <div class="detail-files-header">
                    <span class="detail-info-label">${t('mail.linkedTitle')}</span>
                </div>
                <div class="mail-linked-list">
                    ${renderLinkedReservationMail(reservation.id)}
                </div>
            </div>` : ''}
```

- [ ] **Step 6: Add styles for linked rows**

Append to `css/02-lists-data.css`:

```css
.mail-linked-list {
    display: grid;
    gap: 8px;
}

.mail-linked-row {
    align-items: center;
    background: var(--bg-primary);
    border: 1px solid var(--border-light);
    border-radius: var(--radius-md);
    color: inherit;
    cursor: pointer;
    display: flex;
    font-family: inherit;
    justify-content: space-between;
    padding: 10px 12px;
    text-align: left;
    width: 100%;
}

.mail-linked-row strong,
.mail-linked-row small {
    display: block;
}

.mail-linked-row small {
    color: var(--text-secondary);
    font-size: 12px;
    margin-top: 3px;
}
```

- [ ] **Step 7: Add translation**

Add to the translations object in `script.js`:

```js
    'mail.linkedTitle': { en: 'Linked mail', it: 'Mail collegate' },
    'mail.noLinkedMail': { en: 'No linked mail', it: 'Nessuna mail collegata' },
```

- [ ] **Step 8: Run all tests and commit**

Run:

```powershell
npm test
```

Expected: PASS.

Commit:

```powershell
git add js\features\mail.js js\features\reservation-detail.js css\02-lists-data.css script.js tests\mail-feature.test.mjs
git commit -m "feat: link mail to reservation details"
```

---

### Task 7: Verification And Manual Aruba Check

**Files:**
- Verify only unless fixes are needed.

- [ ] **Step 1: Run the full automated suite**

Run:

```powershell
npm test
```

Expected: PASS.

- [ ] **Step 2: Check Vercel route count did not increase**

Run:

```powershell
Get-ChildItem api -File | Where-Object { $_.Name -notlike '_*' } | Select-Object -ExpandProperty Name
```

Expected: the list contains the same route files as before; no `mail.js` or `mail-settings.js` exists.

- [ ] **Step 3: Confirm helper files are route-safe**

Run:

```powershell
Get-ChildItem api -File -Filter _mail*.js | Select-Object -ExpandProperty Name
```

Expected:

```text
_mail-crypto.js
_mail-utils.js
_mail.js
```

- [ ] **Step 4: Run a syntax check for changed backend modules**

Run:

```powershell
node --check api\auth.js
node --check api\reservations.js
node --check api\init.js
node --check api\_mail.js
node --check api\_mail-crypto.js
node --check api\_mail-utils.js
```

Expected: no syntax errors.

- [ ] **Step 5: Manual verification with Aruba credentials**

Use the deployed or local Vercel-compatible environment. `DATABASE_URL` must be the same Neon connection string already used by this project, and `MAIL_CREDENTIALS_SECRET` must be set to a private value with at least 16 characters, for example:

```text
MAIL_CREDENTIALS_SECRET=change-this-private-mail-secret-2026
```

Verify:

- Login works.
- Settings modal saves Aruba IMAP host `imaps.aruba.it`, port `993`, secure enabled.
- Test connection returns success.
- Mail page shows the configured account prompt disappears.
- "Aggiorna mail" imports up to 200 messages.
- Aruba webmail still shows messages in the same folder and read state.
- Assign one mail to a group reservation.
- Open that reservation detail and see the mail in "Mail collegate".
- Change the linked reservation from the mail detail.
- Mark a mail handled.
- Archive a mail inside the PMS.

- [ ] **Step 6: Final commit for any verification fixes**

If verification required fixes, inspect the changed files:

```powershell
git status --short
```

Stage only the files changed for those fixes, then commit:

```powershell
git commit -m "fix: stabilize mail inbox verification"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: the plan covers per-user Aruba settings, encrypted DB credentials, latest 200 IMAP sync, local DB copy, PMS-only assignment/status, no attachment storage, linked reservation detail, and zero new serverless route files.
- Serverless constraint: all exposed actions reuse `api/auth.js`, `api/reservations.js`, and `api/init.js`; new backend files are `_mail*.js` helpers.
- Testing coverage: crypto, normalization, frontend rendering, existing suite, syntax checks, route-count check, and manual Aruba verification are included.
- Scope check: sending email, automatic sync, multiple mailboxes, and attachment persistence are excluded.
