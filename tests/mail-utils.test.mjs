import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAIL_STATUSES,
  buildMailPreview,
  computeMailStatus,
  mapMailRow,
  normalizeMailAccountInput,
  normalizeParsedMail,
  sanitizeMailAccount,
} from '../api/_mail-utils.js';

test('normalizeMailAccountInput prepares Aruba IMAP account settings', () => {
  assert.deepEqual(
    normalizeMailAccountInput({
      email: ' Reception@Example.COM ',
      username: ' Reception@Example.COM ',
      password: '  secret  ',
      port: '993',
    }),
    {
      email: 'reception@example.com',
      username: 'Reception@Example.COM',
      password: '  secret  ',
      host: 'imaps.aruba.it',
      port: 993,
      secure: true,
    },
  );
});

test('normalizeMailAccountInput allows blank password and explicit insecure mode', () => {
  assert.deepEqual(
    normalizeMailAccountInput({
      email: 'desk@example.com',
      username: 'DeskUser',
      password: '   ',
      secure: false,
    }),
    {
      email: 'desk@example.com',
      username: 'DeskUser',
      password: '   ',
      host: 'imaps.aruba.it',
      port: 993,
      secure: false,
    },
  );
});

test('normalizeMailAccountInput preserves password whitespace exactly', () => {
  assert.equal(
    normalizeMailAccountInput({
      email: 'desk@example.com',
      username: 'DeskUser',
      password: '  p a s s  ',
    }).password,
    '  p a s s  ',
  );
});

test('normalizeMailAccountInput rejects blank email and username', () => {
  assert.throws(
    () => normalizeMailAccountInput({ email: ' ', username: 'front@example.com' }),
    /email/i,
  );
  assert.throws(
    () => normalizeMailAccountInput({ email: 'front@example.com', username: ' ' }),
    /username/i,
  );
});

test('normalizeMailAccountInput rejects invalid ports', () => {
  for (const port of ['993abc', '0', '70000']) {
    assert.throws(
      () => normalizeMailAccountInput({
        email: 'front@example.com',
        username: 'front@example.com',
        port,
      }),
      /port/i,
    );
  }
});

test('sanitizeMailAccount returns frontend-safe account data', () => {
  const sanitized = sanitizeMailAccount({
    id: 'mail_1',
    imap_email: 'front@example.com',
    imap_username: 'front@example.com',
    imap_host: 'imaps.aruba.it',
    imap_port: 993,
    imap_secure: true,
    last_tested_at: '2026-05-04T10:00:00.000Z',
    last_sync_at: '2026-05-04T10:05:00.000Z',
    encryptedPassword: 'v1:secret',
    encrypted_password: 'v1:secret',
    created_at: '2026-05-04T10:00:00.000Z',
    updated_at: '2026-05-04T10:05:00.000Z',
  });

  assert.deepEqual(sanitized, {
    configured: true,
    email: 'front@example.com',
    username: 'front@example.com',
    host: 'imaps.aruba.it',
    port: 993,
    secure: true,
    lastTestedAt: '2026-05-04T10:00:00.000Z',
    lastSyncAt: '2026-05-04T10:05:00.000Z',
  });
  assert.deepEqual(sanitizeMailAccount(null), { configured: false });
  assert.equal('id' in sanitized, false);
  assert.equal('createdAt' in sanitized, false);
  assert.equal('updatedAt' in sanitized, false);
  assert.equal('encryptedPassword' in sanitized, false);
  assert.equal('encrypted_password' in sanitized, false);
});

test('computeMailStatus derives assignment status while preserving terminal statuses', () => {
  assert.equal(computeMailStatus('', ''), 'unassigned');
  assert.equal(computeMailStatus('reservation_1', ''), 'assigned');
  assert.equal(computeMailStatus('reservation_1', 'handled'), 'handled');
  assert.equal(computeMailStatus('', 'archived'), 'archived');
  assert.equal(MAIL_STATUSES.has('assigned'), true);
});

test('normalizeParsedMail maps parsed message fields', () => {
  assert.deepEqual(
    normalizeParsedMail({
      uid: 42,
      mailbox: 'INBOX',
      parsed: {
        messageId: '<message@example.com>',
        from: { value: [{ name: 'Mario Rossi', address: 'Mario@Example.COM' }] },
        to: { text: 'hotel@example.com' },
        subject: ' Prenotazione ',
        text: 'Buongiorno,\nvorrei una camera.',
        html: '<p>Buongiorno</p>',
        date: new Date('2026-05-04T09:30:00.000Z'),
        attachments: [{ filename: 'voucher.pdf' }],
      },
    }),
    {
      providerUid: 'INBOX:42',
      mailbox: 'INBOX',
      messageId: '<message@example.com>',
      fromName: 'Mario Rossi',
      fromEmail: 'mario@example.com',
      toText: 'hotel@example.com',
      subject: 'Prenotazione',
      sentAt: '2026-05-04T09:30:00.000Z',
      previewText: 'Buongiorno, vorrei una camera.',
      bodyText: 'Buongiorno,\nvorrei una camera.',
      bodyHtml: '<p>Buongiorno</p>',
      hasAttachments: true,
    },
  );
});

test('normalizeParsedMail uses a subject fallback when subject is blank', () => {
  assert.equal(
    normalizeParsedMail({
      uid: 43,
      parsed: {
        subject: ' ',
        from: { value: [] },
      },
    }).subject,
    '(Senza oggetto)',
  );
});

test('normalizeParsedMail returns empty sentAt for invalid dates', () => {
  assert.equal(
    normalizeParsedMail({
      uid: 44,
      parsed: {
        date: new Date('not-a-date'),
      },
    }).sentAt,
    '',
  );
});

test('buildMailPreview collapses whitespace and clips at a word boundary', () => {
  assert.equal(buildMailPreview(' Uno  due\n tre ', 9), 'Uno due...');
});

test('mapMailRow converts database fields to frontend fields', () => {
  assert.deepEqual(
    mapMailRow({
      id: 'msg_1',
      account_id: 'acct_1',
      provider_uid: '99',
      mailbox: 'INBOX',
      message_id: '<id@example.com>',
      from_name: 'Luisa',
      from_email: 'luisa@example.com',
      to_text: 'hotel@example.com',
      subject: 'Info',
      sent_at: '2026-05-04T07:59:00.000Z',
      preview_text: 'Hello',
      body_text: 'Hello body',
      body_html: '<p>Hello body</p>',
      has_attachments: false,
      reservation_id: null,
      pms_status: 'assigned',
      synced_at: '2026-05-04T08:00:00.000Z',
      created_at: '2026-05-04T08:01:00.000Z',
      updated_at: '2026-05-04T08:02:00.000Z',
    }),
    {
      id: 'msg_1',
      providerUid: '99',
      mailbox: 'INBOX',
      messageId: '<id@example.com>',
      fromName: 'Luisa',
      fromEmail: 'luisa@example.com',
      toText: 'hotel@example.com',
      subject: 'Info',
      sentAt: '2026-05-04T07:59:00.000Z',
      previewText: 'Hello',
      bodyText: 'Hello body',
      bodyHtml: '<p>Hello body</p>',
      hasAttachments: false,
      reservationId: '',
      pmsStatus: 'assigned',
      syncedAt: '2026-05-04T08:00:00.000Z',
      createdAt: '2026-05-04T08:01:00.000Z',
      updatedAt: '2026-05-04T08:02:00.000Z',
    },
  );
});
