import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_RAW_MESSAGE_BYTES,
  createMailService,
  ensureMailTables,
} from '../api/_mail.js';
import { encryptSecret } from '../api/_mail-crypto.js';

process.env.MAIL_CREDENTIALS_SECRET = 'mail-test-secret-2026';

function normalizeSqlText(strings) {
  return strings.join('?').replace(/\s+/g, ' ').trim();
}

function createSyncSql() {
  const state = {
    account: {
      owner_user_id: 'user_1',
      imap_email: 'front@example.com',
      imap_username: 'front@example.com',
      imap_host: 'imaps.aruba.it',
      imap_port: 993,
      imap_secure: true,
      encrypted_password: encryptSecret('secret-password'),
      last_tested_at: null,
      last_sync_at: null,
    },
    messages: [],
    calls: [],
    syncUpdated: false,
  };

  const sql = async (strings, ...values) => {
    const text = normalizeSqlText(strings);
    state.calls.push({ text, values });

    if (text.startsWith('SELECT * FROM mail_accounts')) {
      return [state.account];
    }

    if (text.startsWith('INSERT INTO mail_messages')) {
      const row = {
        id: values[0],
        owner_user_id: values[1],
        provider_uid: values[2],
        message_id: values[3],
        mailbox: values[4],
        from_name: values[5],
        from_email: values[6],
        to_text: values[7],
        subject: values[8],
        sent_at: values[9],
        preview_text: values[10],
        body_text: values[11],
        body_html: values[12],
        has_attachments: values[13],
        pms_status: values[14],
        reservation_id: null,
        synced_at: '2026-05-04T10:00:00.000Z',
        created_at: '2026-05-04T10:00:00.000Z',
        updated_at: '2026-05-04T10:00:00.000Z',
      };
      state.messages.push(row);
      return [row];
    }

    if (text.startsWith('UPDATE mail_accounts')) {
      state.syncUpdated = true;
      return [];
    }

    throw new Error(`Unexpected SQL: ${text}`);
  };

  sql.state = state;
  return sql;
}

function makeClientClass(fetchItems) {
  return class FakeClient {
    static instances = [];

    constructor(config) {
      this.config = config;
      this.actions = [];
      FakeClient.instances.push(this);
    }

    async connect() {
      this.actions.push(['connect']);
    }

    async mailboxOpen(mailbox, options) {
      this.actions.push(['mailboxOpen', mailbox, options]);
      return { exists: fetchItems.length };
    }

    async *fetch(range, options) {
      this.actions.push(['fetch', range, options]);
      for (const item of fetchItems) {
        yield item;
      }
    }

    async logout() {
      this.actions.push(['logout']);
    }
  };
}

async function parser(source) {
  const token = Buffer.from(source).toString('utf8');

  if (token === 'bad') {
    throw new Error('Cannot parse message');
  }

  return {
    messageId: `<${token}@example.com>`,
    from: { value: [{ name: 'Front Desk', address: 'Front@Example.COM' }] },
    to: { text: 'hotel@example.com' },
    subject: `Subject ${token}`,
    text: `Body ${token}`,
    html: '<script>alert("xss")</script>',
    date: new Date('2026-05-04T09:30:00.000Z'),
    attachments: token === 'attach' ? [{ filename: 'voucher.pdf' }] : [],
  };
}

test('syncMailMessages opens INBOX readOnly, sanitizes body HTML, and logs out', async () => {
  const ClientClass = makeClientClass([
    { uid: 10, source: Buffer.from('ok') },
    { uid: 11, source: Buffer.from('attach') },
  ]);
  const service = createMailService({ ClientClass, parser });
  const sql = createSyncSql();

  const result = await service.syncMailMessages(sql, 'user_1');
  const client = ClientClass.instances[0];

  assert.deepEqual(client.actions, [
    ['connect'],
    ['mailboxOpen', 'INBOX', { readOnly: true }],
    ['fetch', '1:2', { uid: true, source: { start: 0, maxLength: MAX_RAW_MESSAGE_BYTES + 1 } }],
    ['logout'],
  ]);
  assert.equal(client.config.host, 'imaps.aruba.it');
  assert.equal(client.config.port, 993);
  assert.equal(client.config.secure, true);
  assert.equal(result.syncedCount, 2);
  assert.equal(result.failedCount, 0);
  assert.deepEqual(result.failedUids, []);
  assert.equal(result.messages[0].bodyHtml, '');
  assert.equal(sql.state.messages[1].has_attachments, true);
  assert.equal(sql.state.syncUpdated, true);
});

test('syncMailMessages continues after parser failure and reports failed UID', async () => {
  const ClientClass = makeClientClass([
    { uid: 20, source: Buffer.from('bad') },
    { uid: 21, source: Buffer.from('ok') },
  ]);
  const service = createMailService({ ClientClass, parser });
  const sql = createSyncSql();

  const result = await service.syncMailMessages(sql, 'user_1');

  assert.equal(result.syncedCount, 1);
  assert.equal(result.failedCount, 1);
  assert.deepEqual(result.failedUids, [20]);
  assert.equal(result.messages[0].providerUid, 'INBOX:21');
  assert.equal(sql.state.syncUpdated, true);
  assert.deepEqual(ClientClass.instances[0].actions.at(-1), ['logout']);
});

test('syncMailMessages skips oversized raw messages before parsing', async () => {
  let parseCalls = 0;
  const ClientClass = makeClientClass([
    { uid: 30, source: Buffer.alloc(MAX_RAW_MESSAGE_BYTES + 1, 'x') },
  ]);
  const service = createMailService({
    ClientClass,
    parser: async (source) => {
      parseCalls += 1;
      return parser(source);
    },
  });
  const sql = createSyncSql();

  const result = await service.syncMailMessages(sql, 'user_1');

  assert.equal(parseCalls, 0);
  assert.equal(result.syncedCount, 0);
  assert.equal(result.failedCount, 1);
  assert.deepEqual(result.failedUids, [30]);
  assert.equal(sql.state.messages.length, 0);
  assert.equal(sql.state.syncUpdated, true);
});

test('ensureMailTables creates mail tables and indexes idempotently', async () => {
  const calls = [];
  const sql = async (strings) => {
    calls.push(normalizeSqlText(strings));
    return [];
  };

  await ensureMailTables(sql);

  assert.ok(calls.some((text) => text.startsWith('CREATE TABLE IF NOT EXISTS mail_accounts')));
  assert.ok(calls.some((text) => text.startsWith('CREATE TABLE IF NOT EXISTS mail_messages')));
  assert.ok(calls.find((text) => text.startsWith('CREATE TABLE IF NOT EXISTS mail_messages')).includes('reservation_id TEXT,'));
  assert.ok(calls.some((text) => text.includes("to_regclass('reservations') IS NOT NULL")));
  assert.ok(calls.includes('CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_messages_owner_provider_uid ON mail_messages(owner_user_id, provider_uid)'));
  assert.ok(calls.includes('CREATE INDEX IF NOT EXISTS idx_mail_messages_owner_sent_at ON mail_messages(owner_user_id, sent_at DESC)'));
  assert.ok(calls.includes('CREATE INDEX IF NOT EXISTS idx_mail_messages_owner_reservation ON mail_messages(owner_user_id, reservation_id)'));
});
