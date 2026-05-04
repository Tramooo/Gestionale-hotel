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
      username: 'reception@example.com',
      password: 'secret',
      host: 'imaps.aruba.it',
      port: 993,
    },
  );
});

test('sanitizeMailAccount returns frontend-safe account data', () => {
  const sanitized = sanitizeMailAccount({
    id: 'mail_1',
    email: 'front@example.com',
    username: 'front@example.com',
    host: 'imaps.aruba.it',
    port: 993,
    encryptedPassword: 'v1:secret',
    encrypted_password: 'v1:secret',
    created_at: '2026-05-04T10:00:00.000Z',
    updated_at: '2026-05-04T10:05:00.000Z',
  });

  assert.deepEqual(sanitized, {
    id: 'mail_1',
    email: 'front@example.com',
    username: 'front@example.com',
    host: 'imaps.aruba.it',
    port: 993,
    createdAt: '2026-05-04T10:00:00.000Z',
    updatedAt: '2026-05-04T10:05:00.000Z',
  });
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
      mailbox: 'Archive',
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
      providerUid: '42',
      mailbox: 'Archive',
      messageId: '<message@example.com>',
      fromName: 'Mario Rossi',
      fromEmail: 'mario@example.com',
      toText: 'hotel@example.com',
      subject: 'Prenotazione',
      previewText: 'Buongiorno, vorrei una camera.',
      receivedAt: '2026-05-04T09:30:00.000Z',
      hasAttachments: true,
      text: 'Buongiorno,\nvorrei una camera.',
      html: '<p>Buongiorno</p>',
    },
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
      subject: 'Info',
      preview_text: 'Hello',
      received_at: '2026-05-04T08:00:00.000Z',
      has_attachments: false,
      reservation_id: null,
      status: 'assigned',
      created_at: '2026-05-04T08:01:00.000Z',
      updated_at: '2026-05-04T08:02:00.000Z',
    }),
    {
      id: 'msg_1',
      accountId: 'acct_1',
      providerUid: '99',
      mailbox: 'INBOX',
      messageId: '<id@example.com>',
      fromName: 'Luisa',
      fromEmail: 'luisa@example.com',
      subject: 'Info',
      previewText: 'Hello',
      receivedAt: '2026-05-04T08:00:00.000Z',
      hasAttachments: false,
      reservationId: '',
      status: 'assigned',
      createdAt: '2026-05-04T08:01:00.000Z',
      updatedAt: '2026-05-04T08:02:00.000Z',
    },
  );
});
