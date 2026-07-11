function orderedMigrations(migrations) {
  const ordered = [...migrations].sort((a, b) => a.id.localeCompare(b.id));
  const ids = new Set();
  for (const migration of ordered) {
    if (!/^\d{3}-[a-z0-9-]+$/.test(migration.id) || typeof migration.up !== 'function') {
      throw new TypeError('Migration requires an id like 001-name and an up function');
    }
    if (ids.has(migration.id)) throw new TypeError('Migration ids must be unique');
    ids.add(migration.id);
  }
  return ordered;
}

export async function runMigrations({ sql, migrations, apply = false, options = {}, logger = console }) {
  const ordered = orderedMigrations(migrations);
  if (!apply) return ordered.map(({ id }) => ({ id, status: 'pending' }));

  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  const rows = await sql`SELECT id FROM schema_migrations ORDER BY id`;
  const applied = new Set(rows.map((row) => row.id));
  const result = [];

  for (const migration of ordered) {
    if (applied.has(migration.id)) {
      result.push({ id: migration.id, status: 'skipped' });
      continue;
    }
    logger.info(`Applying ${migration.id}`);
    await migration.up({ sql, options });
    await sql`INSERT INTO schema_migrations (id) VALUES (${migration.id})`;
    result.push({ id: migration.id, status: 'applied' });
  }
  return result;
}
