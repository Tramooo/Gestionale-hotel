import { neon } from '@neondatabase/serverless';
import { runMigrations } from './lib/migration-runner.mjs';
import * as baseline from './migrations/001-baseline-schema.mjs';
import * as removeMail from './migrations/002-remove-mail.mjs';

const args = process.argv.slice(2);
const valueFor = (name) => {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || '';
};

if (args.includes('--help') || args.includes('-h')) {
  console.log([
    'Usage: npm run migrate:schema -- [--apply] [options]',
    '--apply                       execute pending migrations',
    '--legacy-owner-user-id=<id>   owner for legacy rows that have no owner',
    '--ack-mail-backup             confirm legacy Mail tables were backed up'
  ].join('\n'));
  process.exit(0);
}

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const result = await runMigrations({
  sql: neon(process.env.DATABASE_URL),
  migrations: [baseline, removeMail],
  apply: args.includes('--apply'),
  options: {
    legacyOwnerUserId: valueFor('legacy-owner-user-id'),
    mailBackupAcknowledged: args.includes('--ack-mail-backup')
  }
});

for (const entry of result) console.log(`${entry.id}: ${entry.status}`);
if (!args.includes('--apply')) {
  console.log('Dry-run only. Re-run with --apply after reviewing the pending list.');
}
