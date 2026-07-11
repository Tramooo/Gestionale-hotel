(function initApiClient(global) {
  const SAFE_MESSAGES = {
    401: 'Sessione scaduta. Accedi di nuovo.',
    403: 'Non hai i permessi per questa operazione.',
    409: 'L’operazione è in conflitto con dati aggiornati.',
    500: 'Si è verificato un errore. Riprova.'
  };

  class AppError extends Error {
    constructor({ status = 0, code = 'REQUEST_FAILED', message, fieldErrors, conflicts } = {}) {
      super(message || 'Richiesta non riuscita');
      this.name = 'AppError';
      this.status = status;
      this.code = code;
      this.fieldErrors = fieldErrors || {};
      this.conflicts = Array.isArray(conflicts) ? conflicts : [];
    }
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  function toAppError(status, payload) {
    const raw = payload?.error;
    const details = raw && typeof raw === 'object'
      ? raw
      : { message: typeof raw === 'string' ? raw : '' };
    const isServerError = status >= 500;
    return new AppError({
      status,
      code: isServerError ? 'INTERNAL_ERROR' : (details.code || 'REQUEST_FAILED'),
      message: isServerError
        ? SAFE_MESSAGES[500]
        : (details.message || SAFE_MESSAGES[status] || 'Richiesta non riuscita'),
      fieldErrors: details.fieldErrors,
      conflicts: details.conflicts
    });
  }

  async function request(url, { method = 'GET', data } = {}) {
    const headers = data === undefined ? {} : { 'Content-Type': 'application/json' };
    const response = await fetch(url, {
      method,
      credentials: 'include',
      headers,
      ...(data === undefined ? {} : { body: JSON.stringify(data) })
    });
    const payload = response.status === 204 ? null : await readJson(response);
    if (!response.ok) throw toAppError(response.status, payload);
    return payload;
  }

  const apiGet = (url) => request(url);
  const apiPost = (url, data) => request(url, { method: 'POST', data });
  const apiPut = (url, data) => request(url, { method: 'PUT', data });
  const apiDelete = (url, id) => {
    const separator = url.includes('?') ? '&' : '?';
    return request(`${url}${separator}id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  };

  global.GroupStayApi = { AppError, apiDelete, apiGet, apiPost, apiPut };
})(window);
