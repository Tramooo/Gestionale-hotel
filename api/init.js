import { getSQL } from './_db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sql = getSQL();

  await sql(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      number TEXT UNIQUE NOT NULL,
      floor INTEGER NOT NULL,
      type TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      price NUMERIC DEFAULT 0
    )
  `);

  await sql(`
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      group_name TEXT NOT NULL,
      organizer TEXT,
      email TEXT,
      checkin DATE NOT NULL,
      checkout DATE NOT NULL,
      guest_count INTEGER DEFAULT 0,
      room_count INTEGER DEFAULT 0,
      room_ids TEXT DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      expiration DATE,
      price NUMERIC DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await sql(`
    CREATE TABLE IF NOT EXISTS guests (
      id TEXT PRIMARY KEY,
      reservation_id TEXT REFERENCES reservations(id) ON DELETE CASCADE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      doc_type TEXT,
      doc_number TEXT,
      room_id TEXT,
      notes TEXT
    )
  `);

  res.status(200).json({ message: 'Tables created successfully' });
}
