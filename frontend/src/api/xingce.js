// ── 数据类型 ─────────────────────────────────────────────────────────────────
// ── HTTP 工具 ────────────────────────────────────────────────────────────────
async function request(path, init) {
    const res = await fetch(path, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
        ...init,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
    }
    return res.json();
}
// ── ops → 快照重建 ───────────────────────────────────────────────────────────
function parsePayload(raw) {
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        }
        catch {
            return {};
        }
    }
    if (raw && typeof raw === 'object')
        return raw;
    return {};
}
export function opsToSnapshot(ops) {
    const errorsMap = new Map();
    const knowledgeMap = new Map();
    const notesByType = {};
    const noteImages = {};
    for (const op of ops) {
        const payload = parsePayload(op.payload);
        switch (op.op_type) {
            case 'error_upsert': {
                const id = String(payload.id || op.entity_id);
                errorsMap.set(id, { ...payload, id });
                break;
            }
            case 'error_delete':
                errorsMap.delete(String(op.entity_id));
                break;
            case 'knowledge_node_upsert': {
                const id = String(payload.id || op.entity_id);
                knowledgeMap.set(id, { ...payload, id });
                break;
            }
            case 'knowledge_node_delete':
                knowledgeMap.delete(String(op.entity_id));
                break;
            case 'note_type_upsert': {
                const key = String(payload.key || op.entity_id);
                notesByType[key] = payload.value ?? {};
                break;
            }
            case 'note_type_delete':
                delete notesByType[String(op.entity_id)];
                break;
            case 'note_image_upsert': {
                const key = String(payload.id || op.entity_id);
                noteImages[key] = String(payload.data ?? '');
                break;
            }
            case 'note_image_delete':
                delete noteImages[String(op.entity_id)];
                break;
        }
    }
    return {
        errors: [...errorsMap.values()],
        knowledgeNodes: [...knowledgeMap.values()],
        notesByType,
        noteImages,
    };
}
// ── API ──────────────────────────────────────────────────────────────────────
export const xingceApi = {
    /** 当前登录用户 */
    getMe() {
        return request('/api/me');
    },
    /** 登出（清 cookie） */
    logout() {
        return request('/api/auth/logout', { method: 'POST' });
    },
    /** 拉取全量 ops，重建本地快照 */
    async load() {
        const res = await request('/api/sync');
        return opsToSnapshot(res.ops);
    },
    /** 推送单条或多条 op（upsert/delete） */
    push(ops) {
        return request('/api/sync', {
            method: 'POST',
            body: JSON.stringify({ ops }),
        });
    },
    /** 最近练习记录时间线 */
    getPracticeAttempts(limit = 120) {
        return request(`/api/practice/attempts?limit=${limit}`);
    },
    /** 获取多条错题的练习摘要，返回 { items: { [errorId]: AttemptSummary } } */
    getAttemptSummaries(errorIds) {
        if (!errorIds.length)
            return Promise.resolve({ items: {} });
        const q = `error_ids=${encodeURIComponent(errorIds.join(','))}`;
        return request(`/api/practice/attempts/summary?${q}`);
    },
    /** 获取练习工作台数据（badge 计数、队列） */
    getWorkbench(limit = 6) {
        return request(`/api/practice/workbench?limit=${limit}`);
    },
    /** 获取今日练习队列 */
    getDaily(limit = 12) {
        return request(`/api/practice/daily?limit=${limit}`);
    },
    startTodaySession(limit = 30) {
        return request(`/api/practice/today/start?limit=${limit}`, { method: 'POST' });
    },
    getTodaySession() {
        return request('/api/practice/today/current');
    },
    pauseTodaySession(sessionId) {
        return request('/api/practice/today/pause', {
            method: 'POST',
            body: JSON.stringify({ sessionId }),
        });
    },
    answerTodaySession(sessionId, itemId, isCorrect) {
        return request('/api/practice/today/answer', {
            method: 'POST',
            body: JSON.stringify({ sessionId, itemId, isCorrect }),
        });
    },
    /** 学习统计 */
    getInsights(limit = 12) {
        return request(`/api/practice/insights?limit=${limit}`);
    },
    /** 云端全量读取 */
    getCloudBackup() {
        return request('/api/backup');
    },
    /** 云端全量写入 */
    putCloudBackup(payload) {
        return request('/api/backup', {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
    },
    /** 本地备份列表 */
    listLocalBackups() {
        return request('/api/local-backups');
    },
    /** 创建本地备份 */
    createLocalBackup(payload) {
        return request('/api/local-backups/create', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },
    /** 恢复本地备份 */
    restoreLocalBackup(backupId, createSafetyBackup = true) {
        return request('/api/local-backups/restore', {
            method: 'POST',
            body: JSON.stringify({ backupId, createSafetyBackup }),
        });
    },
    /** 删除本地备份 */
    deleteLocalBackup(backupId) {
        return request(`/api/local-backups/${encodeURIComponent(backupId)}`, {
            method: 'DELETE',
        });
    },
    /** 记录一次练习结果 */
    logAttempt(data) {
        return request('/api/practice/log', {
            method: 'POST',
            body: JSON.stringify({
                error_id: data.errorId,
                correct: data.correct,
                duration_sec: data.durationSec,
            }),
        });
    },
};
