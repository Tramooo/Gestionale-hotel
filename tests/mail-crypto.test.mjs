import assert from 'node:assert/strict';
import test from 'node:test';

import { decryptSecret, encryptSecret } from '../api/_mail-crypto.js';

const SECRET = '0123456789abcdef0123456789abcdef';

test('encryptSecret creates a v1 token that decryptSecret can restore', () => {
  const token = encryptSecret('  aruba-password  ', SECRET);

  assert.match(token, /^v1:[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  assert.equal(decryptSecret(token, SECRET), '  aruba-password  ');
});

test('decryptSecret rejects malformed tokens', () => {
  assert.throws(
    () => decryptSecret('v1:not-enough-parts', SECRET),
    /malformed|invalid/i,
  );
});

test('encryptSecret rejects missing or short secrets', () => {
  const previousSecret = process.env.MAIL_CREDENTIALS_SECRET;
  delete process.env.MAIL_CREDENTIALS_SECRET;

  try {
    assert.throws(
      () => encryptSecret('password'),
      /MAIL_CREDENTIALS_SECRET/,
    );
    assert.throws(
      () => decryptSecret('v1:abc.def.ghi', 'too-short'),
      /MAIL_CREDENTIALS_SECRET/,
    );
  } finally {
    if (previousSecret === undefined) {
      delete process.env.MAIL_CREDENTIALS_SECRET;
    } else {
      process.env.MAIL_CREDENTIALS_SECRET = previousSecret;
    }
  }
});
