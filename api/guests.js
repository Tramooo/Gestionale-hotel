import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM guests ORDER BY last_name, first_name`;
      return res.status(200).json(rows.map(g => ({
        id: g.id,
        reservationId: g.reservation_id,
        firstName: g.first_name,
        lastName: g.last_name,
        email: g.email,
        phone: g.phone,
        docType: g.doc_type,
        docNumber: g.doc_number,
        roomId: g.room_id,
        notes: g.notes
      })));
    }

    if (req.method === 'POST') {
      const g = req.body;
      const roomId = g.roomId || null;
      await sql`
        INSERT INTO guests (id, reservation_id, first_name, last_name, email, phone, doc_type, doc_number, room_id, notes)
        VALUES (${g.id}, ${g.reservationId}, ${g.firstName}, ${g.lastName}, ${g.email}, ${g.phone}, ${g.docType}, ${g.docNumber}, ${roomId}, ${g.notes})
      `;
      return res.status(201).json({ success: true });
    }

    if (req.method === 'PUT') {
      const g = req.body;
      const roomId = g.roomId || null;
      await sql`
        UPDATE guests SET reservation_id=${g.reservationId}, first_name=${g.firstName}, last_name=${g.lastName},
        email=${g.email}, phone=${g.phone}, doc_type=${g.docType}, doc_number=${g.docNumber},
        room_id=${roomId}, notes=${g.notes}
        WHERE id=${g.id}
      `;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM guests WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Guests API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
