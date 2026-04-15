import { requireAuth } from './_auth.js';
import { getSQL } from './_db.js';

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const sql = getSQL();

  try {
    const isPlannerConfig = req.query.resource === 'planner-config' || req.body?.resource === 'planner-config';

    if (isPlannerConfig) {
      if (req.method === 'GET') {
        const { reservation_id } = req.query;
        const rows = await sql`SELECT * FROM planner_configs WHERE reservation_id = ${reservation_id}`;
        if (rows.length === 0) {
          return res.status(200).json(null);
        }
        return res.status(200).json({
          reservationId: rows[0].reservation_id,
          columns: JSON.parse(rows[0].columns || '[]')
        });
      }

      if (req.method === 'PUT') {
        const { reservationId, columns } = req.body;
        const colJson = JSON.stringify(columns);
        await sql`
          INSERT INTO planner_configs (reservation_id, columns)
          VALUES (${reservationId}, ${colJson})
          ON CONFLICT (reservation_id) DO UPDATE SET columns = ${colJson}
        `;
        return res.status(200).json({ success: true });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (req.method === 'GET') {
      const { reservation_id } = req.query;
      let rows;
      if (reservation_id) {
        rows = await sql`SELECT * FROM room_assignments WHERE reservation_id = ${reservation_id} ORDER BY room_id`;
      } else {
        rows = await sql`SELECT * FROM room_assignments ORDER BY reservation_id, room_id`;
      }
      return res.status(200).json(rows.map(a => ({
        id: a.id,
        reservationId: a.reservation_id,
        roomId: a.room_id,
        cellValues: JSON.parse(a.cell_values || '{}')
      })));
    }

    if (req.method === 'POST') {
      const a = req.body;
      const cellValues = JSON.stringify(a.cellValues || {});
      await sql`
        INSERT INTO room_assignments (id, reservation_id, room_id, cell_values)
        VALUES (${a.id}, ${a.reservationId}, ${a.roomId}, ${cellValues})
      `;
      return res.status(201).json({ success: true });
    }

    if (req.method === 'PUT') {
      const a = req.body;
      const cellValues = JSON.stringify(a.cellValues || {});
      await sql`
        UPDATE room_assignments SET cell_values = ${cellValues}
        WHERE id = ${a.id}
      `;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id, reservation_id } = req.query;
      if (reservation_id) {
        await sql`DELETE FROM room_assignments WHERE reservation_id = ${reservation_id}`;
      } else if (id) {
        await sql`DELETE FROM room_assignments WHERE id = ${id}`;
      }
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Assignments API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
