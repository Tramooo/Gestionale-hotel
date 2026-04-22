import crypto from 'node:crypto';

const GUEST_ENCRYPTION_PREFIX = 'enc$guest$v1';

export const GUEST_FIELD_MAP = [
  ['first_name', 'firstName'],
  ['last_name', 'lastName'],
  ['email', 'email'],
  ['phone', 'phone'],
  ['doc_type', 'docType'],
  ['doc_number', 'docNumber'],
  ['notes', 'notes'],
  ['sex', 'sex'],
  ['birth_date', 'birthDate'],
  ['birth_comune', 'birthComune'],
  ['birth_province', 'birthProvince'],
  ['birth_country', 'birthCountry'],
  ['citizenship', 'citizenship'],
  ['doc_issued_place', 'docIssuedPlace'],
  ['guest_type', 'guestType'],
  ['residence_comune', 'residenceComune']
];

function getGuestEncryptionKey() {
  const secret = process.env.GUEST_DATA_ENCRYPTION_KEY || process.env.DATA_ENCRYPTION_KEY || '';
  if (!secret) {
    throw new Error('Guest data encryption key not configured. Set GUEST_DATA_ENCRYPTION_KEY.');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

function isEmptyValue(value) {
  return value === null || value === undefined || value === '';
}

export function isEncryptedGuestValue(value) {
  return typeof value === 'string' && value.startsWith(`${GUEST_ENCRYPTION_PREFIX}:`);
}

export function encryptGuestValue(value) {
  if (isEmptyValue(value)) return value ?? null;

  const key = getGuestEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value), 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return [
    GUEST_ENCRYPTION_PREFIX,
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64')
  ].join(':');
}

export function decryptGuestValue(value) {
  if (isEmptyValue(value)) return value ?? null;
  if (!isEncryptedGuestValue(value)) return String(value);

  const parts = String(value).split(':');
  if (parts.length !== 4 || parts[0] !== GUEST_ENCRYPTION_PREFIX) {
    throw new Error('Invalid encrypted guest field payload');
  }

  const key = getGuestEncryptionKey();
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(parts[1], 'base64')
  );
  decipher.setAuthTag(Buffer.from(parts[2], 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parts[3], 'base64')),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

export function encryptGuestForStorage(guest) {
  const encryptedGuest = {
    ...guest,
    guestType: guest?.guestType || '16'
  };

  for (const [, appField] of GUEST_FIELD_MAP) {
    encryptedGuest[appField] = encryptGuestValue(encryptedGuest[appField]);
  }

  return encryptedGuest;
}

export function decryptGuestRow(row) {
  const guest = {
    id: row.id,
    reservationId: row.reservation_id,
    roomId: row.room_id
  };

  for (const [dbField, appField] of GUEST_FIELD_MAP) {
    guest[appField] = decryptGuestValue(row[dbField]);
  }

  if (!guest.guestType) guest.guestType = '16';
  return guest;
}

export function isGuestRowFullyEncrypted(row) {
  return GUEST_FIELD_MAP.every(([dbField]) => {
    const value = row?.[dbField];
    return isEmptyValue(value) || isEncryptedGuestValue(value);
  });
}
