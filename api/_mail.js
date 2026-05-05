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
const ARUBA_IMAP_PORT = 993;

export const MAX_RAW_MESSAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PREVIEW_TEXT_CHARS = 500;
export const MAX_BODY_TEXT_CHARS = 200000;
export const MAX_BODY_HTML_CHARS = 0;

export async function ensureMailTables(sql) {
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
      reservation_id TEXT,
      pms_status TEXT NOT NULL DEFAULT 'unassigned',
      synced_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    DO $$
    BEGIN
      IF to_regclass('reservations') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'mail_messages_reservation_id_fkey'
            AND conrelid = 'mail_messages'::regclass
        )
      THEN
        ALTER TABLE mail_messages
        ADD CONSTRAINT mail_messages_reservation_id_fkey
        FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `;

  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_messages_owner_provider_uid ON mail_messages(owner_user_id, provider_uid)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_mail_messages_owner_sent_at ON mail_messages(owner_user_id, sent_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_mail_messages_owner_reservation ON mail_messages(owner_user_id, reservation_id)`;
}

function requireMailAccount(account) {
  if (!account) {
    throw new Error('Account email non configurato');
  }
}

function cleanString(value) {
  return String(value ?? '').trim();
}

function truncateText(value, maxChars) {
  const text = String(value ?? '');
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

function getRawMessageBytes(source) {
  if (!source) {
    return 0;
  }

  if (typeof source === 'string') {
    return Buffer.byteLength(source);
  }

  if (typeof source.byteLength === 'number') {
    return source.byteLength;
  }

  if (typeof source.length === 'number') {
    return source.length;
  }

  return Buffer.byteLength(String(source));
}

function sanitizeMessagePayload(message) {
  return {
    ...message,
    previewText: truncateText(message.previewText, MAX_PREVIEW_TEXT_CHARS),
    bodyText: truncateText(message.bodyText, MAX_BODY_TEXT_CHARS),
    bodyHtml: truncateText('', MAX_BODY_HTML_CHARS),
  };
}

function createClient(ClientClass, account) {
  return new ClientClass({
    host: account.imap_host,
    port: account.imap_port || ARUBA_IMAP_PORT,
    secure: account.imap_secure !== false,
    auth: {
      user: account.imap_username,
      pass: decryptSecret(account.encrypted_password),
    },
    logger: false,
  });
}

async function upsertMailMessage(sql, userId, message) {
  const safeMessage = sanitizeMessagePayload(message);
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
      ${safeMessage.providerUid},
      ${safeMessage.messageId},
      ${safeMessage.mailbox},
      ${safeMessage.fromName},
      ${safeMessage.fromEmail},
      ${safeMessage.toText},
      ${safeMessage.subject},
      ${safeMessage.sentAt || null},
      ${safeMessage.previewText},
      ${safeMessage.bodyText},
      ${safeMessage.bodyHtml},
      ${safeMessage.hasAttachments},
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

export function createMailService({
  ClientClass = ImapFlow,
  parser = simpleParser,
} = {}) {
  async function getMailAccount(sql, userId) {
    const rows = await sql`
      SELECT * FROM mail_accounts
      WHERE owner_user_id = ${userId}
      LIMIT 1
    `;

    return rows[0] ?? null;
  }

  async function getSanitizedMailAccount(sql, userId) {
    return sanitizeMailAccount(await getMailAccount(sql, userId));
  }

  async function saveMailAccount(sql, userId, payload) {
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

  async function testMailConnection(sql, userId) {
    const account = await getMailAccount(sql, userId);
    requireMailAccount(account);

    const client = createClient(ClientClass, account);

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

  async function syncMailMessages(sql, userId) {
    const account = await getMailAccount(sql, userId);
    requireMailAccount(account);

    const client = createClient(ClientClass, account);
    const syncedRows = [];
    const failedUids = [];

    try {
      await client.connect();
      const mailbox = await client.mailboxOpen(MAILBOX, { readOnly: true });
      const totalMessages = Number(mailbox?.exists ?? client.mailbox?.exists ?? 0);

      if (totalMessages > 0) {
        const start = Math.max(1, totalMessages - FETCH_LIMIT + 1);
        const range = `${start}:${totalMessages}`;

        for await (const fetched of client.fetch(range, {
          uid: true,
          source: { start: 0, maxLength: MAX_RAW_MESSAGE_BYTES + 1 },
        })) {
          const uid = fetched?.uid ?? '';

          try {
            if (!fetched?.source) {
              failedUids.push(uid);
              continue;
            }

            if (getRawMessageBytes(fetched.source) > MAX_RAW_MESSAGE_BYTES) {
              failedUids.push(uid);
              continue;
            }

            const parsed = await parser(fetched.source);
            const normalized = normalizeParsedMail({
              uid,
              mailbox: MAILBOX,
              parsed,
            });
            syncedRows.push(await upsertMailMessage(sql, userId, normalized));
          } catch {
            failedUids.push(uid);
          }
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
      failedCount: failedUids.length,
      failedUids,
      messages: syncedRows.map(mapMailRow),
    };
  }

  async function listMailMessages(
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
      SELECT m.*
      FROM mail_messages m, filters f
      WHERE m.owner_user_id = f.owner_user_id
        AND (f.status = 'all' OR m.pms_status = f.status)
        AND (f.reservation_id = '' OR m.reservation_id = f.reservation_id)
        AND (
          f.search = ''
          OR m.subject ILIKE f.search
          OR m.from_name ILIKE f.search
          OR m.from_email ILIKE f.search
          OR m.preview_text ILIKE f.search
        )
      ORDER BY m.sent_at DESC NULLS LAST, m.created_at DESC
      LIMIT 250
    `;

    return rows.map(mapMailRow);
  }

  async function getMailMessage(sql, userId, id) {
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

  async function updateMailMessage(
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

  return {
    getMailAccount,
    getSanitizedMailAccount,
    saveMailAccount,
    testMailConnection,
    syncMailMessages,
    listMailMessages,
    getMailMessage,
    updateMailMessage,
  };
}

const defaultService = createMailService();

export const getMailAccount = defaultService.getMailAccount;
export const getSanitizedMailAccount = defaultService.getSanitizedMailAccount;
export const saveMailAccount = defaultService.saveMailAccount;
export const testMailConnection = defaultService.testMailConnection;
export const syncMailMessages = defaultService.syncMailMessages;
export const listMailMessages = defaultService.listMailMessages;
export const getMailMessage = defaultService.getMailMessage;
export const updateMailMessage = defaultService.updateMailMessage;
