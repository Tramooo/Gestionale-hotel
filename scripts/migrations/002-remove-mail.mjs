export const id = '002-remove-mail';

export async function up({ sql, options = {} }) {
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('mail_messages', 'mail_accounts')
    ORDER BY table_name
  `;
  if (tables.length === 0) return;
  if (options.mailBackupAcknowledged !== true) {
    throw new Error('Mail tables exist; back them up and rerun with --ack-mail-backup');
  }
  await sql`DROP TABLE IF EXISTS mail_messages`;
  await sql`DROP TABLE IF EXISTS mail_accounts`;
}
