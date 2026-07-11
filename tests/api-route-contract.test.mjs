import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const expectedRoutes = [
  'agenda.js', 'alloggiati.js', 'assignments.js', 'auth.js', 'compliance.js',
  'employees.js', 'files.js', 'guests.js', 'menus.js', 'reservations.js', 'rooms.js'
];

test('the deployment exposes exactly eleven serverless route files', () => {
  const actual = fs.readdirSync('api')
    .filter((name) => name.endsWith('.js') && !name.startsWith('_'))
    .sort();
  assert.deepEqual(actual, expectedRoutes);
  assert.equal(fs.existsSync('api/init.js'), false);
});

test('request-time API code contains no schema DDL', () => {
  for (const name of fs.readdirSync('api').filter((file) => file.endsWith('.js'))) {
    const source = fs.readFileSync(path.join('api', name), 'utf8');
    assert.doesNotMatch(
      source,
      /\b(?:CREATE\s+TABLE|ALTER\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX|DROP\s+TABLE)\b/i,
      name
    );
  }
});

test('schema migration has a package command', () => {
  const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(manifest.scripts['migrate:schema'], 'node scripts/migrate.mjs');
});
