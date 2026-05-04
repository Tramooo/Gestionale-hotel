# Aruba IMAP Mail Inbox Design

## Context

The PMS needs an operational inbox for incoming Aruba email. Each PMS user has their own mailbox. Emails must be copied into the PMS database, assigned to group reservations, and marked as handled inside the PMS without changing the Aruba mailbox.

The project is already at the Vercel limit of 12 serverless functions, so this feature must not add new API route files.

## Goals

- Let each authenticated user configure one Aruba IMAP account.
- Store IMAP credentials encrypted in the database.
- Synchronize the latest 200 incoming emails into a local database copy.
- Keep the Aruba mailbox unchanged: no read flags, moves, deletions, or folder changes.
- Show emails in a new PMS Mail page.
- Assign one email to one group reservation at a time.
- Allow reassignment to a different group reservation.
- Mark emails as handled or archived inside the PMS only.
- Show linked emails inside the group reservation detail view.

## Non-Goals

- Sending or replying to email from the PMS.
- Automatic background synchronization.
- Saving email attachments in the first version.
- Supporting multiple mailboxes per user.
- Adding new serverless API routes.
- Modifying the state of messages on Aruba.

## Architecture

No new serverless route files will be added under `api/`.

Reusable backend logic can live in helper modules such as:

- `api/_mail.js`: IMAP connection, parsing, sync, message normalization.
- `api/_mail-crypto.js`: encryption and decryption of IMAP credentials.

Existing API routes will expose mail actions:

- `api/auth.js`
  - Save IMAP settings for the authenticated user.
  - Return non-sensitive IMAP settings.
  - Test the IMAP connection.

- `api/reservations.js`
  - Trigger manual mail sync.
  - List locally stored mail messages.
  - Return a mail message detail.
  - Assign or unassign a message to a reservation.
  - Mark a message as handled or archived in the PMS.

- `api/init.js`
  - Create and migrate mail tables.

This keeps the feature within the existing Vercel function count.

## Data Model

### `mail_accounts`

One row per PMS user.

- `owner_user_id`
- `imap_email`
- `imap_username`
- `imap_host`
- `imap_port`
- `imap_secure`
- `encrypted_password`
- `created_at`
- `updated_at`
- `last_tested_at`
- `last_sync_at`

The encrypted password is never returned to the frontend.

### `mail_messages`

Local copy of synchronized inbox messages.

- `id`
- `owner_user_id`
- `provider_uid`
- `message_id`
- `mailbox`
- `from_name`
- `from_email`
- `to_text`
- `subject`
- `sent_at`
- `preview_text`
- `body_text`
- `body_html`
- `has_attachments`
- `reservation_id`
- `pms_status`
- `synced_at`
- `created_at`
- `updated_at`

`pms_status` values:

- `unassigned`
- `assigned`
- `handled`
- `archived`

Uniqueness should prevent duplicate imports for the same user and provider message. Prefer `(owner_user_id, provider_uid)` when stable for the selected mailbox, with `message_id` as a fallback dedupe signal.

## IMAP Behavior

- Connect to Aruba IMAP using TLS/SSL, default port `993`.
- Read the inbox in read-only mode where supported.
- Fetch the latest 200 messages.
- Parse sender, recipients, subject, date, plain text, HTML, preview, message ID, UID, and attachment presence.
- Upsert messages into `mail_messages`.
- Do not mark messages as read.
- Do not move messages.
- Do not delete messages.
- Do not create folders.

## Frontend Design

### Settings

Add an Email section in the existing settings modal:

- email address
- IMAP username
- password field
- host, prefilled for Aruba but editable
- port, default `993`
- secure connection toggle
- Save button
- Test connection button

If settings already exist, show non-sensitive values and leave the password blank unless the user enters a replacement.

### Mail Page

Add a desktop sidebar entry for Mail. On mobile, place Mail inside the existing More menu rather than adding another primary tab.

The Mail page contains:

- Sync button: "Aggiorna mail"
- Last sync timestamp
- Filters:
  - all
  - unassigned
  - assigned
  - handled
  - archived
- Search by sender, subject, preview, and linked reservation name.
- Compact list with sender, subject, date, preview, status, and linked reservation.

### Mail Detail

Open a message in a modal or detail panel consistent with existing reservation detail UI.

The detail shows:

- sender
- recipients
- subject
- date
- body
- attachment indicator only
- reservation selector limited to group reservations
- actions:
  - assign/change reservation
  - unassign
  - mark handled
  - archive in PMS

### Reservation Detail

Add a "Mail collegate" section in the group reservation detail view.

Show linked messages with:

- subject
- sender
- date
- PMS status

Each item should open the mail detail.

## Error Handling

- Missing IMAP settings: show a clear prompt to configure the mailbox.
- Invalid credentials or connection failure: show a user-facing error and keep existing settings unchanged unless explicitly saved.
- Sync failure: keep existing local mail messages; do not clear the list.
- Duplicate messages: update existing local rows instead of creating duplicates.
- Reservation deleted: linked messages should remain in the inbox and become unassigned or keep a null `reservation_id`.

## Security

- Store IMAP passwords encrypted using a server-side secret such as `MAIL_CREDENTIALS_SECRET`.
- Fail safely if the encryption secret is missing.
- Never send the encrypted or decrypted password to the frontend.
- Scope all mail data by `owner_user_id`.
- Avoid logging message bodies, passwords, or full credentials.

## Testing

Automated tests should cover:

- credential encryption/decryption helper behavior;
- mail message normalization and dedupe keys;
- PMS status transitions;
- reservation assignment and reassignment rules;
- settings payload sanitization.

Manual verification should cover:

- configure Aruba IMAP settings;
- test connection;
- sync latest 200 inbox messages;
- assign a message to a group reservation;
- change the assigned reservation;
- unassign a message;
- mark handled and archive inside PMS;
- confirm Aruba remains unchanged.

## Implementation Constraints

- Do not add new files that become Vercel serverless functions.
- Keep backend route additions inside existing route files.
- Keep helper modules prefixed with `_` under `api/`.
- Keep the first version focused on reading, local copy, assignment, and PMS-only status.
