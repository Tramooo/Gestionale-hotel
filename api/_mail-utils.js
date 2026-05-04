export const MAIL_STATUSES = new Set(['unassigned', 'assigned', 'handled', 'archived']);

function cleanString(value) {
  return String(value ?? '').trim();
}

function cleanLowerString(value) {
  return cleanString(value).toLowerCase();
}

function toIsoString(value) {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function normalizePort(value) {
  if (value === undefined || value === null || value === '') {
    return 993;
  }

  const portText = String(value).trim();
  if (!/^\d+$/.test(portText)) {
    throw new Error('Invalid IMAP port.');
  }

  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid IMAP port.');
  }

  return port;
}

export function normalizeMailAccountInput(input = {}) {
  const email = cleanLowerString(input.email);
  const username = cleanLowerString(input.username);

  if (!email) {
    throw new Error('Mail account email is required.');
  }

  if (!username) {
    throw new Error('Mail account username is required.');
  }

  return {
    email,
    username,
    password: cleanString(input.password),
    host: cleanLowerString(input.host || 'imaps.aruba.it'),
    port: normalizePort(input.port),
    secure: input.secure !== false,
  };
}

export function sanitizeMailAccount(row) {
  if (!row) {
    return { configured: false };
  }

  return {
    configured: true,
    email: row.imap_email,
    username: row.imap_username,
    host: row.imap_host,
    port: row.imap_port,
    secure: row.imap_secure !== false,
    lastTestedAt: row.last_tested_at,
    lastSyncAt: row.last_sync_at,
  };
}

export function computeMailStatus(reservationId, requestedStatus) {
  if (requestedStatus === 'handled' || requestedStatus === 'archived') {
    return requestedStatus;
  }

  return reservationId ? 'assigned' : 'unassigned';
}

export function buildMailPreview(value = '', maxLength = 160) {
  const normalized = cleanString(value).replace(/\s+/g, ' ');

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const clipped = normalized.slice(0, maxLength).trimEnd();
  const lastSpace = clipped.lastIndexOf(' ');
  const preview = lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped;

  return `${preview}...`;
}

export function normalizeParsedMail({ uid, mailbox = 'INBOX', parsed = {} } = {}) {
  const sender = parsed.from?.value?.[0] ?? {};
  const attachments = Array.isArray(parsed.attachments) ? parsed.attachments : [];
  const subject = cleanString(parsed.subject) || '(Senza oggetto)';

  return {
    providerUid: `${mailbox}:${uid}`,
    messageId: parsed.messageId ?? '',
    mailbox,
    fromName: cleanString(sender.name),
    fromEmail: cleanLowerString(sender.address),
    toText: parsed.to?.text ?? '',
    subject,
    sentAt: toIsoString(parsed.date),
    previewText: buildMailPreview(parsed.text || parsed.html || ''),
    bodyText: parsed.text ?? '',
    bodyHtml: parsed.html ?? '',
    hasAttachments: attachments.length > 0,
  };
}

export function mapMailRow(row = {}) {
  return {
    id: row.id,
    providerUid: row.providerUid ?? row.provider_uid,
    messageId: row.messageId ?? row.message_id,
    mailbox: row.mailbox,
    fromName: row.fromName ?? row.from_name,
    fromEmail: row.fromEmail ?? row.from_email,
    toText: row.toText ?? row.to_text,
    subject: row.subject,
    sentAt: row.sentAt ?? row.sent_at,
    previewText: row.previewText ?? row.preview_text,
    bodyText: row.bodyText ?? row.body_text,
    bodyHtml: row.bodyHtml ?? row.body_html,
    hasAttachments: row.hasAttachments ?? row.has_attachments,
    reservationId: row.reservationId ?? row.reservation_id ?? '',
    pmsStatus: row.pmsStatus ?? row.pms_status,
    syncedAt: row.syncedAt ?? row.synced_at,
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
  };
}
