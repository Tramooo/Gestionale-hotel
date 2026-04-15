(function initApiClient(global) {
    async function apiGet(url) {
        const res = await fetch(url, { credentials: 'include' });
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const err = new Error(body.error || `API error: ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return res.json();
    }

    async function apiPut(url, data) {
        const res = await fetch(url, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
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
        const res = await fetch(`${url}?id=${id}`, { method: 'DELETE', credentials: 'include' });
        if (!res.ok) {
            const err = new Error(`API error: ${res.status}`);
            err.status = res.status;
            throw err;
        }
        return res.json();
    }

    global.GroupStayApi = { apiGet, apiPost, apiPut, apiDelete };
})(window);
