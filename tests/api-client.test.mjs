import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

function loadClient(fetchImpl) {
  const context = { window: {}, fetch: fetchImpl, URLSearchParams };
  vm.runInNewContext(fs.readFileSync('js/core/api-client.js', 'utf8'), context);
  return context.window.GroupStayApi;
}

test('all verbs send cookies and never add a bearer header', async () => {
  const calls = [];
  const api = loadClient(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  });
  await api.apiGet('/api/rooms');
  await api.apiPost('/api/rooms', { id: 'r1' });
  await api.apiPut('/api/rooms', { id: 'r1' });
  await api.apiDelete('/api/rooms', 'r1');
  assert.equal(calls.length, 4);
  for (const call of calls) {
    assert.equal(call.options.credentials, 'include');
    assert.equal('X-Session-Token' in (call.options.headers || {}), false);
    assert.equal('Authorization' in (call.options.headers || {}), false);
  }
});

test('failure payload becomes the stable AppError shape', async () => {
  const api = loadClient(async () => ({
    ok: false,
    status: 409,
    json: async () => ({
      error: {
        code: 'ROOM_AVAILABILITY_CONFLICT',
        message: 'La camera non è disponibile',
        fieldErrors: { roomIds: 'Seleziona un’altra camera' },
        conflicts: [{ roomId: 'r1', reservationId: 'res2' }]
      }
    })
  }));
  await assert.rejects(
    api.apiPost('/api/reservations', {}),
    (error) => error.name === 'AppError'
      && error.status === 409
      && error.code === 'ROOM_AVAILABILITY_CONFLICT'
      && error.fieldErrors.roomIds === 'Seleziona un’altra camera'
      && error.conflicts[0].reservationId === 'res2'
  );
});

test('invalid or server error bodies use a generic safe message', async () => {
  const api = loadClient(async () => ({
    ok: false,
    status: 500,
    json: async () => { throw new Error('not json'); }
  }));
  await assert.rejects(
    api.apiGet('/api/rooms'),
    (error) => error.code === 'INTERNAL_ERROR'
      && error.message === 'Si è verificato un errore. Riprova.'
  );
});
