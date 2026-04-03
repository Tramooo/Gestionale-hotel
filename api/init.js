import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);

    await sql`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        number TEXT UNIQUE NOT NULL,
        floor INTEGER NOT NULL,
        type TEXT NOT NULL,
        capacity INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'available',
        price NUMERIC DEFAULT 0
      )
    `;

    await sql`
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
    `;

    await sql`
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
    `;

    // Add Alloggiati fields to guests if missing
    await sql`ALTER TABLE guests ADD COLUMN IF NOT EXISTS sex TEXT`;
    await sql`ALTER TABLE guests ADD COLUMN IF NOT EXISTS birth_date TEXT`;
    await sql`ALTER TABLE guests ADD COLUMN IF NOT EXISTS birth_comune TEXT`;
    await sql`ALTER TABLE guests ADD COLUMN IF NOT EXISTS birth_province TEXT`;
    await sql`ALTER TABLE guests ADD COLUMN IF NOT EXISTS birth_country TEXT`;
    await sql`ALTER TABLE guests ADD COLUMN IF NOT EXISTS citizenship TEXT`;
    await sql`ALTER TABLE guests ADD COLUMN IF NOT EXISTS doc_issued_place TEXT`;
    await sql`ALTER TABLE guests ADD COLUMN IF NOT EXISTS guest_type TEXT DEFAULT '16'`;
    await sql`ALTER TABLE guests ADD COLUMN IF NOT EXISTS residence_comune TEXT`;

    await sql`
      CREATE TABLE IF NOT EXISTS room_assignments (
        id TEXT PRIMARY KEY,
        reservation_id TEXT REFERENCES reservations(id) ON DELETE CASCADE,
        room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
        usage_type TEXT,
        group_label TEXT,
        occupancy INTEGER DEFAULT 0,
        notes TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS planner_configs (
        reservation_id TEXT PRIMARY KEY REFERENCES reservations(id) ON DELETE CASCADE,
        columns TEXT NOT NULL DEFAULT '[]'
      )
    `;

    // Add cell_values column to room_assignments if missing
    await sql`
      ALTER TABLE room_assignments ADD COLUMN IF NOT EXISTS cell_values TEXT DEFAULT '{}'
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        role TEXT,
        pay_type TEXT NOT NULL DEFAULT 'monthly',
        pay_rate NUMERIC DEFAULT 0,
        phone TEXT,
        email TEXT,
        notes TEXT
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS work_entries (
        id TEXT PRIMARY KEY,
        employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
        work_date DATE NOT NULL,
        hours NUMERIC DEFAULT 0,
        notes TEXT
      )
    `;

    await sql`ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS start_time TEXT`;
    await sql`ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS end_time TEXT`;

    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS room_notes TEXT`;
    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS price_per_person NUMERIC DEFAULT 0`;
    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS gratuity NUMERIC DEFAULT 0`;
    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS res_type TEXT DEFAULT 'group'`;
    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS phone TEXT`;

    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS meal_plan TEXT DEFAULT 'BB'`;
    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS intolerances TEXT DEFAULT '[]'`;
    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS veggie_buffet BOOLEAN DEFAULT FALSE`;

    await sql`
      CREATE TABLE IF NOT EXISTS menus (
        id TEXT PRIMARY KEY,
        reservation_id TEXT REFERENCES reservations(id) ON DELETE CASCADE,
        menu_date DATE NOT NULL,
        meal_type TEXT NOT NULL,
        primo TEXT DEFAULT '',
        secondo TEXT DEFAULT '',
        contorno TEXT DEFAULT '',
        dessert TEXT DEFAULT '',
        UNIQUE(reservation_id, menu_date, meal_type)
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS reservation_files (
        id TEXT PRIMARY KEY,
        reservation_id TEXT REFERENCES reservations(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER DEFAULT 0,
        file_data TEXT NOT NULL,
        uploaded_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS hire_date DATE`;

    await sql`
      CREATE TABLE IF NOT EXISTS compliance_certs (
        id TEXT PRIMARY KEY,
        employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
        cert_type TEXT NOT NULL,
        issued_date DATE,
        expiry_date DATE,
        notes TEXT DEFAULT '',
        file_data TEXT DEFAULT '',
        file_name TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS compliance_docs (
        id TEXT PRIMARY KEY,
        doc_type TEXT NOT NULL,
        issued_date DATE,
        expiry_date DATE,
        notes TEXT DEFAULT '',
        file_data TEXT DEFAULT '',
        file_name TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    res.status(200).json({ message: 'Tables created successfully' });
  } catch (err) {
    console.error('Init error:', err);
    res.status(500).json({ error: err.message });
  }
}
