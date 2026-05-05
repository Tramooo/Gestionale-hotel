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

function loadMailFeature(options = {}) {
    const elements = new Map();
    const linkedLists = options.linkedLists || [];
    const document = {
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, createElement());
            return elements.get(id);
        },
        querySelectorAll(selector) {
            if (selector === '.mail-linked-list[data-reservation-id]') return linkedLists;
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

test('renderLinkedReservationMail returns compact rows for linked reservation messages', () => {
    const { mail } = loadMailFeature();
    mail.init(baseDeps({
        getMailMessages() {
            return [
                {
                    id: 'mail-1',
                    fromName: 'Mario Rossi',
                    fromEmail: 'mario@example.it',
                    subject: 'Gruppo maggio',
                    sentAt: '2026-05-03T12:00:00.000Z',
                    pmsStatus: 'assigned',
                    reservationId: 'res-1'
                },
                {
                    id: 'mail-2',
                    fromName: 'Luisa Bianchi',
                    fromEmail: 'luisa@example.it',
                    subject: 'Altra richiesta',
                    sentAt: '2026-05-02T12:00:00.000Z',
                    pmsStatus: 'unassigned',
                    reservationId: 'res-2'
                }
            ];
        }
    }));

    const html = mail.renderLinkedReservationMail('res-1');

    assert.match(html, /mail-linked-row/);
    assert.match(html, /Gruppo maggio/);
    assert.match(html, /Mario Rossi/);
    assert.match(html, /openMailDetail\('mail-1'\)/);
    assert.doesNotMatch(html, /Altra richiesta/);
});

test('markMailHandled refreshes visible linked reservation mail lists for old and new reservations', async () => {
    const res1List = createElement();
    res1List.dataset.reservationId = 'res-1';
    const res2List = createElement();
    res2List.dataset.reservationId = 'res-2';
    const { elements, mail } = loadMailFeature({ linkedLists: [res1List, res2List] });
    let messages = [{
        id: 'mail-1',
        fromName: 'Mario Rossi',
        fromEmail: 'mario@example.it',
        subject: 'Gruppo maggio',
        sentAt: '2026-05-03T12:00:00.000Z',
        pmsStatus: 'assigned',
        reservationId: 'res-1'
    }];
    mail.init(baseDeps({
        apiPost(_url, payload) {
            return {
                message: {
                    ...messages.find((message) => message.id === payload.id),
                    ...payload,
                    subject: 'Gruppo aggiornato'
                }
            };
        },
        getMailAccount() {
            return { configured: true };
        },
        getMailMessages() {
            return messages;
        },
        setMailMessages(nextMessages) {
            messages = nextMessages;
        }
    }));
    elements.set('mailReservationSelect', { ...createElement(), value: 'res-2' });
    res1List.innerHTML = mail.renderLinkedReservationMail('res-1');
    res2List.innerHTML = mail.renderLinkedReservationMail('res-2');

    await mail.markMailHandled('mail-1');

    assert.doesNotMatch(res1List.innerHTML, /Gruppo maggio/);
    assert.match(res1List.innerHTML, /mail\.noLinkedMail/);
    assert.match(res2List.innerHTML, /Gruppo aggiornato/);
    assert.match(res2List.innerHTML, /mail\.status\.handled/);
});

test('testMailConnection posts the current settings form values', async () => {
    const { elements, mail } = loadMailFeature();
    let postedUrl = '';
    let postedPayload = null;
    let accountUpdates = 0;

    mail.init(baseDeps({
        apiPost(url, payload) {
            postedUrl = url;
            postedPayload = payload;
            return { success: true, testedAccount: { configured: true } };
        },
        setMailAccount() {
            accountUpdates += 1;
        }
    }));

    for (const id of ['mailSettingEmail', 'mailSettingUsername', 'mailSettingPassword', 'mailSettingHost', 'mailSettingPort', 'mailSettingSecure']) {
        elements.set(id, createElement());
    }

    elements.get('mailSettingEmail').value = 'desk@example.com';
    elements.get('mailSettingUsername').value = 'desk@example.com';
    elements.get('mailSettingPassword').value = 'new-secret';
    elements.get('mailSettingHost').value = 'imap.aruba.it';
    elements.get('mailSettingPort').value = '993';
    elements.get('mailSettingSecure').checked = true;

    await mail.testMailConnection();

    assert.equal(postedUrl, '/api/auth?action=testMailConnection');
    assert.deepEqual(JSON.parse(JSON.stringify(postedPayload)), {
        email: 'desk@example.com',
        username: 'desk@example.com',
        password: 'new-secret',
        host: 'imap.aruba.it',
        port: '993',
        secure: true
    });
    assert.equal(accountUpdates, 0);
});

test('index loads mail feature before the main script', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const mailFeatureIndex = html.indexOf('js/features/mail.js');
    const mainScriptIndex = html.indexOf('script.js');

    assert.notEqual(mailFeatureIndex, -1);
    assert.notEqual(mainScriptIndex, -1);
    assert.ok(mailFeatureIndex < mainScriptIndex);
});

test('settings modal uses the wide settings layout for mail configuration', () => {
    const html = fs.readFileSync('index.html', 'utf8');

    assert.match(html, /<div class="modal settings-modal">/);
    assert.match(html, /<div class="modal-body settings-modal-body">/);
    assert.match(html, /<div class="settings-section settings-mail-section">/);
    assert.match(html, /<div class="settings-mail-grid">/);
    assert.match(html, /<div class="settings-mail-actions">/);
});

test('settings modal no longer exposes the Scidoo import entry point', () => {
    const html = fs.readFileSync('index.html', 'utf8');

    assert.doesNotMatch(html, /settings\.importScidoo/);
    assert.doesNotMatch(html, /csvFileInput/);
});
