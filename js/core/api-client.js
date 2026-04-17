(function initApiClient(global) {
    const SESSION_TOKEN_KEY = 'gs_session_token';
    let inMemorySessionToken = null;

    function getAuthHeaders() {
        const token = inMemorySessionToken || localStorage.getItem(SESSION_TOKEN_KEY);
        return token ? { 'X-Session-Token': token } : {};
    }

    function persistSessionTokenFromPayload(payload) {
        const token = payload?.sessionToken;
        if (!token) return;
        inMemorySessionToken = token;
        try {
            localStorage.setItem(SESSION_TOKEN_KEY, token);
        } catch (error) {
            console.warn('Unable to persist session token:', error);
        }
    }

    function primeSessionToken(token) {
        if (!token) return;
        inMemorySessionToken = token;
        try {
            localStorage.setItem(SESSION_TOKEN_KEY, token);
        } catch (error) {
            console.warn('Unable to persist session token:', error);
        }
    }

    function clearSessionToken() {
        inMemorySessionToken = null;
        try {
            localStorage.removeItem(SESSION_TOKEN_KEY);
        } catch (error) {
            console.warn('Unable to clear session token:', error);
        }
    }

    async function apiGet(url) {
        const res = await fetch(url, { credentials: 'include', headers: getAuthHeaders() });
        if (!res.ok) {
            const err = new Error(`API error: ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return res.json();
    }

    async function apiPost(url, data) {
        const res = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const err = new Error(body.error || `API error: ${res.status}`);
            err.status = res.status;
            throw err;
        }
        const payload = await res.json();
        persistSessionTokenFromPayload(payload);
        return payload;
    }

    async function apiPut(url, data) {
        const res = await fetch(url, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = new Error(`API error: ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return res.json();
    }

    async function apiDelete(url, id) {
        const res = await fetch(`${url}?id=${id}`, { method: 'DELETE', credentials: 'include', headers: getAuthHeaders() });
        if (!res.ok) {
            const err = new Error(`API error: ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return res.json();
    }

    global.GroupStayApi = { apiGet, apiPost, apiPut, apiDelete, clearSessionToken, primeSessionToken };
})(window);
