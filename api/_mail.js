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

const MAILBOX = 'INBOX';
const FETCH_LIMIT = 200;

function requireMailAccount(account) {
  if (!account) {
    throw new Error('Account email non configurato');
  }
}

function createClient(account) {
  return new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    secure: account.imap_secure !== false,
    auth: {
      user: account.imap_username,
      pass: decryptSecret(account.encrypted_password),
    },
    logger: false,
  });
}

function cleanString(value) {
  return String(value ?? '').trim();
}

export async function getMailAccount(sql, userId) {
  const rows = await sql`
    SELECT * FROM mail_accounts
    WHERE owner_user_id = ${userId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function getSanitizedMailAccount(sql, userId) {
  return sanitizeMailAccount(await getMailAccount(sql, userId));
}

export async function saveMailAccount(sql, userId, payload) {
  const input = normalizeMailAccountInput(payload);
  const existing = await getMailAccount(sql, userId);
  const hasNewPassword = input.password.trim() !== '';
  const encryptedPassword = hasNewPassword
    ? encryptSecret(input.password)
    : existing?.encrypted_password;

  if (!encryptedPassword) {
    throw new Error('Password IMAP obbligatoria');
  }

  const rows = await sql`
    INSERT INTO mail_accounts (
      owner_user_id,
      imap_email,
      imap_username,
      imap_host,
      imap_port,
      imap_secure,
      encrypted_password
    )
    VALUES (
      ${userId},
      ${input.email},
      ${input.username},
      ${input.host},
      ${input.port},
      ${input.secure},
      ${encryptedPassword}
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

export async function testMailConnection(sql, userId) {
  const account = await getMailAccount(sql, userId);
  requireMailAccount(account);

  const client = createClient(account);

  try {
    await client.connect();
    await client.mailboxOpen(MAILBOX, { readOnly: true });
  } finally {
    await client.logout().catch(() => {});
  }

  const rows = await sql`
    UPDATE mail_accounts
    SET last_tested_at = NOW(), updated_at = NOW()
    WHERE owner_user_id = ${userId}
    RETURNING *
  `;

  return sanitizeMailAccount(rows[0] ?? account);
}

async function upsertMailMessage(sql, userId, message) {
  const rows = await sql`
    INSERT INTO mail_messages (
      id,
      owner_user_id,
      provider_uid,
      message_id,
      mailbox,
      from_name,
      from_email,
      to_text,
      subject,
      sent_at,
      preview_text,
      body_text,
      body_html,
      has_attachments,
      pms_status
    )
    VALUES (
      ${crypto.randomUUID()},
      ${userId},
      ${message.providerUid},
      ${message.messageId},
      ${message.mailbox},
      ${message.fromName},
      ${message.fromEmail},
      ${message.toText},
      ${message.subject},
      ${message.sentAt || null},
      ${message.previewText},
      ${message.bodyText},
      ${message.bodyHtml},
      ${message.hasAttachments},
      ${'unassigned'}
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

  return rows[0];
}

export async function syncMailMessages(sql, userId) {
  const account = await getMailAccount(sql, userId);
  requireMailAccount(account);

  const client = createClient(account);
  const syncedRows = [];

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen(MAILBOX, { readOnly: true });
    const totalMessages = Number(mailbox?.exists ?? client.mailbox?.exists ?? 0);

    if (totalMessages > 0) {
      const start = Math.max(1, totalMessages - FETCH_LIMIT + 1);
      const range = `${start}:${totalMessages}`;

      for await (const fetched of client.fetch(range, { uid: true, source: true })) {
        if (!fetched?.source) {
          continue;
        }

        const parsed = await simpleParser(fetched.source);
        const normalized = normalizeParsedMail({
          uid: fetched.uid,
          mailbox: MAILBOX,
          parsed,
        });
        syncedRows.push(await upsertMailMessage(sql, userId, normalized));
      }
    }

    await sql`
      UPDATE mail_accounts
      SET last_sync_at = NOW(), updated_at = NOW()
      WHERE owner_user_id = ${userId}
    `;
  } finally {
    await client.logout().catch(() => {});
  }

  return {
    syncedCount: syncedRows.length,
    messages: syncedRows.map(mapMailRow),
  };
}

export async function listMailMessages(
  sql,
  userId,
  { status = 'all', reservationId = '', search = '' } = {},
) {
  const cleanStatus = cleanString(status) || 'all';
  const cleanReservationId = cleanString(reservationId);
  const cleanSearch = cleanString(search);
  const searchPattern = cleanSearch ? `%${cleanSearch}%` : '';

  const rows = await sql`
    WITH filters AS (
      SELECT
        ${userId}::text AS owner_user_id,
        ${cleanStatus}::text AS status,
        ${cleanReservationId}::text AS reservation_id,
        ${searchPattern}::text AS search
    )
    SELECT mail_messages.*
    FROM mail_messages, filters
    WHERE owner_user_id = filters.owner_user_id
      AND (filters.status = 'all' OR pms_status = filters.status)
      AND (filters.reservation_id = '' OR reservation_id = filters.reservation_id)
      AND (
        filters.search = ''
        OR subject ILIKE filters.search
        OR from_name ILIKE filters.search
        OR from_email ILIKE filters.search
        OR preview_text ILIKE filters.search
      )
    ORDER BY sent_at DESC NULLS LAST, created_at DESC
    LIMIT 250
  `;

  return rows.map(mapMailRow);
}

export async function getMailMessage(sql, userId, id) {
  const rows = await sql`
    SELECT * FROM mail_messages
    WHERE id = ${id} AND owner_user_id = ${userId}
    LIMIT 1
  `;

  if (!rows[0]) {
    throw new Error('Email non trovata');
  }

  return mapMailRow(rows[0]);
}

export async function updateMailMessage(
  sql,
  userId,
  { id, reservationId = '', pmsStatus = '' },
) {
  const cleanReservationId = cleanString(reservationId);

  if (cleanReservationId) {
    const reservations = await sql`
      SELECT id FROM reservations
      WHERE id = ${cleanReservationId}
        AND owner_user_id = ${userId}
        AND COALESCE(res_type, 'group') = 'group'
      LIMIT 1
    `;

    if (!reservations[0]) {
      throw new Error('Prenotazione non trovata');
    }
  }

  const nextStatus = computeMailStatus(cleanReservationId, cleanString(pmsStatus));
  const rows = await sql`
    UPDATE mail_messages
    SET
      reservation_id = ${cleanReservationId || null},
      pms_status = ${nextStatus},
      updated_at = NOW()
    WHERE id = ${id} AND owner_user_id = ${userId}
    RETURNING *
  `;

  if (!rows[0]) {
    throw new Error('Email non trovata');
  }

  return mapMailRow(rows[0]);
}
