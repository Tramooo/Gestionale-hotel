import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

test('login handler is globally callable by the login form', () => {
  const source = fs.readFileSync('script.js', 'utf8');
  const start = source.indexOf('function clearAuthErrors()');
  const end = source.indexOf('async function logoutUser()');

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const authFunctions = source.slice(start, end);
  const handlerType = vm.runInNewContext(`${authFunctions}\ntypeof submitLogin`);

  assert.equal(handlerType, 'function');
});
