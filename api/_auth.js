import crypto from 'node:crypto';
import { ensureAuthTables, getSQL } from './_db.js';

const SESSION_COOKIE = 'gs_session';
const SESSION_DAYS = 14;

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return Object.fromEntries(
    raw
      .split(';')
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((chunk) => {
        const eq = chunk.indexOf('=');
        if (eq === -1) return [chunk, ''];
        return [chunk.slice(0, eq), decodeURIComponent(chunk.slice(eq + 1))];
      })
  );
}

function getSessionToken(req) {
  const headerToken = req.headers['x-session-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) return headerToken.trim();
  const cookieToken = parseCookies(req)[SESSION_COOKIE];
  return cookieToken || null;
}

function cookieParts(value, maxAge = SESSION_DAYS * 24 * 60 * 60) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`
  ];

  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts;
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', cookieParts('', 0).join('; '));
}

export async function createSession(res, userId) {
  await ensureAuthTables();
  const sql = getSQL();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await sql`
    INSERT INTO auth_sessions (token, user_id, expires_at)
    VALUES (${token}, ${userId}, ${expiresAt.toISOString()})
  `;

  res.setHeader('Set-Cookie', cookieParts(token).join('; '));
  return token;
}

export async function destroySession(req, res) {
  await ensureAuthTables();
  const sql = getSQL();
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) {
    await sql`DELETE FROM auth_sessions WHERE token = ${token}`;
  }
  clearSessionCookie(res);
}

export async function getAuthenticatedUser(req) {
  await ensureAuthTables();
  const sql = getSQL();
  const token = getSessionToken(req);
  if (!token) return null;

  const rows = await sql`
    SELECT u.id, u.email, u.full_name, u.created_at, s.expires_at
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token}
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const user = rows[0];
  if (new Date(user.expires_at) <= new Date()) {
    await sql`DELETE FROM auth_sessions WHERE token = ${token}`;
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name || '',
    createdAt: user.created_at
  };
}

export async function requireAuth(req, res) {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  req.user = user;
  return user;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, original] = storedHash.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(original, 'hex'));
}
