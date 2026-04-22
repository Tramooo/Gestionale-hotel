import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import {
  GUEST_FIELD_MAP,
  decryptGuestRow,
  encryptGuestForStorage,
  isGuestRowFullyEncrypted
} from '../api/_guest-crypto.js';

function loadEnvFile(fileName) {
  const filePath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    if (!key || process.env[key]) continue;

    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function printUsage() {
  console.log(`
Usage:
  node scripts/migrate-guest-encryption.mjs [--apply]

Options:
  --apply   Executes the migration. Without this flag the script runs in dry-run mode.

Required env vars:
  DATABASE_URL
  GUEST_DATA_ENCRYPTION_KEY
`.trim());
}

async function main() {
  loadEnvFile('.env.local');
  loadEnvFile('.env');

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const apply = process.argv.includes('--apply');
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
  if (!process.env.GUEST_DATA_ENCRYPTION_KEY && !process.env.DATA_ENCRYPTION_KEY) {
    throw new Error('GUEST_DATA_ENCRYPTION_KEY is required');
  }

  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT * FROM guests`;

  const encryptedRows = rows.filter((row) => isGuestRowFullyEncrypted(row));
  const rowsToMigrate = rows.filter((row) => !isGuestRowFullyEncrypted(row));

  console.log(`Guest rows found: ${rows.length}`);
  console.log(`Already encrypted: ${encryptedRows.length}`);
  console.log(`Need migration: ${rowsToMigrate.length}`);

  if (rowsToMigrate.length === 0) {
    console.log('No guest rows need encryption.');
    return;
  }

  const sample = rowsToMigrate.slice(0, 5).map((row) => ({
    id: row.id,
    reservationId: row.reservation_id,
    ownerUserId: row.owner_user_id,
    guestPreview: `${row.first_name || ''} ${row.last_name || ''}`.trim() || '(senza nome)'
  }));

  console.log('Sample rows to migrate:');
  sample.forEach((entry) => {
    console.log(`- ${entry.id} | reservation ${entry.reservationId} | owner ${entry.ownerUserId} | ${entry.guestPreview}`);
  });

  if (!apply) {
    console.log('Dry-run completed. Re-run with --apply to encrypt the guest rows.');
    return;
  }

  for (const row of rowsToMigrate) {
    const guest = decryptGuestRow(row);
    const encryptedGuest = encryptGuestForStorage(guest);

    await sql`
      UPDATE guests
      SET
        first_name = ${encryptedGuest.firstName},
        last_name = ${encryptedGuest.lastName},
        email = ${encryptedGuest.email},
        phone = ${encryptedGuest.phone},
        doc_type = ${encryptedGuest.docType},
        doc_number = ${encryptedGuest.docNumber},
        notes = ${encryptedGuest.notes},
        sex = ${encryptedGuest.sex},
        birth_date = ${encryptedGuest.birthDate},
        birth_comune = ${encryptedGuest.birthComune},
        birth_province = ${encryptedGuest.birthProvince},
        birth_country = ${encryptedGuest.birthCountry},
        citizenship = ${encryptedGuest.citizenship},
        doc_issued_place = ${encryptedGuest.docIssuedPlace},
        guest_type = ${encryptedGuest.guestType},
        residence_comune = ${encryptedGuest.residenceComune}
      WHERE id = ${row.id}
    `;
  }

  const migratedRows = await sql`SELECT * FROM guests`;
  const stillPlain = migratedRows.filter((row) => !isGuestRowFullyEncrypted(row));

  console.log(`Migration applied: ${rowsToMigrate.length} guest rows updated.`);
  console.log(`Rows still not fully encrypted: ${stillPlain.length}`);

  if (stillPlain.length > 0) {
    console.log('Rows still needing attention:');
    stillPlain.slice(0, 10).forEach((row) => {
      const plainFields = GUEST_FIELD_MAP
        .filter(([dbField]) => {
          const value = row?.[dbField];
          return value !== null && value !== undefined && value !== '' && !String(value).startsWith('enc$guest$v1:');
        })
        .map(([dbField]) => dbField);
      console.log(`- ${row.id}: ${plainFields.join(', ')}`);
    });
  }
}

main().catch((error) => {
  console.error('Guest encryption migration failed:', error.message);
  process.exit(1);
});
