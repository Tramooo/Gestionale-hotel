import crypto from 'node:crypto';
import { createSession, destroySession, getAuthenticatedUser, hashPassword, verifyPassword } from './_auth.js';
import { ensureAuthTables, getSQL } from './_db.js';

function sanitizeUser(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name || '',
    createdAt: row.created_at
  };
}

export default async function handler(req, res) {
  try {
    await ensureAuthTables();
    const sql = getSQL();

    if (req.method === 'GET') {
      const user = await getAuthenticatedUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });
      return res.status(200).json({ user });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const action = req.query.action || req.body?.action;

    if (action === 'logout') {
      await destroySession(req, res);
      return res.status(200).json({ success: true });
    }

    if (action === 'register') {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      const fullName = String(req.body?.fullName || '').trim();

      if (!email || !password) return res.status(400).json({ error: 'Email e password sono obbligatori' });
      if (password.length < 8) return res.status(400).json({ error: 'La password deve contenere almeno 8 caratteri' });

      const existing = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
      if (existing.length > 0) return res.status(409).json({ error: 'Esiste già un account con questa email' });

      const id = crypto.randomUUID();
      const passwordHash = hashPassword(password);

      await sql`
        INSERT INTO users (id, email, password_hash, full_name)
        VALUES (${id}, ${email}, ${passwordHash}, ${fullName || null})
      `;

      const created = await sql`SELECT id, email, full_name, created_at FROM users WHERE id = ${id} LIMIT 1`;
      const token = await createSession(res, id);
      return res.status(201).json({ user: sanitizeUser(created[0]), sessionToken: token });
    }

    if (action === 'login') {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const password = String(req.body?.password || '');
      if (!email || !password) return res.status(400).json({ error: 'Email e password sono obbligatori' });

      const rows = await sql`SELECT * FROM users WHERE email = ${email} LIMIT 1`;
      if (rows.length === 0 || !verifyPassword(password, rows[0].password_hash)) {
        return res.status(401).json({ error: 'Credenziali non valide' });
      }

      const token = await createSession(res, rows[0].id);
      return res.status(200).json({ user: sanitizeUser(rows[0]), sessionToken: token });
    }

    return res.status(400).json({ error: 'Auth action non valida' });
  } catch (err) {
    console.error('Auth API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
