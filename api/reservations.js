import { getSQL } from './_db.js';

export default async function handler(req, res) {
  const sql = getSQL();

  try {
    if (req.method === 'GET') {
      const rows = await sql(`SELECT * FROM reservations ORDER BY created_at DESC`);
      // Convert snake_case to camelCase for frontend compatibility
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
      await sql(`
        INSERT INTO reservations (id, group_name, organizer, email, checkin, checkout, guest_count, room_count, room_ids, status, expiration, price, notes, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      `, [r.id, r.groupName, r.organizer, r.email, r.checkin, r.checkout, r.guestCount, r.roomCount, JSON.stringify(r.roomIds || []), r.status, r.expiration || null, r.price, r.notes, r.createdAt]);
      return res.status(201).json({ success: true });
    }

    if (req.method === 'PUT') {
      const r = req.body;
      await sql(`
        UPDATE reservations SET group_name=$1, organizer=$2, email=$3, checkin=$4, checkout=$5,
        guest_count=$6, room_count=$7, room_ids=$8, status=$9, expiration=$10, price=$11, notes=$12
        WHERE id=$13
      `, [r.groupName, r.organizer, r.email, r.checkin, r.checkout, r.guestCount, r.roomCount, JSON.stringify(r.roomIds || []), r.status, r.expiration || null, r.price, r.notes, r.id]);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql(`DELETE FROM guests WHERE reservation_id = $1`, [id]);
      await sql(`DELETE FROM reservations WHERE id = $1`, [id]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Reservations API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
