import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM reservations ORDER BY created_at DESC`;
      const toDateStr = (d) => d ? new Date(d).toISOString().split('T')[0] : null;
      const reservations = rows.map(r => ({
        id: r.id,
        groupName: r.group_name,
        organizer: r.organizer,
        email: r.email,
        checkin: toDateStr(r.checkin),
        checkout: toDateStr(r.checkout),
        guestCount: r.guest_count,
        roomCount: r.room_count,
        roomIds: JSON.parse(r.room_ids || '[]'),
        status: r.status,
        expiration: toDateStr(r.expiration),
        price: Number(r.price),
        pricePerPerson: Number(r.price_per_person) || 0,
        gratuity: Number(r.gratuity) || 0,
        notes: r.notes,
        roomNotes: r.room_notes,
        resType: r.res_type || 'group',
        phone: r.phone || '',
        mealPlan: r.meal_plan || 'BB',
        createdAt: r.created_at
      }));
      return res.status(200).json(reservations);
    }

    if (req.method === 'POST') {
      const r = req.body;
      const roomIds = JSON.stringify(r.roomIds || []);
      const expiration = r.expiration || null;
      await sql`
        INSERT INTO reservations (id, group_name, organizer, email, checkin, checkout, guest_count, room_count, room_ids, status, expiration, price, price_per_person, gratuity, notes, room_notes, res_type, phone, meal_plan, created_at)
        VALUES (${r.id}, ${r.groupName}, ${r.organizer}, ${r.email}, ${r.checkin}, ${r.checkout}, ${r.guestCount}, ${r.roomCount}, ${roomIds}, ${r.status}, ${expiration}, ${r.price}, ${r.pricePerPerson || 0}, ${r.gratuity || 0}, ${r.notes}, ${r.roomNotes || null}, ${r.resType || 'group'}, ${r.phone || null}, ${r.mealPlan || 'BB'}, ${r.createdAt})
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
        room_ids=${roomIds}, status=${r.status}, expiration=${expiration}, price=${r.price}, price_per_person=${r.pricePerPerson || 0}, gratuity=${r.gratuity || 0}, notes=${r.notes}, room_notes=${r.roomNotes || null},
        res_type=${r.resType || 'group'}, phone=${r.phone || null}, meal_plan=${r.mealPlan || 'BB'}
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
