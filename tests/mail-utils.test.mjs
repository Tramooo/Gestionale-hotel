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
import {
  getMailAccount,
  getSanitizedMailAccount,
  listMailMessages,
  saveMailAccount,
  updateMailMessage,
} from '../api/_mail.js';

process.env.MAIL_CREDENTIALS_SECRET = 'mail-test-secret-2026';

function normalizeSqlText(strings) {
  return strings.join('?').replace(/\s+/g, ' ').trim();
}

function createMailServiceSql({
  account = null,
  messages = [],
  reservations = [],
} = {}) {
  const state = {
    account,
    messages: [...messages],
    reservations: [...reservations],
    calls: [],
  };

  const sql = async (strings, ...values) => {
    const text = normalizeSqlText(strings);
    state.calls.push({ text, values });

    if (text.startsWith('SELECT * FROM mail_accounts')) {
      return state.account ? [state.account] : [];
    }

    if (text.startsWith('INSERT INTO mail_accounts')) {
      const [
        ownerUserId,
        email,
        username,
        host,
        port,
        secure,
        encryptedPassword,
      ] = values;
      state.account = {
        owner_user_id: ownerUserId,
        imap_email: email,
        imap_username: username,
        imap_host: host,
        imap_port: port,
        imap_secure: secure,
        encrypted_password: encryptedPassword,
        last_tested_at: null,
        last_sync_at: null,
        created_at: '2026-05-04T08:00:00.000Z',
        updated_at: '2026-05-04T09:00:00.000Z',
      };

      return [state.account];
    }

    if (text.includes('FROM mail_messages')) {
      return state.messages;
    }

    if (text.startsWith('SELECT id FROM reservations')) {
      const [reservationId, ownerUserId] = values;
      return state.reservations.filter(
        (reservation) => reservation.id === reservationId
          && reservation.owner_user_id === ownerUserId
          && (reservation.res_type ?? 'group') === 'group',
      );
    }

    if (text.startsWith('UPDATE mail_messages')) {
      const [reservationId, pmsStatus, id, ownerUserId] = values;
      const message = state.messages.find(
        (row) => row.id === id && row.owner_user_id === ownerUserId,
      );

      if (!message) {
        return [];
      }

      Object.assign(message, {
        reservation_id: reservationId,
        pms_status: pmsStatus,
        updated_at: '2026-05-04T10:00:00.000Z',
      });

      return [message];
    }

    throw new Error(`Unexpected SQL: ${text}`);
  };

  sql.state = state;
  return sql;
}

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

test('getMailAccount scopes account lookup by owner and returns the database row', async () => {
  const sql = createMailServiceSql({
    account: {
      owner_user_id: 'user_1',
      imap_email: 'front@example.com',
      imap_username: 'front@example.com',
      imap_host: 'imaps.aruba.it',
      imap_port: 993,
      imap_secure: true,
      encrypted_password: 'v1:token',
      last_tested_at: null,
      last_sync_at: null,
    },
  });

  assert.equal((await getMailAccount(sql, 'user_1')).imap_email, 'front@example.com');
  assert.equal(sql.state.calls[0].values[0], 'user_1');
});

test('getSanitizedMailAccount hides encrypted account credentials', async () => {
  const sql = createMailServiceSql({
    account: {
      owner_user_id: 'user_1',
      imap_email: 'front@example.com',
      imap_username: 'desk',
      imap_host: 'imaps.aruba.it',
      imap_port: 993,
      imap_secure: true,
      encrypted_password: 'v1:token',
      last_tested_at: '2026-05-04T09:00:00.000Z',
      last_sync_at: null,
    },
  });

  assert.deepEqual(await getSanitizedMailAccount(sql, 'user_1'), {
    configured: true,
    email: 'front@example.com',
    username: 'desk',
    host: 'imaps.aruba.it',
    port: 993,
    secure: true,
    lastTestedAt: '2026-05-04T09:00:00.000Z',
    lastSyncAt: null,
  });
});

test('saveMailAccount preserves existing encrypted password when blank password is submitted', async () => {
  const sql = createMailServiceSql({
    account: {
      owner_user_id: 'user_1',
      imap_email: 'old@example.com',
      imap_username: 'old',
      imap_host: 'imap.example.com',
      imap_port: 993,
      imap_secure: true,
      encrypted_password: 'v1:existing-token',
      last_tested_at: null,
      last_sync_at: null,
    },
  });

  const result = await saveMailAccount(sql, 'user_1', {
    email: 'Front@Example.COM',
    username: 'front',
    password: '   ',
  });

  assert.equal(sql.state.account.encrypted_password, 'v1:existing-token');
  assert.deepEqual(result, {
    configured: true,
    email: 'front@example.com',
    username: 'front',
    host: 'imaps.aruba.it',
    port: 993,
    secure: true,
    lastTestedAt: null,
    lastSyncAt: null,
  });
});

test('saveMailAccount requires a password when no existing password is configured', async () => {
  const sql = createMailServiceSql();

  await assert.rejects(
    saveMailAccount(sql, 'user_1', {
      email: 'front@example.com',
      username: 'front',
      password: ' ',
    }),
    /Password IMAP obbligatoria/,
  );
});

test('listMailMessages maps scoped message rows with filters', async () => {
  const sql = createMailServiceSql({
    messages: [{
      id: 'msg_1',
      owner_user_id: 'user_1',
      provider_uid: 'INBOX:42',
      message_id: '<id@example.com>',
      mailbox: 'INBOX',
      from_name: 'Mario',
      from_email: 'mario@example.com',
      to_text: 'hotel@example.com',
      subject: 'Prenotazione',
      sent_at: '2026-05-04T08:00:00.000Z',
      preview_text: 'Vorrei una camera',
      body_text: 'Vorrei una camera',
      body_html: '',
      has_attachments: false,
      reservation_id: 'res_1',
      pms_status: 'assigned',
      synced_at: '2026-05-04T08:01:00.000Z',
      created_at: '2026-05-04T08:01:00.000Z',
      updated_at: '2026-05-04T08:01:00.000Z',
    }],
  });

  const messages = await listMailMessages(sql, 'user_1', {
    status: 'assigned',
    reservationId: 'res_1',
    search: 'camera',
  });

  assert.equal(messages[0].id, 'msg_1');
  assert.equal(messages[0].providerUid, 'INBOX:42');
  assert.equal(messages[0].reservationId, 'res_1');
  assert.equal(messages[0].pmsStatus, 'assigned');
  assert.deepEqual(sql.state.calls[0].values, ['user_1', 'assigned', 'res_1', '%camera%']);
});

test('updateMailMessage validates group reservation ownership and computes status', async () => {
  const sql = createMailServiceSql({
    reservations: [{ id: 'res_1', owner_user_id: 'user_1', res_type: 'group' }],
    messages: [{
      id: 'msg_1',
      owner_user_id: 'user_1',
      provider_uid: 'INBOX:42',
      mailbox: 'INBOX',
      subject: 'Prenotazione',
      reservation_id: null,
      pms_status: 'unassigned',
    }],
  });

  const message = await updateMailMessage(sql, 'user_1', {
    id: 'msg_1',
    reservationId: 'res_1',
  });

  assert.equal(message.reservationId, 'res_1');
  assert.equal(message.pmsStatus, 'assigned');
});

test('updateMailMessage rejects reservations outside owned group scope', async () => {
  const sql = createMailServiceSql({
    reservations: [{ id: 'res_1', owner_user_id: 'user_2', res_type: 'group' }],
    messages: [{
      id: 'msg_1',
      owner_user_id: 'user_1',
      provider_uid: 'INBOX:42',
      mailbox: 'INBOX',
      subject: 'Prenotazione',
      reservation_id: null,
      pms_status: 'unassigned',
    }],
  });

  await assert.rejects(
    updateMailMessage(sql, 'user_1', {
      id: 'msg_1',
      reservationId: 'res_1',
    }),
    /Prenotazione non trovata/,
  );
});
