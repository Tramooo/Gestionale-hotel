import { requireAuth } from './_auth.js';
import { getSQL } from './_db.js';

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const sql = getSQL();

  try {
    if (req.method === 'GET') {
      const { reservationId } = req.query;
      if (!reservationId) return res.status(400).json({ error: 'reservationId required' });
      const rows = await sql`
        SELECT * FROM menus WHERE reservation_id = ${reservationId} ORDER BY menu_date, meal_type
      `;
      return res.status(200).json(rows.map(r => ({
        id: r.id,
        reservationId: r.reservation_id,
        date: new Date(r.menu_date).toISOString().split('T')[0],
        mealType: r.meal_type,
        primo: r.primo || '',
        secondo: r.secondo || '',
        contorno: r.contorno || '',
        dessert: r.dessert || ''
      })));
    }

    if (req.method === 'POST') {
      const m = req.body;
      await sql`
        INSERT INTO menus (id, reservation_id, menu_date, meal_type, primo, secondo, contorno, dessert)
        VALUES (${m.id}, ${m.reservationId}, ${m.date}, ${m.mealType}, ${m.primo || ''}, ${m.secondo || ''}, ${m.contorno || ''}, ${m.dessert || ''})
        ON CONFLICT (reservation_id, menu_date, meal_type)
        DO UPDATE SET primo=${m.primo || ''}, secondo=${m.secondo || ''}, contorno=${m.contorno || ''}, dessert=${m.dessert || ''}
      `;
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM menus WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Menus API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
