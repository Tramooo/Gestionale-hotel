import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  try {
    if (req.method === 'GET') {
      const rows = await sql(`SELECT * FROM rooms ORDER BY floor, number`);
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
      await sql(`
        INSERT INTO rooms (id, number, floor, type, capacity, status, price)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [r.id, r.number, r.floor, r.type, r.capacity, r.status || 'available', r.price || 0]);
      return res.status(201).json({ success: true });
    }

    if (req.method === 'PUT') {
      const r = req.body;
      await sql(`
        UPDATE rooms SET number=$1, floor=$2, type=$3, capacity=$4, status=$5, price=$6
        WHERE id=$7
      `, [r.number, r.floor, r.type, r.capacity, r.status, r.price || 0, r.id]);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql(`UPDATE guests SET room_id = NULL WHERE room_id = $1`, [id]);
      await sql(`DELETE FROM rooms WHERE id = $1`, [id]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Rooms API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
