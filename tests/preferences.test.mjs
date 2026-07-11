import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function createStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    keys() { return [...values.keys()]; }
  };
}

function loadPreferences(storage) {
  const context = { window: { localStorage: storage } };
  vm.runInNewContext(fs.readFileSync('js/core/preferences.js', 'utf8'), context);
  return context.window.GroupStayPreferences;
}

test('stores only sanitized allowlisted preferences under one key', () => {
  const storage = createStorage({ gs_session_token: 'secret', 'gs_data_cache:u1': 'pii' });
  const preferences = loadPreferences(storage);
  preferences.set('language', 'en');
  preferences.set('plannerDimensions', { dayWidth: 999, rowHeight: 20 });
  preferences.set('plannerFloorRange', { start: 4, end: -2 });
  preferences.set('sidebarCollapsed', true);
  assert.deepEqual(storage.keys(), ['gs_preferences_v1']);
  assert.equal(preferences.get('language'), 'en');
  assert.deepEqual(JSON.parse(JSON.stringify(preferences.get('plannerDimensions'))), { dayWidth: 80, rowHeight: 28 });
  assert.deepEqual(JSON.parse(JSON.stringify(preferences.get('plannerFloorRange'))), { start: -2, end: 4 });
  assert.equal(preferences.get('sidebarCollapsed'), true);
});

test('rejects unknown keys and recovers from malformed JSON', () => {
  const storage = createStorage({ gs_preferences_v1: '{bad json' });
  const preferences = loadPreferences(storage);
  assert.equal(preferences.get('language', 'it'), 'it');
  assert.throws(() => preferences.set('password', 'secret'), /Unknown preference/);
  assert.deepEqual(JSON.parse(JSON.stringify(preferences.snapshot())), {
    language: 'it',
    plannerDimensions: { dayWidth: 38, rowHeight: 34 },
    plannerFloorRange: null,
    sidebarCollapsed: false
  });
});
