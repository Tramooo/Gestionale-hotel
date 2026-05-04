import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function createElement() {
    return {
        classList: {
            add() {},
            remove() {},
            toggle() {}
        },
        dataset: {},
        innerHTML: '',
        style: {},
        textContent: '',
        value: ''
    };
}

function loadMailFeature() {
    const elements = new Map();
    const document = {
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, createElement());
            return elements.get(id);
        },
        querySelectorAll() {
            return [];
        }
    };
    const context = { document, window: {} };
    vm.runInNewContext(fs.readFileSync('js/features/mail.js', 'utf8'), context);
    return { elements, mail: context.window.GroupStayMail };
}

function baseDeps(overrides = {}) {
    return {
        API: { auth: '/api/auth', reservations: '/api/reservations' },
        apiGet() {},
        apiPost() {},
        escapeHtml(value) {
            return String(value ?? '');
        },
        formatDateDisplay(value) {
            return String(value ?? '');
        },
        getMailAccount() {
            return { configured: false };
        },
        getMailMessages() {
            return [];
        },
        getReservations() {
            return [];
        },
        openModal() {},
        setMailAccount() {},
        setMailMessages() {},
        showToast() {},
        t(key) {
            return key;
        },
        ...overrides
    };
}

test('renderMailPage shows a configure prompt when mail is not configured', () => {
    const { elements, mail } = loadMailFeature();
    mail.init(baseDeps());

    mail.renderMailPage();

    assert.match(elements.get('mailList').innerHTML, /mail\.configurePrompt/);
    assert.match(elements.get('mailList').innerHTML, /openModal\('settingsModal'\)/);
});

test('renderMailPage lists a message with sender subject and linked reservation', () => {
    const { elements, mail } = loadMailFeature();
    mail.init(baseDeps({
        getMailAccount() {
            return { configured: true, lastSyncAt: '2026-05-04T08:00:00.000Z' };
        },
        getMailMessages() {
            return [{
                id: 'mail-1',
                fromName: 'Mario Rossi',
                fromEmail: 'mario@example.it',
                subject: 'Gruppo maggio',
                sentAt: '2026-05-03T12:00:00.000Z',
                previewText: 'Vorrei un preventivo',
                pmsStatus: 'assigned',
                reservationId: 'res-1'
            }];
        },
        getReservations() {
            return [{ id: 'res-1', groupName: 'Gruppo Verdi', resType: 'group' }];
        }
    }));

    mail.renderMailPage();

    assert.match(elements.get('mailList').innerHTML, /Gruppo maggio/);
    assert.match(elements.get('mailList').innerHTML, /Mario Rossi/);
    assert.match(elements.get('mailList').innerHTML, /Gruppo Verdi/);
});
