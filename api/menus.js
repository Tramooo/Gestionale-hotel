import { requireAuth } from './_auth.js';
import { getSQL } from './_db.js';

function serializeMenu(row) {
  return {
    id: row.id,
    date: new Date(row.menu_date).toISOString().split('T')[0],
    mealType: row.meal_type,
    primo: row.primo || '',
    secondo: row.secondo || '',
    contorno: row.contorno || '',
    dessert: row.dessert || ''
  };
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const sql = getSQL();

  try {
    if (req.method === 'GET') {
      const { reservationId } = req.query;
      if (!reservationId) return res.status(400).json({ error: 'reservationId required' });
      const [reservation] = await sql`
        SELECT checkin, checkout
        FROM reservations
        WHERE id = ${reservationId} AND owner_user_id = ${user.id}
        LIMIT 1
      `;
      if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
      const rows = await sql`
        SELECT *
        FROM daily_menus
        WHERE owner_user_id = ${user.id}
          AND menu_date >= ${reservation.checkin}
          AND menu_date <= ${reservation.checkout}
        ORDER BY menu_date, meal_type
      `;
      return res.status(200).json(rows.map(serializeMenu));
    }

    if (req.method === 'POST') {
      const m = req.body;
      if (!m?.id || !m?.date || !m?.mealType) {
        return res.status(400).json({ error: 'id, date and mealType are required' });
      }
      const [savedMenu] = await sql`
        INSERT INTO daily_menus (id, owner_user_id, menu_date, meal_type, primo, secondo, contorno, dessert, updated_at)
        VALUES (${m.id}, ${user.id}, ${m.date}, ${m.mealType}, ${m.primo || ''}, ${m.secondo || ''}, ${m.contorno || ''}, ${m.dessert || ''}, NOW())
        ON CONFLICT (owner_user_id, menu_date, meal_type)
        DO UPDATE SET
          primo = ${m.primo || ''},
          secondo = ${m.secondo || ''},
          contorno = ${m.contorno || ''},
          dessert = ${m.dessert || ''},
          updated_at = NOW()
        RETURNING *
      `;
      return res.status(200).json({ success: true, menu: serializeMenu(savedMenu) });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      await sql`DELETE FROM daily_menus WHERE id = ${id} AND owner_user_id = ${user.id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Menus API error:', err);
    return res.status(500).json({ error: err.message });
  }
}
