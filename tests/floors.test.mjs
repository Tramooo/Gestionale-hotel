import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadFloorsFeature() {
    const context = { window: {} };
    vm.runInNewContext(fs.readFileSync('js/core/floors.js', 'utf8'), context);
    return context.window.GroupStayFloors;
}

function sameRealm(value) {
    return JSON.parse(JSON.stringify(value));
}

test('builds the configured room floor range', () => {
    const floors = loadFloorsFeature();

    assert.deepEqual(sameRealm(floors.normalizeFloorRange(2, 5)), { start: 2, end: 5 });
    assert.deepEqual(sameRealm(floors.getFloorOptions({ start: 2, end: 5 })), [2, 3, 4, 5]);
});

test('normalizes inverted floor range values', () => {
    const floors = loadFloorsFeature();

    assert.deepEqual(sameRealm(floors.normalizeFloorRange(5, 2)), { start: 2, end: 5 });
    assert.deepEqual(sameRealm(floors.getFloorOptions({ start: 5, end: 2 })), [2, 3, 4, 5]);
});

test('keeps an existing room floor available when it is outside the configured range', () => {
    const floors = loadFloorsFeature();

    assert.deepEqual(sameRealm(floors.getFloorOptions({ start: 2, end: 5 }, 7)), [2, 3, 4, 5, 7]);
});
