import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadAssignmentPrintFeature() {
    const context = { window: {} };
    vm.runInNewContext(fs.readFileSync('js/features/assignment-print.js', 'utf8'), context);
    return context.window.GroupStayAssignmentPrint;
}

const labels = {
    room: 'Camera',
    roomType: 'Tipo',
    notes: 'Note',
    floor: 'Piano',
    printCleaning: 'Stampa Pulizie'
};

const rooms = [
    { id: 'r101', number: '101', floor: 1 },
    { id: 'r102', number: '102', floor: 1 },
    { id: 'r201', number: '201', floor: 2 },
    { id: 'r301', number: '301', floor: 3 }
];

const plannerColumns = [
    { id: 'usage', name: 'Utilizzo' },
    { id: 'group', name: 'Gruppo' }
];

const assignmentData = [
    { roomId: 'r101', cellValues: { usage: 'Doppia', group: 'Rossi' } },
    { roomId: 'r201', cellValues: { usage: 'Singola', group: 'Bianchi' } }
];

function escapeForTest(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function build(mode) {
    return loadAssignmentPrintFeature().buildAssignmentPrintDocument({
        reservation: { groupName: 'Gruppo Test' },
        rooms,
        assignmentData,
        plannerColumns,
        mode,
        labels,
        escapeHtml: escapeForTest
    });
}

test('cleaning print uses A4 landscape and creates one page per floor', () => {
    const html = build('cleaning');

    assert.match(html, /@page \{ size: A4 landscape; margin: 0; \}/);
    assert.equal((html.match(/class="page-block print-cleaning-page"/g) || []).length, 3);
    assert.match(html, /class="print-cleaning-floor-label"[^>]*>Piano 1<\/td>/);
    assert.match(html, /\.print-cleaning-floor-label \{[^}]*font-size: 30px/);
    assert.match(html, /\.print-cleaning-table th \{[^}]*font-size: 18px/);
    assert.match(html, /\.print-cleaning-room-cell \{[^}]*font-size: 22px/);
    assert.match(html, /\.print-cleaning-type-cell, \.print-cleaning-notes-cell \{[^}]*font-size: 20px/);
    assert.match(html, /\.print-cleaning-room-cell \{[^}]*padding: 6px 10px/);
    assert.match(html, /\.print-cleaning-notes-head, \.print-cleaning-notes-cell \{[^}]*width: 57%/);
});

test('standard print keeps two floors per page and avoids cleaning landscape orientation', () => {
    const html = build();

    assert.equal((html.match(/class="page-block print-standard-page"/g) || []).length, 2);
    assert.doesNotMatch(html, /size: A4 landscape/);
    assert.match(html, /<span class="print-floor-badge">Piano 1<\/span>/);
    assert.match(html, /<span class="print-floor-badge">Piano 2<\/span>/);
    assert.match(html, /\.print-floor-badge \{[^}]*font-size: 22px/);
    assert.match(html, /\.print-floor-badge \{[^}]*font-weight: 700/);
    assert.match(html, /\.print-assign-table th \{[^}]*font-weight: 650/);
    assert.match(html, /\.print-room-cell \{[^}]*font-weight: 700/);
    assert.match(html, /\.print-room-cell, \.print-value-cell \{[^}]*border-bottom: 1\.5px solid #333/);
});

test('cleaning print uses the first planner column as room type and escapes values', () => {
    const html = loadAssignmentPrintFeature().buildAssignmentPrintDocument({
        reservation: { groupName: 'Gruppo <Test>' },
        rooms: [{ id: 'r1', number: '<101>', floor: 1 }],
        assignmentData: [{ roomId: 'r1', cellValues: { usage: 'Tripla <vip>' } }],
        plannerColumns,
        mode: 'cleaning',
        labels,
        escapeHtml: escapeForTest
    });

    assert.match(html, /&lt;101&gt;/);
    assert.match(html, /Tripla &lt;vip&gt;/);
    assert.match(html, /Gruppo &lt;Test&gt; - Stampa Pulizie/);
});

test('index loads assignment print helper before the main script', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const helperIndex = html.indexOf('js/features/assignment-print.js');
    const scriptIndex = html.indexOf('script.js');

    assert.notEqual(helperIndex, -1);
    assert.notEqual(scriptIndex, -1);
    assert.ok(helperIndex < scriptIndex);
});
