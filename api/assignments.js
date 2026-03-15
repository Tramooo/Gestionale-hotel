import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  try {
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
        usageType: a.usage_type,
        groupLabel: a.group_label,
        occupancy: a.occupancy,
        notes: a.notes
      })));
    }

    if (req.method === 'POST') {
      const a = req.body;
      await sql`
        INSERT INTO room_assignments (id, reservation_id, room_id, usage_type, group_label, occupancy, notes)
        VALUES (${a.id}, ${a.reservationId}, ${a.roomId}, ${a.usageType}, ${a.groupLabel}, ${a.occupancy}, ${a.notes})
      `;
      return res.status(201).json({ success: true });
    }

    if (req.method === 'PUT') {
      const a = req.body;
      await sql`
        UPDATE room_assignments SET usage_type=${a.usageType}, group_label=${a.groupLabel},
        occupancy=${a.occupancy}, notes=${a.notes}
        WHERE id=${a.id}
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
