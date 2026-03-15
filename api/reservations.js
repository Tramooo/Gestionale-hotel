import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM reservations ORDER BY created_at DESC`;
      const reservations = rows.map(r => ({
        id: r.id,
        groupName: r.group_name,
        organizer: r.organizer,
        email: r.email,
        checkin: r.checkin,
        checkout: r.checkout,
        guestCount: r.guest_count,
        roomCount: r.room_count,
        roomIds: JSON.parse(r.room_ids || '[]'),
        status: r.status,
        expiration: r.expiration,
        price: Number(r.price),
        notes: r.notes,
        createdAt: r.created_at
      }));
      return res.status(200).json(reservations);
    }

    if (req.method === 'POST') {
      const r = req.body;
      const roomIds = JSON.stringify(r.roomIds || []);
      const expiration = r.expiration || null;
      await sql`
        INSERT INTO reservations (id, group_name, organizer, email, checkin, checkout, guest_count, room_count, room_ids, status, expiration, price, notes, created_at)
        VALUES (${r.id}, ${r.groupName}, ${r.organizer}, ${r.email}, ${r.checkin}, ${r.checkout}, ${r.guestCount}, ${r.roomCount}, ${roomIds}, ${r.status}, ${expiration}, ${r.price}, ${r.notes}, ${r.createdAt})
      `;
      return res.status(201).json({ success: true });
    }

    if (req.method === 'PUT') {
      const r = req.body;
      const roomIds = JSON.stringify(r.roomIds || []);
      const expiration = r.expiration || null;
      await sql`
        UPDATE reservations SET group_name=${r.groupName}, organizer=${r.organizer}, email=${r.email},
        checkin=${r.checkin}, checkout=${r.checkout}, guest_count=${r.guestCount}, room_count=${r.roomCount},
        room_ids=${roomIds}, status=${r.status}, expiration=${expiration}, price=${r.price}, notes=${r.notes}
        WHERE id=${r.id}
      `;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM guests WHERE reservation_id = ${id}`;
      await sql`DELETE FROM reservations WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Reservations API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
