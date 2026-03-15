import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);

  try {
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
      // Upsert
      await sql`
        INSERT INTO planner_configs (reservation_id, columns)
        VALUES (${reservationId}, ${colJson})
        ON CONFLICT (reservation_id) DO UPDATE SET columns = ${colJson}
      `;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Planner config API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
