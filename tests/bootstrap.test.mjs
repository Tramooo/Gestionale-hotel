import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

function loadBootstrap() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync('js/core/bootstrap.js', 'utf8'), context);
  return context.window.GroupStayBootstrap;
}

test('bootstrap init cache runs once per user and schema version', () => {
  const bootstrap = loadBootstrap();
  const storage = createStorage();

  assert.equal(bootstrap.shouldRunInit({ storage, userId: 'user_1', version: 'v1' }), true);

  bootstrap.markInitComplete({ storage, userId: 'user_1', version: 'v1' });

  assert.equal(bootstrap.shouldRunInit({ storage, userId: 'user_1', version: 'v1' }), false);
  assert.equal(bootstrap.shouldRunInit({ storage, userId: 'user_1', version: 'v2' }), true);
  assert.equal(bootstrap.shouldRunInit({ storage, userId: 'user_2', version: 'v1' }), true);
});

test('index loads bootstrap helper before the main script', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const bootstrapIndex = html.indexOf('js/core/bootstrap.js');
  const scriptIndex = html.indexOf('script.js');

  assert.notEqual(bootstrapIndex, -1);
  assert.notEqual(scriptIndex, -1);
  assert.ok(bootstrapIndex < scriptIndex);
});
