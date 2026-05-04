import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSION_PREFIX = 'v1:';
const MIN_SECRET_LENGTH = 16;

function resolveSecret(explicitSecret = '') {
  const secret = explicitSecret || process.env.MAIL_CREDENTIALS_SECRET || '';

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error('MAIL_CREDENTIALS_SECRET must be at least 16 characters long.');
  }

  return createHash('sha256').update(secret).digest();
}

function encodePart(value) {
  return Buffer.from(value).toString('base64url');
}

function decodePart(value) {
  return Buffer.from(value, 'base64url');
}

export function encryptSecret(value, explicitSecret = '') {
  const key = resolveSecret(explicitSecret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(value), 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${VERSION_PREFIX}${encodePart(iv)}.${encodePart(encrypted)}.${encodePart(authTag)}`;
}

export function decryptSecret(token, explicitSecret = '') {
  const key = resolveSecret(explicitSecret);

  if (typeof token !== 'string' || !token.startsWith(VERSION_PREFIX)) {
    throw new Error('Invalid mail credential token.');
  }

  const parts = token.slice(VERSION_PREFIX.length).split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new Error('Malformed mail credential token.');
  }

  try {
    const [ivPart, encryptedPart, authTagPart] = parts;
    const decipher = createDecipheriv('aes-256-gcm', key, decodePart(ivPart));
    decipher.setAuthTag(decodePart(authTagPart));

    return Buffer.concat([
      decipher.update(decodePart(encryptedPart)),
      decipher.final(),
    ]).toString('utf8');
  } catch (error) {
    throw new Error('Invalid mail credential token.', { cause: error });
  }
}
