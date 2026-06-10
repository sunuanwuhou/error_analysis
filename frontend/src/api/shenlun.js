const BASE = '/api/shenlun';
function formatRequestError(status, body) {
    const o = body;
    const d = o?.detail;
    if (typeof d === 'string' && d.trim())
        return d;
    if (Array.isArray(d)) {
        const parts = d.map((x) => (typeof x === 'object' && x && 'msg' in x ? String(x.msg) : String(x)));
        const s = parts.filter(Boolean).join('；');
        if (s)
            return s;
    }
    return `HTTP ${status}`;
}
async function request(path, init) {
    const res = await fetch(`${BASE}${path}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
        ...init,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(formatRequestError(res.status, err));
    }
    return res.json();
}
export const shenlunApi = {
    listSources(nodeId, search) {
        const q = new URLSearchParams();
        q.set('node_id', nodeId);
        const s = (search ?? '').trim();
        if (s)
            q.set('q', s);
        return request(`/sources?${q.toString()}`);
    },
    deleteSource(sourceId) {
        return request(`/sources/${encodeURIComponent(sourceId)}`, { method: 'DELETE' });
    },
    getSource(sourceId) {
        return request(`/sources/${encodeURIComponent(sourceId)}`);
    },
    listAttemptsForSource(sourceId) {
        return request(`/sources/${encodeURIComponent(sourceId)}/attempts`);
    },
    deleteAttempt(attemptId) {
        return request(`/attempts/${encodeURIComponent(attemptId)}`, { method: 'DELETE' });
    },
    patchSourceNode(sourceId, node_id) {
        return request(`/sources/${encodeURIComponent(sourceId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ node_id }),
        });
    },
    upsertSource(data) {
        return request('/sources', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    createAttempt(sourceId) {
        return request('/attempts', {
            method: 'POST',
            body: JSON.stringify({ source_id: sourceId }),
        });
    },
    saveAttempt(attemptId, data) {
        return request(`/attempts/${attemptId}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },
    /** Get the structured prompt text the user copies into their AI. */
    getCCPrompt(attemptId) {
        return request(`/attempts/${attemptId}/cc-prompt`);
    },
    /** Submit the JSON text the user pasted back from their AI. */
    pasteCCResult(attemptId, ccRaw) {
        return request(`/attempts/${attemptId}/paste-cc-result`, {
            method: 'POST',
            body: JSON.stringify({ cc_raw: ccRaw }),
        });
    },
    getAttempt(attemptId) {
        return request(`/attempts/${attemptId}`);
    },
    getHubNote(nodeId) {
        const q = new URLSearchParams();
        q.set('node_id', nodeId);
        return request(`/hub-notes?${q.toString()}`);
    },
    putHubNote(nodeId, body_md) {
        return request('/hub-notes', {
            method: 'PUT',
            body: JSON.stringify({ node_id: nodeId, body_md }),
        });
    },
};
