export const MAIL_STATUSES = new Set(['unassigned', 'assigned', 'handled', 'archived']);

function cleanString(value) {
  return String(value ?? '').trim();
}

function cleanLowerString(value) {
  return cleanString(value).toLowerCase();
}

function assignIfPresent(target, key, value) {
  if (value !== undefined) {
    target[key] = value;
  }
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

export function normalizeMailAccountInput(input = {}) {
  const port = Number.parseInt(input.port ?? 993, 10);

  return {
    email: cleanLowerString(input.email),
    username: cleanLowerString(input.username ?? input.email),
    password: cleanString(input.password),
    host: cleanLowerString(input.host || 'imaps.aruba.it'),
    port: Number.isFinite(port) ? port : 993,
  };
}

export function sanitizeMailAccount(account = {}) {
  const sanitized = {};

  assignIfPresent(sanitized, 'id', account.id);
  assignIfPresent(sanitized, 'email', account.email);
  assignIfPresent(sanitized, 'username', account.username);
  assignIfPresent(sanitized, 'host', account.host);
  assignIfPresent(sanitized, 'port', account.port);
  assignIfPresent(sanitized, 'createdAt', account.createdAt ?? account.created_at);
  assignIfPresent(sanitized, 'updatedAt', account.updatedAt ?? account.updated_at);

  return sanitized;
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

  return {
    providerUid: String(uid ?? ''),
    mailbox,
    messageId: parsed.messageId ?? '',
    fromName: cleanString(sender.name),
    fromEmail: cleanLowerString(sender.address),
    toText: parsed.to?.text ?? '',
    subject: cleanString(parsed.subject),
    previewText: buildMailPreview(parsed.text || parsed.html || ''),
    receivedAt: toIsoString(parsed.date),
    hasAttachments: attachments.length > 0,
    text: parsed.text ?? '',
    html: parsed.html ?? '',
  };
}

export function mapMailRow(row = {}) {
  return {
    id: row.id,
    accountId: row.accountId ?? row.account_id,
    providerUid: row.providerUid ?? row.provider_uid,
    mailbox: row.mailbox,
    messageId: row.messageId ?? row.message_id,
    fromName: row.fromName ?? row.from_name,
    fromEmail: row.fromEmail ?? row.from_email,
    subject: row.subject,
    previewText: row.previewText ?? row.preview_text,
    receivedAt: row.receivedAt ?? row.received_at,
    hasAttachments: row.hasAttachments ?? row.has_attachments,
    reservationId: row.reservationId ?? row.reservation_id ?? '',
    status: row.status,
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
  };
}
