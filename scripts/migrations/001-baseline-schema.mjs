export const id = '001-baseline-schema';

export async function up({ sql, options = {} }) {

    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS management_pin_hash TEXT`;
    await sql`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at)`;

    await sql`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        number TEXT NOT NULL,
        floor INTEGER NOT NULL,
        type TEXT NOT NULL,
        capacity INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'available',
        price NUMERIC DEFAULT 0
      )
    `;
    await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS owner_user_id TEXT`;
    await sql`ALTER TABLE rooms ADD COLUMN IF NOT EXISTS maintenance_note TEXT DEFAULT ''`;
    await sql`
      DO $$
      DECLARE constraint_name TEXT;
      BEGIN
        SELECT tc.constraint_name INTO constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'rooms'
          AND tc.constraint_type = 'UNIQUE'
          AND ccu.column_name = 'number'
        LIMIT 1;

        IF constraint_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE rooms DROP CONSTRAINT %I', constraint_name);
        END IF;
      EXCEPTION WHEN undefined_table THEN
        NULL;
      END $$;
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_owner_number ON rooms(owner_user_id, number)`;

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
    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS owner_user_id TEXT`;

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
    await sql`ALTER TABLE guests ADD COLUMN IF NOT EXISTS owner_user_id TEXT`;

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
    await sql`ALTER TABLE room_assignments ADD COLUMN IF NOT EXISTS owner_user_id TEXT`;

    await sql`
      CREATE TABLE IF NOT EXISTS planner_configs (
        reservation_id TEXT PRIMARY KEY REFERENCES reservations(id) ON DELETE CASCADE,
        columns TEXT NOT NULL DEFAULT '[]'
      )
    `;
    await sql`ALTER TABLE planner_configs ADD COLUMN IF NOT EXISTS owner_user_id TEXT`;

    // Add cell_values column to room_assignments if missing
    await sql`
      ALTER TABLE room_assignments ADD COLUMN IF NOT EXISTS cell_values TEXT DEFAULT '{}'
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        role TEXT,
        pay_type TEXT NOT NULL DEFAULT 'monthly',
        pay_rate NUMERIC DEFAULT 0,
        phone TEXT,
        email TEXT,
        notes TEXT
      )
    `;
    await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS owner_user_id TEXT`;

    await sql`ALTER TABLE employees ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0`;

    await sql`
      CREATE TABLE IF NOT EXISTS work_entries (
        id TEXT PRIMARY KEY,
        employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
        work_date DATE NOT NULL,
        hours NUMERIC DEFAULT 0,
        notes TEXT
      )
    `;
    await sql`ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS owner_user_id TEXT`;

    await sql`ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS start_time TEXT`;
    await sql`ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS end_time TEXT`;
    await sql`ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS start_time_2 TEXT`;
    await sql`ALTER TABLE work_entries ADD COLUMN IF NOT EXISTS end_time_2 TEXT`;

    await sql`
      CREATE TABLE IF NOT EXISTS employee_month_overrides (
        id TEXT PRIMARY KEY,
        employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
        year_month TEXT NOT NULL,
        pay_type TEXT NOT NULL,
        pay_rate NUMERIC DEFAULT 0,
        UNIQUE(employee_id, year_month)
      )
    `;
    await sql`ALTER TABLE employee_month_overrides ADD COLUMN IF NOT EXISTS owner_user_id TEXT`;

    await sql`
      CREATE TABLE IF NOT EXISTS employee_advances (
        id TEXT PRIMARY KEY,
        employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
        advance_date DATE NOT NULL,
        year_month TEXT NOT NULL,
        amount NUMERIC DEFAULT 0,
        notes TEXT,
        created_at TEXT
      )
    `;
    await sql`ALTER TABLE employee_advances ADD COLUMN IF NOT EXISTS owner_user_id TEXT`;

    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS room_notes TEXT`;
    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS price_per_person NUMERIC DEFAULT 0`;
    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS gratuity NUMERIC DEFAULT 0`;
    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS res_type TEXT DEFAULT 'group'`;
    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS phone TEXT`;

    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS meal_plan TEXT DEFAULT 'BB'`;
    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS intolerances TEXT DEFAULT '[]'`;
    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS veggie_buffet BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS extra_costs TEXT DEFAULT '[]'`;

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
    await sql`ALTER TABLE menus ADD COLUMN IF NOT EXISTS owner_user_id TEXT`;
    await sql`ALTER TABLE menus ADD COLUMN IF NOT EXISTS migrated_to_daily BOOLEAN DEFAULT FALSE`;

    await sql`
      CREATE TABLE IF NOT EXISTS daily_menus (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        menu_date DATE NOT NULL,
        meal_type TEXT NOT NULL,
        primo TEXT DEFAULT '',
        secondo TEXT DEFAULT '',
        contorno TEXT DEFAULT '',
        dessert TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(owner_user_id, menu_date, meal_type)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_daily_menus_owner_date ON daily_menus(owner_user_id, menu_date, meal_type)`;

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
    await sql`ALTER TABLE reservation_files ADD COLUMN IF NOT EXISTS owner_user_id TEXT`;

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
    await sql`ALTER TABLE compliance_certs ADD COLUMN IF NOT EXISTS owner_user_id TEXT`;

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
    await sql`ALTER TABLE compliance_docs ADD COLUMN IF NOT EXISTS owner_user_id TEXT`;

    await sql`
      CREATE TABLE IF NOT EXISTS agenda_items (
        id TEXT PRIMARY KEY,
        agenda_date DATE NOT NULL,
        agenda_time TEXT,
        text TEXT NOT NULL,
        done BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE agenda_items ADD COLUMN IF NOT EXISTS owner_user_id TEXT`;
    await sql`CREATE INDEX IF NOT EXISTS idx_agenda_items_owner_date ON agenda_items(owner_user_id, agenda_date, agenda_time, created_at)`;


    await sql`
      CREATE TABLE IF NOT EXISTS alloggiati_submissions (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        reservation_id TEXT REFERENCES reservations(id) ON DELETE CASCADE,
        submission_date DATE NOT NULL,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        valid_count INTEGER NOT NULL DEFAULT 0,
        total_count INTEGER NOT NULL DEFAULT 0,
        method_name TEXT DEFAULT '',
        receipt_file_id TEXT,
        receipt_file_name TEXT DEFAULT '',
        receipt_saved_at TIMESTAMPTZ
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_alloggiati_submissions_owner_reservation_sent_at ON alloggiati_submissions(owner_user_id, reservation_id, sent_at DESC)`;

    const [ownership] = await sql`
      SELECT (
        (SELECT COUNT(*) FROM rooms WHERE owner_user_id IS NULL) +
        (SELECT COUNT(*) FROM reservations WHERE owner_user_id IS NULL) +
        (SELECT COUNT(*) FROM guests WHERE owner_user_id IS NULL) +
        (SELECT COUNT(*) FROM room_assignments WHERE owner_user_id IS NULL) +
        (SELECT COUNT(*) FROM planner_configs WHERE owner_user_id IS NULL) +
        (SELECT COUNT(*) FROM employees WHERE owner_user_id IS NULL) +
        (SELECT COUNT(*) FROM work_entries WHERE owner_user_id IS NULL) +
        (SELECT COUNT(*) FROM employee_month_overrides WHERE owner_user_id IS NULL) +
        (SELECT COUNT(*) FROM employee_advances WHERE owner_user_id IS NULL) +
        (SELECT COUNT(*) FROM menus WHERE owner_user_id IS NULL) +
        (SELECT COUNT(*) FROM reservation_files WHERE owner_user_id IS NULL) +
        (SELECT COUNT(*) FROM compliance_certs WHERE owner_user_id IS NULL) +
        (SELECT COUNT(*) FROM compliance_docs WHERE owner_user_id IS NULL) +
        (SELECT COUNT(*) FROM agenda_items WHERE owner_user_id IS NULL)
      )::INTEGER AS unowned_count
    `;

    const legacyOwnerUserId = String(options.legacyOwnerUserId || '').trim();
    if (Number(ownership.unowned_count) > 0 && !legacyOwnerUserId) {
      throw new Error('Legacy rows have no owner; rerun with --legacy-owner-user-id=<existing-user-id>');
    }

    if (Number(ownership.unowned_count) > 0) {
      const owners = await sql`SELECT id FROM users WHERE id = ${legacyOwnerUserId} LIMIT 1`;
      if (owners.length === 0) {
        throw new Error('The --legacy-owner-user-id value does not identify an existing user');
      }
      await sql`UPDATE rooms SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
      await sql`UPDATE reservations SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
      await sql`UPDATE guests SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
      await sql`UPDATE room_assignments SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
      await sql`UPDATE planner_configs SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
      await sql`UPDATE employees SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
      await sql`UPDATE work_entries SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
      await sql`UPDATE employee_month_overrides SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
      await sql`UPDATE employee_advances SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
      await sql`UPDATE menus SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
      await sql`UPDATE reservation_files SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
      await sql`UPDATE compliance_certs SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
      await sql`UPDATE compliance_docs SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
      await sql`UPDATE agenda_items SET owner_user_id = ${legacyOwnerUserId} WHERE owner_user_id IS NULL`;
    }

    await sql`
      INSERT INTO daily_menus (id, owner_user_id, menu_date, meal_type, primo, secondo, contorno, dessert)
      SELECT ranked.id, ranked.owner_user_id, ranked.menu_date, ranked.meal_type, ranked.primo, ranked.secondo, ranked.contorno, ranked.dessert
      FROM (
        SELECT
          m.id,
          COALESCE(m.owner_user_id, r.owner_user_id) AS owner_user_id,
          m.menu_date,
          m.meal_type,
          COALESCE(m.primo, '') AS primo,
          COALESCE(m.secondo, '') AS secondo,
          COALESCE(m.contorno, '') AS contorno,
          COALESCE(m.dessert, '') AS dessert,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(m.owner_user_id, r.owner_user_id), m.menu_date, m.meal_type
            ORDER BY
              (
                CASE WHEN COALESCE(m.primo, '') <> '' THEN 1 ELSE 0 END +
                CASE WHEN COALESCE(m.secondo, '') <> '' THEN 1 ELSE 0 END +
                CASE WHEN COALESCE(m.contorno, '') <> '' THEN 1 ELSE 0 END +
                CASE WHEN COALESCE(m.dessert, '') <> '' THEN 1 ELSE 0 END
              ) DESC,
              r.created_at DESC NULLS LAST,
              m.id DESC
          ) AS row_rank
        FROM menus m
        LEFT JOIN reservations r ON r.id = m.reservation_id
        WHERE COALESCE(m.migrated_to_daily, FALSE) = FALSE
      ) ranked
      WHERE ranked.row_rank = 1
      ON CONFLICT (owner_user_id, menu_date, meal_type) DO NOTHING
    `;
    await sql`UPDATE menus SET migrated_to_daily = TRUE WHERE COALESCE(migrated_to_daily, FALSE) = FALSE`;

}
