import assert from 'node:assert/strict';
import test from 'node:test';
import { runMigrations } from '../scripts/lib/migration-runner.mjs';

function createSqlFake() {
  const applied = new Set();
  const statements = [];
  async function sql(strings, ...values) {
    const text = strings.join('?').replace(/\s+/g, ' ').trim();
    statements.push({ text, values });
    if (text.includes('SELECT id FROM schema_migrations')) return [...applied].map((id) => ({ id }));
    if (text.includes('INSERT INTO schema_migrations')) applied.add(values[0]);
    return [];
  }
  return { sql, applied, statements };
}

test('dry-run reports sorted migrations without touching the database', async () => {
  const fake = createSqlFake();
  const migrations = [
    { id: '002-second', up: async () => {} },
    { id: '001-first', up: async () => {} }
  ];
  const result = await runMigrations({ sql: fake.sql, migrations, apply: false });
  assert.deepEqual(result, [
    { id: '001-first', status: 'pending' },
    { id: '002-second', status: 'pending' }
  ]);
  assert.equal(fake.statements.length, 0);
});

test('apply records each migration and a second run skips it', async () => {
  const fake = createSqlFake();
  const calls = [];
  const migrations = [
    { id: '001-first', up: async ({ options }) => calls.push(['first', options.owner]) },
    { id: '002-second', up: async () => calls.push(['second']) }
  ];
  const first = await runMigrations({ sql: fake.sql, migrations, apply: true, options: { owner: 'u1' } });
  const second = await runMigrations({ sql: fake.sql, migrations, apply: true });
  assert.deepEqual(calls, [['first', 'u1'], ['second']]);
  assert.deepEqual(first.map((entry) => entry.status), ['applied', 'applied']);
  assert.deepEqual(second.map((entry) => entry.status), ['skipped', 'skipped']);
});

test('duplicate or malformed migration ids are rejected', async () => {
  const fake = createSqlFake();
  await assert.rejects(
    runMigrations({
      sql: fake.sql,
      migrations: [
        { id: '001-valid', up: async () => {} },
        { id: '001-valid', up: async () => {} }
      ],
      apply: false
    }),
    /unique/
  );
});
