import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT * FROM rooms ORDER BY floor, number`;
      return res.status(200).json(rows.map(r => ({
        id: r.id,
        number: r.number,
        floor: r.floor,
        type: r.type,
        capacity: r.capacity,
        status: r.status,
        price: Number(r.price)
      })));
    }

    if (req.method === 'POST') {
      const r = req.body;
      const status = r.status || 'available';
      const price = r.price || 0;
      await sql`
        INSERT INTO rooms (id, number, floor, type, capacity, status, price)
        VALUES (${r.id}, ${r.number}, ${r.floor}, ${r.type}, ${r.capacity}, ${status}, ${price})
      `;
      return res.status(201).json({ success: true });
    }

    if (req.method === 'PUT') {
      const r = req.body;
      const price = r.price || 0;
      await sql`
        UPDATE rooms SET number=${r.number}, floor=${r.floor}, type=${r.type},
        capacity=${r.capacity}, status=${r.status}, price=${price}
        WHERE id=${r.id}
      `;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`UPDATE guests SET room_id = NULL WHERE room_id = ${id}`;
      await sql`DELETE FROM rooms WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Rooms API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
