import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function activeBrowserSources() {
  const core = fs.readdirSync('js/core')
    .filter((name) => name.endsWith('.js') && name !== 'preferences.js')
    .map((name) => `js/core/${name}`);
  const features = fs.readdirSync('js/features')
    .filter((name) => name.endsWith('.js'))
    .map((name) => `js/features/${name}`);
  return ['script.js', ...core, ...features];
}

test('only the preference module touches localStorage', () => {
  for (const file of activeBrowserSources()) {
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(source.includes('localStorage'), false, file);
  }
});

test('persistent PII cache and browser bootstrap are absent', () => {
  const source = [
    fs.readFileSync('script.js', 'utf8'),
    fs.readFileSync('js/core/config.js', 'utf8'),
    fs.readFileSync('index.html', 'utf8')
  ].join('\n');
  for (const token of ['CACHE_KEY', 'CACHE_TTL', 'saveDataCache', 'loadDataCache', 'GroupStayBootstrap', '/api/init']) {
    assert.equal(source.includes(token), false, token);
  }
  assert.equal(fs.existsSync('js/core/bootstrap.js'), false);
  assert.equal(fs.existsSync('tests/bootstrap.test.mjs'), false);
});
