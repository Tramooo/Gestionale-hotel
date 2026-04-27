import { hashPassword, requireAuth, verifyPassword } from './_auth.js';
import { ensureAuthTables, getSQL } from './_db.js';

function validatePin(pin) {
  return /^\d{4}$/.test(String(pin || ''));
}

export default async function handler(req, res) {
  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    await ensureAuthTables();
    const sql = getSQL();

    if (req.method === 'GET') {
      const rows = await sql`
        SELECT management_pin_hash
        FROM users
        WHERE id = ${user.id}
        LIMIT 1
      `;
      return res.status(200).json({ managementPinEnabled: Boolean(rows[0]?.management_pin_hash) });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const action = req.query.action || req.body?.action;

    if (action === 'setManagementPin') {
      const pin = String(req.body?.pin || '').trim();
      if (!validatePin(pin)) {
        return res.status(400).json({ error: 'Il PIN deve essere di 4 cifre' });
      }

      await sql`
        UPDATE users
        SET management_pin_hash = ${hashPassword(pin)}
        WHERE id = ${user.id}
      `;
      return res.status(200).json({ managementPinEnabled: true });
    }

    if (action === 'removeManagementPin') {
      await sql`
        UPDATE users
        SET management_pin_hash = NULL
        WHERE id = ${user.id}
      `;
      return res.status(200).json({ managementPinEnabled: false });
    }

    if (action === 'verifyManagementPin') {
      const pin = String(req.body?.pin || '').trim();
      if (!validatePin(pin)) {
        return res.status(400).json({ verified: false });
      }

      const rows = await sql`
        SELECT management_pin_hash
        FROM users
        WHERE id = ${user.id}
        LIMIT 1
      `;
      const storedHash = rows[0]?.management_pin_hash || '';
      return res.status(200).json({ verified: Boolean(storedHash && verifyPassword(pin, storedHash)) });
    }

    return res.status(400).json({ error: 'Settings action non valida' });
  } catch (err) {
    console.error('Settings API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
