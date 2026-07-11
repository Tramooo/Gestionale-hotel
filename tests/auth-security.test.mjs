import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import authHandler from '../api/auth.js';

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader() {}
  };
}

test('registration fails closed before database access', async () => {
  delete process.env.PUBLIC_REGISTRATION_ENABLED;
  const req = {
    method: 'POST',
    query: { action: 'register' },
    body: { email: 'new@example.it', password: 'password123' },
    headers: {}
  };
  const res = responseRecorder();
  await authHandler(req, res);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, {
    error: { code: 'REGISTRATION_DISABLED', message: 'Registrazione pubblica non disponibile' }
  });
});

test('authentication source accepts only the HttpOnly cookie', () => {
  const auth = fs.readFileSync('api/_auth.js', 'utf8');
  const handler = fs.readFileSync('api/auth.js', 'utf8');
  assert.equal(auth.includes('x-session-token'), false);
  assert.equal(auth.includes('X-Session-Token'), false);
  assert.equal(handler.includes('sessionToken'), false);
  assert.match(auth, /HttpOnly/);
  assert.match(auth, /SameSite=Lax/);
});

test('public login UI has no registration or remembered-password controls', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const script = fs.readFileSync('script.js', 'utf8');
  for (const token of ['registerForm', 'authTabRegister', 'loginRemember', 'submitRegister', 'REMEMBERED_LOGIN_KEY']) {
    assert.equal((html + script).includes(token), false, token);
  }
});
