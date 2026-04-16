import { requireAuth } from './_auth.js';
import { getSQL } from './_db.js';

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const sql = getSQL();

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT * FROM agenda_items
        WHERE owner_user_id = ${user.id}
        ORDER BY agenda_date ASC, COALESCE(agenda_time, '99:99') ASC, created_at ASC
      `;

      return res.status(200).json(rows.map((row) => ({
        id: row.id,
        date: row.agenda_date ? new Date(row.agenda_date).toISOString().split('T')[0] : null,
        time: row.agenda_time || '',
        text: row.text,
        done: Boolean(row.done),
        createdAt: row.created_at
      })));
    }

    if (req.method === 'POST') {
      const item = req.body;
      await sql`
        INSERT INTO agenda_items (id, owner_user_id, agenda_date, agenda_time, text, done, created_at)
        VALUES (${item.id}, ${user.id}, ${item.date}, ${item.time || null}, ${item.text}, ${item.done || false}, ${item.createdAt || new Date().toISOString()})
      `;
      return res.status(201).json({ success: true });
    }

    if (req.method === 'PUT') {
      const item = req.body;
      await sql`
        UPDATE agenda_items
        SET agenda_date = ${item.date},
            agenda_time = ${item.time || null},
            text = ${item.text},
            done = ${item.done || false}
        WHERE id = ${item.id} AND owner_user_id = ${user.id}
      `;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM agenda_items WHERE id = ${id} AND owner_user_id = ${user.id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Agenda API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
