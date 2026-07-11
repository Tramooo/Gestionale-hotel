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
    if (text.includes('FROM information_schema.tables')) return mailTables.map((table_name) => ({ table_name }));
    if (text.includes('SELECT id FROM users')) return values[0] === 'owner-1' ? [{ id: 'owner-1' }] : [];
    return [];
  }
  return { sql, statements };
}

test('baseline refuses an ambiguous legacy ownership backfill', async () => {
  const fake = sqlFake({ unownedCount: 2 });
  await assert.rejects(baseline.up({ sql: fake.sql, options: {} }), /--legacy-owner-user-id/);
});

test('baseline backfills only the explicitly selected existing owner', async () => {
  const fake = sqlFake({ unownedCount: 2 });
  await baseline.up({ sql: fake.sql, options: { legacyOwnerUserId: 'owner-1' } });
  const source = fake.statements.map((entry) => entry.text).join('\n');
  assert.match(source, /UPDATE rooms SET owner_user_id/);
  assert.match(source, /UPDATE reservations SET owner_user_id/);
  assert.match(source, /UPDATE agenda_items SET owner_user_id/);
});

test('Mail tables require explicit backup acknowledgement before drop', async () => {
  const blocked = sqlFake({ mailTables: ['mail_accounts', 'mail_messages'] });
  await assert.rejects(removeMail.up({ sql: blocked.sql, options: {} }), /--ack-mail-backup/);
  const allowed = sqlFake({ mailTables: ['mail_accounts', 'mail_messages'] });
  await removeMail.up({ sql: allowed.sql, options: { mailBackupAcknowledged: true } });
  const source = allowed.statements.map((entry) => entry.text).join('\n');
  assert.match(source, /DROP TABLE IF EXISTS mail_messages/);
  assert.match(source, /DROP TABLE IF EXISTS mail_accounts/);
});

test('fresh databases with no Mail tables need no acknowledgement', async () => {
  const fake = sqlFake({ mailTables: [] });
  await removeMail.up({ sql: fake.sql, options: {} });
  assert.equal(fake.statements.some((entry) => entry.text.includes('DROP TABLE')), false);
});
