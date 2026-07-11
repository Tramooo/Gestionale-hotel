import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const removedFiles = [
  'api/_mail.js',
  'api/_mail-utils.js',
  'api/_mail-crypto.js',
  'js/features/mail.js',
  'js/features/mail-ui.js',
  'css/12-new-mail.css',
  'tests/mail-crypto.test.mjs',
  'tests/mail-feature.test.mjs',
  'tests/mail-service.test.mjs',
  'tests/mail-utils.test.mjs'
];

const activeFiles = [
  'index.html',
  'script.js',
  'api/auth.js',
  'api/reservations.js',
  'js/features/reservation-detail.js'
];

test('Mail production and test files are absent', () => {
  for (const file of removedFiles) {
    assert.equal(fs.existsSync(file), false, `${file} must be deleted`);
  }
});

test('active application surfaces contain no Mail feature hooks', () => {
  const source = activeFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  const forbidden = [
    'page-mail', 'nav.mail', 'MailUI', 'GroupStayMail', 'mailAccount',
    'mailMessages', 'mailList', 'mailDetail', 'syncMail', 'saveMailSettings',
    'testMailConnection', 'mailDetailModal', '12-new-mail.css', './_mail.js'
  ];
  for (const token of forbidden) {
    assert.equal(source.includes(token), false, `found removed Mail token: ${token}`);
  }
});

test('Mail transport packages are absent from manifests', () => {
  const manifest = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const lock = fs.readFileSync('package-lock.json', 'utf8');
  for (const dependency of ['imapflow', 'mailparser', 'nodemailer']) {
    assert.equal(manifest.dependencies?.[dependency], undefined);
    assert.equal(lock.includes(`node_modules/${dependency}`), false);
  }
});
