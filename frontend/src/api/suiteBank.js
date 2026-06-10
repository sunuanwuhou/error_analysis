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
export const suiteBankApi = {
    async listPapers() {
        const data = await getJson('/api/suite-bank/papers');
        return data.papers ?? [];
    },
    async getPaper(paperId) {
        return getJson(`/api/suite-bank/papers/${encodeURIComponent(paperId)}`);
    },
    async search(q, limit = 80) {
        const data = await getJson(`/api/suite-bank/search?q=${encodeURIComponent(q)}&limit=${limit}`);
        return { items: data.items ?? [], papers: data.papers ?? [] };
    },
    async appendPracticeRecord(body) {
        return postJson('/api/suite-bank/practice-records', body);
    },
    async listPracticeRecords(limit = 50, paperId) {
        const q = new URLSearchParams({ limit: String(limit) });
        if (paperId)
            q.set('paper_id', paperId);
        const data = await getJson(`/api/suite-bank/practice-records?${q.toString()}`);
        return data.records ?? [];
    },
};
