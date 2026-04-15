import { requireAuth } from './_auth.js';
import { getSQL } from './_db.js';

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const sql = getSQL();

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
        notes: g.notes,
        sex: g.sex,
        birthDate: g.birth_date,
        birthComune: g.birth_comune,
        birthProvince: g.birth_province,
        birthCountry: g.birth_country,
        citizenship: g.citizenship,
        docIssuedPlace: g.doc_issued_place,
        guestType: g.guest_type || '16',
        residenceComune: g.residence_comune
      })));
    }

    if (req.method === 'POST') {
      const g = req.body;
      const roomId = g.roomId || null;
      await sql`
        INSERT INTO guests (id, reservation_id, first_name, last_name, email, phone, doc_type, doc_number, room_id, notes,
          sex, birth_date, birth_comune, birth_province, birth_country, citizenship, doc_issued_place, guest_type, residence_comune)
        VALUES (${g.id}, ${g.reservationId}, ${g.firstName}, ${g.lastName}, ${g.email}, ${g.phone}, ${g.docType}, ${g.docNumber}, ${roomId}, ${g.notes},
          ${g.sex || null}, ${g.birthDate || null}, ${g.birthComune || null}, ${g.birthProvince || null}, ${g.birthCountry || null}, ${g.citizenship || null}, ${g.docIssuedPlace || null}, ${g.guestType || '16'}, ${g.residenceComune || null})
      `;
      return res.status(201).json({ success: true });
    }

    if (req.method === 'PUT') {
      const g = req.body;
      const roomId = g.roomId || null;
      await sql`
        UPDATE guests SET reservation_id=${g.reservationId}, first_name=${g.firstName}, last_name=${g.lastName},
        email=${g.email}, phone=${g.phone}, doc_type=${g.docType}, doc_number=${g.docNumber},
        room_id=${roomId}, notes=${g.notes},
        sex=${g.sex || null}, birth_date=${g.birthDate || null}, birth_comune=${g.birthComune || null},
        birth_province=${g.birthProvince || null}, birth_country=${g.birthCountry || null},
        citizenship=${g.citizenship || null}, doc_issued_place=${g.docIssuedPlace || null},
        guest_type=${g.guestType || '16'}, residence_comune=${g.residenceComune || null}
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
