async function getJson(path) {
    const res = await fetch(path, { credentials: 'include' });
    if (res.status === 401) {
        window.location.href = '/login.html';
        throw new Error('unauthorized');
    }
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    return res.json();
}
async function postJson(path, body) {
    const res = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (res.status === 401) {
        window.location.href = '/login.html';
        throw new Error('unauthorized');
    }
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    return res.json();
}
async function postEmptyJson(path) {
    const res = await fetch(path, {
        method: 'POST',
        credentials: 'include',
    });
    if (res.status === 401) {
        window.location.href = '/login.html';
        throw new Error('unauthorized');
    }
    if (!res.ok)
        throw new Error(`HTTP ${res.status}`);
    return res.json();
}
export const BANK_DRILL_PAPER_ID = '__bank_drill__';
export const bankDrillApi = {
    meta(examTrack, years) {
        const u = new URLSearchParams();
        u.set('exam_track', examTrack);
        for (const y of years)
            u.append('years', String(y));
        return getJson(`/api/suite-bank/bank-drill/meta?${u.toString()}`);
    },
    start(body) {
        return postJson('/api/suite-bank/bank-drill/start', body);
    },
    resetHistory() {
        return postEmptyJson('/api/suite-bank/bank-drill/history/reset');
    },
    async listExports(limit = 50) {
        const data = await getJson(`/api/suite-bank/bank-drill/exports?limit=${limit}`);
        return data.items ?? [];
    },
    exportPrintUrl(exportId) {
        return `/api/suite-bank/bank-drill/exports/${encodeURIComponent(exportId)}/print`;
    },
    async deleteExport(exportId) {
        const res = await fetch(`/api/suite-bank/bank-drill/exports/${encodeURIComponent(exportId)}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (res.status === 401) {
            window.location.href = '/login.html';
            throw new Error('unauthorized');
        }
        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);
        return res.json();
    },
};
