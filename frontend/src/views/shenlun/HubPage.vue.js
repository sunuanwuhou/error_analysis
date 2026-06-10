/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ShenlunHubNotesEditor from '@/components/shenlun/ShenlunHubNotesEditor.vue';
import { shenlunApi } from '@/api/shenlun';
import { SL_TREE, shenlunNodeTitle, routeQueryToNodeId, nodeIdToRouteQuery, SL_UNCATEGORIZED_ROUTE, } from '@/data/shenlunTree';
import { savePortalLastModule } from '@/lib/portalPrefs';
const route = useRoute();
const router = useRouter();
const selectedNodeId = computed(() => routeQueryToNodeId(route.query.node));
const items = ref([]);
const listLoading = ref(false);
const listError = ref(null);
const searchQuery = ref('');
const deletingId = ref(null);
let searchDebounce = null;
const hubMainSection = ref('topics');
const notesEditorMounted = ref(false);
const NOTES_LS_PREFIX = 'shenlun:hubNotes:v1:';
function notesStorageKey(nodeId) {
    return NOTES_LS_PREFIX + (nodeId === '' ? '_uncategorized_' : nodeId);
}
/** 知识点笔记 Markdown（与 hubNotesMd 同步；以服务器为准并写回本地作缓存） */
const hubNotesMd = ref('');
let hubNotesNavChain = Promise.resolve();
const skipHubNotesPersist = ref(false);
const hubNotesCloud = ref({
    status: 'idle',
});
let persistHubNotesTimer = null;
const PERSIST_DEBOUNCE_MS = 560;
/** 服务器返回的上一版保存时间（ISO），用于向用户展示「确实已写入云端」 */
const hubNotesLastServerAt = ref('');
/** 防抖等待中：已编辑但尚未发起 PUT */
const hubNotesDebounceActive = ref(false);
function applyHubNoteSavedMeta(r) {
    const u = (r.updated_at ?? '').trim();
    if (u)
        hubNotesLastServerAt.value = u;
}
function formatHubSavedAt(iso) {
    const s = iso.trim();
    if (!s)
        return '';
    const d = new Date(s);
    if (Number.isNaN(d.getTime()))
        return '';
    return d.toLocaleString('zh-CN', { hour12: false });
}
const hubNotesBadgeText = computed(() => {
    const st = hubNotesCloud.value.status;
    if (st === 'idle' || st === 'loading')
        return '正在加载笔记本…';
    if (st === 'error')
        return '云端保存失败';
    if (st === 'saving')
        return '正在保存到云端…';
    if (st === 'synced' && hubNotesDebounceActive.value)
        return '有改动：将自动保存';
    if (st === 'synced')
        return '已保存到云端（账号）';
    return '申论笔记';
});
const hubNotesBadgeClass = computed(() => {
    const st = hubNotesCloud.value.status;
    return {
        'hub-notes-badge': true,
        'hub-notes-badge--loading': st === 'idle' || st === 'loading',
        'hub-notes-badge--saving': st === 'saving',
        'hub-notes-badge--error': st === 'error',
        'hub-notes-badge--pending': st === 'synced' && hubNotesDebounceActive.value,
        'hub-notes-badge--ok': st === 'synced' && !hubNotesDebounceActive.value,
    };
});
const hubNotesSubHint = computed(() => {
    const st = hubNotesCloud.value.status;
    if (st === 'error') {
        return (hubNotesCloud.value.detail ||
            '请检查网络后点「重试保存」，或重新登录后再试。');
    }
    if (st === 'idle' || st === 'loading') {
        return '正在连接服务器并读取当前知识点的笔记本…';
    }
    if (st === 'saving') {
        return '正在向服务器写入，请稍候…';
    }
    const saved = formatHubSavedAt(hubNotesLastServerAt.value);
    if (st === 'synced' && saved) {
        return `云端记录时间：${saved}（换设备登录同一账号可继续编辑）`;
    }
    if (st === 'synced') {
        return '编辑后约 1 秒内自动上传；切换知识点、切走标签或关闭页面前也会再保存一次。';
    }
    return '';
});
/** 「笔记」标签上的小点：有未上传改动 / 正在保存 / 失败时提醒 */
const hubNotesTabMarkerClass = computed(() => {
    const st = hubNotesCloud.value.status;
    if (st === 'error')
        return 'hub-tab-marker hub-tab-marker--error';
    if (st === 'saving' || (st === 'synced' && hubNotesDebounceActive.value)) {
        return 'hub-tab-marker hub-tab-marker--pending';
    }
    return '';
});
function flushHubNotesToNode(nodeId) {
    try {
        localStorage.setItem(notesStorageKey(nodeId), hubNotesMd.value);
    }
    catch {
        /* storage full or disabled */
    }
}
function clearHubNotesPersistTimer() {
    if (persistHubNotesTimer !== null) {
        window.clearTimeout(persistHubNotesTimer);
        persistHubNotesTimer = null;
    }
    hubNotesDebounceActive.value = false;
}
function applyHubNotesFromRemote(md) {
    skipHubNotesPersist.value = true;
    hubNotesMd.value = md;
    queueMicrotask(() => {
        skipHubNotesPersist.value = false;
    });
}
async function persistHubNotesToServerNow(nodeId) {
    flushHubNotesToNode(nodeId);
    hubNotesCloud.value = { status: 'saving' };
    try {
        const r = await shenlunApi.putHubNote(nodeId, hubNotesMd.value);
        applyHubNoteSavedMeta(r);
        hubNotesCloud.value = { status: 'synced' };
    }
    catch (e) {
        hubNotesCloud.value = { status: 'error', detail: e.message };
    }
}
function scheduleHubNotesPersist() {
    if (skipHubNotesPersist.value)
        return;
    const nid = selectedNodeId.value;
    clearHubNotesPersistTimer();
    hubNotesDebounceActive.value = true;
    persistHubNotesTimer = window.setTimeout(() => {
        persistHubNotesTimer = null;
        hubNotesDebounceActive.value = false;
        void (async () => {
            flushHubNotesToNode(nid);
            hubNotesCloud.value = { status: 'saving' };
            try {
                const r = await shenlunApi.putHubNote(nid, hubNotesMd.value);
                applyHubNoteSavedMeta(r);
                hubNotesCloud.value = { status: 'synced' };
            }
            catch (err) {
                hubNotesCloud.value = { status: 'error', detail: err.message };
            }
        })();
    }, PERSIST_DEBOUNCE_MS);
}
watch(() => selectedNodeId.value, (id, prev) => {
    hubNotesNavChain = hubNotesNavChain
        .then(async () => {
        clearHubNotesPersistTimer();
        if (prev !== undefined) {
            await persistHubNotesToServerNow(prev);
        }
        hubNotesCloud.value = { status: 'loading' };
        hubNotesLastServerAt.value = '';
        try {
            const remote = await shenlunApi.getHubNote(id);
            applyHubNoteSavedMeta(remote);
            let md = remote.body_md ?? '';
            if (!md.trim()) {
                try {
                    const legacy = localStorage.getItem(notesStorageKey(id)) ?? '';
                    if (legacy.trim()) {
                        md = legacy;
                        const up = await shenlunApi.putHubNote(id, md);
                        applyHubNoteSavedMeta(up);
                    }
                }
                catch {
                    /* ignore migration upload errors */
                }
            }
            applyHubNotesFromRemote(md);
            await nextTick();
            flushHubNotesToNode(id);
            hubNotesCloud.value = { status: 'synced' };
        }
        catch (e) {
            hubNotesCloud.value = { status: 'error', detail: e.message };
            try {
                applyHubNotesFromRemote(localStorage.getItem(notesStorageKey(id)) ?? '');
            }
            catch {
                applyHubNotesFromRemote('');
            }
        }
    })
        .catch(() => { });
}, { immediate: true });
watch(hubNotesMd, () => {
    scheduleHubNotesPersist();
}, { flush: 'sync' });
async function retryHubNotesSave() {
    const nid = selectedNodeId.value;
    hubNotesCloud.value = { status: 'saving' };
    flushHubNotesToNode(nid);
    try {
        const r = await shenlunApi.putHubNote(nid, hubNotesMd.value);
        applyHubNoteSavedMeta(r);
        hubNotesCloud.value = { status: 'synced' };
    }
    catch (e) {
        hubNotesCloud.value = { status: 'error', detail: e.message };
    }
}
function flushHubNotesBestEffort() {
    clearHubNotesPersistTimer();
    const nid = selectedNodeId.value;
    flushHubNotesToNode(nid);
    void shenlunApi
        .putHubNote(nid, hubNotesMd.value)
        .then((r) => {
        applyHubNoteSavedMeta(r);
        hubNotesCloud.value = { status: 'synced' };
    })
        .catch(() => { });
}
function onVisibilityFlush() {
    if (document.visibilityState === 'hidden')
        flushHubNotesBestEffort();
}
onMounted(() => {
    savePortalLastModule('shenlun');
    document.addEventListener('visibilitychange', onVisibilityFlush);
});
onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibilityFlush);
    clearHubNotesPersistTimer();
    flushHubNotesToNode(selectedNodeId.value);
    void shenlunApi
        .putHubNote(selectedNodeId.value, hubNotesMd.value)
        .then((r) => applyHubNoteSavedMeta(r))
        .catch(() => { });
});
const copyBlinkId = ref(null);
function sourceCopyPack(row) {
    const material = row.material_text_raw?.trim?.() ?? '';
    const question = row.question_text_raw?.trim?.() ?? '';
    const mBlock = material || '（暂无材料正文）';
    const qBlock = question || '（暂无题干）';
    return `【材料】\n${mBlock}\n\n【题目】\n${qBlock}`;
}
async function copySourceProblem(row, ev) {
    ev?.preventDefault();
    ev?.stopPropagation();
    const text = sourceCopyPack(row);
    try {
        await navigator.clipboard.writeText(text);
        copyBlinkId.value = row.id;
        setTimeout(() => {
            if (copyBlinkId.value === row.id)
                copyBlinkId.value = null;
        }, 1600);
    }
    catch {
        window.prompt('可复制以下内容（Ctrl+C）：', text);
    }
}
watch(hubMainSection, (s) => {
    if (s === 'notes')
        notesEditorMounted.value = true;
});
const expanded = ref(new Set(SL_TREE.map((n) => n.id)));
async function loadList() {
    listLoading.value = true;
    listError.value = null;
    try {
        const res = await shenlunApi.listSources(selectedNodeId.value, searchQuery.value);
        items.value = res.items;
    }
    catch (e) {
        listError.value = e.message;
        items.value = [];
    }
    finally {
        listLoading.value = false;
    }
}
watch(() => selectedNodeId.value, () => void loadList(), { immediate: true });
watch(searchQuery, () => {
    if (searchDebounce)
        window.clearTimeout(searchDebounce);
    searchDebounce = window.setTimeout(() => void loadList(), 280);
});
function paperMetaLine(row) {
    const ys = [row.paper_year, row.paper_province, row.paper_suite_type]
        .map((s) => (s ?? '').trim())
        .filter(Boolean);
    return ys.join(' · ') || '';
}
async function confirmDelete(row, ev) {
    ev.stopPropagation();
    const ok = window.confirm(`确定删除这条题目记录？删除后不可恢复。\n「${previewRowForConfirm(row)}」`);
    if (!ok)
        return;
    deletingId.value = row.id;
    try {
        await shenlunApi.deleteSource(row.id);
        await loadList();
    }
    catch {
        alert('删除失败');
    }
    finally {
        deletingId.value = null;
    }
}
function toggleExpand(id) {
    const next = new Set(expanded.value);
    if (next.has(id))
        next.delete(id);
    else
        next.add(id);
    expanded.value = next;
}
function pickUncategorized() {
    void router.replace({ name: 'ShenlunHub', query: { node: SL_UNCATEGORIZED_ROUTE } });
}
function pickNode(id) {
    void router.replace({ name: 'ShenlunHub', query: { node: nodeIdToRouteQuery(id) } });
}
function goNewPractice() {
    void router.push({
        name: 'ShenlunWorkbench',
        query: { node: nodeIdToRouteQuery(selectedNodeId.value) },
    });
}
function openSource(row) {
    void router.push({
        name: 'ShenlunWorkbench',
        query: {
            node: nodeIdToRouteQuery(row.node_id || selectedNodeId.value),
            source: row.id,
        },
    });
}
function collapseLine(s) {
    return s.trim().replace(/\s+/g, ' ');
}
/** 题干优先；题干为空则展示材料（避免「明明材料命中却只能看到无题干」） */
function previewRowLead(row) {
    const q = collapseLine(row.question_text_raw ?? '');
    if (q)
        return q.length > 96 ? `${q.slice(0, 96)}…` : q;
    const rawMat = row.material_text_raw ?? '';
    const mat = collapseLine(rawMat);
    if (!mat)
        return '（无题干）';
    const needleRaw = collapseLine(searchQuery.value);
    if (needleRaw.length > 0) {
        const li = rawMat.toLowerCase().indexOf(needleRaw.toLowerCase());
        if (li !== -1) {
            const start = Math.max(0, li - 28);
            const end = Math.min(rawMat.length, li + needleRaw.length + 64);
            const frag = collapseLine(rawMat.slice(start, end));
            return `[材料命中] ${start ? '…' : ''}${frag}${end < rawMat.length ? '…' : ''}`;
        }
    }
    const excerpt = mat.length > 92 ? `${mat.slice(0, 92)}…` : mat;
    return `[材料预览] ${excerpt}`;
}
function previewRowForConfirm(row) {
    const q = collapseLine(row.question_text_raw ?? '');
    if (q)
        return q.length > 120 ? `${q.slice(0, 120)}…` : q;
    const mat = collapseLine(row.material_text_raw ?? '');
    if (mat)
        return mat.length > 120 ? `${mat.slice(0, 120)}…` : mat;
    return '（无题干）';
}
function statusLabel(row) {
    const latest = row.latest_cc_status;
    const okN = row.cc_success_count ?? 0;
    const ac = row.attempt_count ?? 0;
    if (latest === 'success') {
        return ac > 1 ? `已复盘 · ${ac} 轮练习` : '已复盘';
    }
    if (okN > 0) {
        return `本轮进行中 · 已成功复盘 ${okN} 次`;
    }
    if (row.status === 'raw_draft')
        return '草稿';
    if (row.status === 'formatted')
        return '提炼中';
    if (row.status === 'extracted')
        return '已提炼';
    if (row.status === 'cc_done')
        return '已复盘';
    return row.status;
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['hub-module-hero-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-module-hero-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-link-accent']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-nav-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-module-hero-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-link-accent']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-uncat']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-tree-node']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-tree-label--leaf']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-tree-label--leaf']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-notes-retry']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-search']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-row-del']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-row-del']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-row-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-main-head']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hub-page" },
});
/** @type {__VLS_StyleScopedClasses['hub-page']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "hub-header" },
});
/** @type {__VLS_StyleScopedClasses['hub-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({
    ...{ class: "hub-title" },
});
/** @type {__VLS_StyleScopedClasses['hub-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "hub-sub" },
});
/** @type {__VLS_StyleScopedClasses['hub-sub']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "hub-nav hub-nav-wrap" },
});
/** @type {__VLS_StyleScopedClasses['hub-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-nav-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    href: "/new/?portal=1",
    ...{ class: "hub-module-hero-btn" },
});
/** @type {__VLS_StyleScopedClasses['hub-module-hero-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "hmh-main" },
});
/** @type {__VLS_StyleScopedClasses['hmh-main']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "hmh-sub" },
});
/** @type {__VLS_StyleScopedClasses['hmh-sub']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.routerLink | typeof __VLS_components.RouterLink | typeof __VLS_components['router-link'] | typeof __VLS_components.routerLink | typeof __VLS_components.RouterLink | typeof __VLS_components['router-link']} */
routerLink;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    to: ({ name: 'XingceWorkspace' }),
    ...{ class: "hub-link hub-link-accent" },
}));
const __VLS_2 = __VLS_1({
    to: ({ name: 'XingceWorkspace' }),
    ...{ class: "hub-link hub-link-accent" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['hub-link']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-link-accent']} */ ;
const { default: __VLS_5 } = __VLS_3.slots;
var __VLS_3;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hub-shell" },
});
/** @type {__VLS_StyleScopedClasses['hub-shell']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
    ...{ class: "hub-side" },
});
/** @type {__VLS_StyleScopedClasses['hub-side']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hub-side-head" },
});
/** @type {__VLS_StyleScopedClasses['hub-side-head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.pickUncategorized) },
    type: "button",
    ...{ class: "hub-uncat" },
    ...{ class: ({ active: __VLS_ctx.selectedNodeId === '' }) },
});
/** @type {__VLS_StyleScopedClasses['hub-uncat']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hub-tree" },
});
/** @type {__VLS_StyleScopedClasses['hub-tree']} */ ;
for (const [n] of __VLS_vFor((__VLS_ctx.SL_TREE))) {
    __VLS_asFunctionalElement(__VLS_intrinsics.template)({
        key: (n.id),
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "hub-tree-node" },
    });
    /** @type {__VLS_StyleScopedClasses['hub-tree-node']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "hub-tree-row" },
    });
    /** @type {__VLS_StyleScopedClasses['hub-tree-row']} */ ;
    if (n.children?.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(n.children?.length))
                        return;
                    __VLS_ctx.toggleExpand(n.id);
                    // @ts-ignore
                    [pickUncategorized, selectedNodeId, SL_TREE, toggleExpand,];
                } },
            type: "button",
            ...{ class: "hub-tree-chevron" },
        });
        /** @type {__VLS_StyleScopedClasses['hub-tree-chevron']} */ ;
        (__VLS_ctx.expanded.has(n.id) ? '▾' : '▸');
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
            ...{ class: "hub-tree-chevron hub-tree-chevron--ghost" },
        });
        /** @type {__VLS_StyleScopedClasses['hub-tree-chevron']} */ ;
        /** @type {__VLS_StyleScopedClasses['hub-tree-chevron--ghost']} */ ;
    }
    if (n.children?.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "hub-tree-label hub-tree-label--group" },
        });
        /** @type {__VLS_StyleScopedClasses['hub-tree-label']} */ ;
        /** @type {__VLS_StyleScopedClasses['hub-tree-label--group']} */ ;
        (n.title);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(n.children?.length))
                        return;
                    __VLS_ctx.pickNode(n.id);
                    // @ts-ignore
                    [expanded, pickNode,];
                } },
            type: "button",
            ...{ class: "hub-tree-label hub-tree-label--leaf" },
            ...{ class: ({ active: __VLS_ctx.selectedNodeId === n.id }) },
        });
        /** @type {__VLS_StyleScopedClasses['hub-tree-label']} */ ;
        /** @type {__VLS_StyleScopedClasses['hub-tree-label--leaf']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        (n.title);
    }
    if (n.children?.length && __VLS_ctx.expanded.has(n.id)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "hub-tree-children" },
        });
        /** @type {__VLS_StyleScopedClasses['hub-tree-children']} */ ;
        for (const [c] of __VLS_vFor((n.children))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (c.id),
                ...{ class: "hub-tree-row hub-tree-row--child" },
            });
            /** @type {__VLS_StyleScopedClasses['hub-tree-row']} */ ;
            /** @type {__VLS_StyleScopedClasses['hub-tree-row--child']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                ...{ class: "hub-tree-chevron hub-tree-chevron--ghost" },
            });
            /** @type {__VLS_StyleScopedClasses['hub-tree-chevron']} */ ;
            /** @type {__VLS_StyleScopedClasses['hub-tree-chevron--ghost']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(n.children?.length && __VLS_ctx.expanded.has(n.id)))
                            return;
                        __VLS_ctx.pickNode(c.id);
                        // @ts-ignore
                        [selectedNodeId, expanded, pickNode,];
                    } },
                type: "button",
                ...{ class: "hub-tree-label hub-tree-label--leaf" },
                ...{ class: ({ active: __VLS_ctx.selectedNodeId === c.id }) },
            });
            /** @type {__VLS_StyleScopedClasses['hub-tree-label']} */ ;
            /** @type {__VLS_StyleScopedClasses['hub-tree-label--leaf']} */ ;
            /** @type {__VLS_StyleScopedClasses['active']} */ ;
            (c.title);
            // @ts-ignore
            [selectedNodeId,];
        }
    }
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({
    ...{ class: "hub-main" },
});
/** @type {__VLS_StyleScopedClasses['hub-main']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hub-main-head" },
});
/** @type {__VLS_StyleScopedClasses['hub-main-head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "hub-node-path" },
});
/** @type {__VLS_StyleScopedClasses['hub-node-path']} */ ;
(__VLS_ctx.shenlunNodeTitle(__VLS_ctx.selectedNodeId));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.goNewPractice) },
    type: "button",
    ...{ class: "btn btn-primary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hub-seg-tabs" },
    role: "tablist",
});
/** @type {__VLS_StyleScopedClasses['hub-seg-tabs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.hubMainSection = 'topics';
            // @ts-ignore
            [selectedNodeId, shenlunNodeTitle, goNewPractice, hubMainSection,];
        } },
    type: "button",
    ...{ class: "hub-tab" },
    ...{ class: ({ active: __VLS_ctx.hubMainSection === 'topics' }) },
    role: "tab",
    'aria-selected': (__VLS_ctx.hubMainSection === 'topics'),
});
/** @type {__VLS_StyleScopedClasses['hub-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.hubMainSection = 'notes';
            // @ts-ignore
            [hubMainSection, hubMainSection, hubMainSection,];
        } },
    type: "button",
    ...{ class: "hub-tab hub-tab--with-marker" },
    ...{ class: ({ active: __VLS_ctx.hubMainSection === 'notes' }) },
    role: "tab",
    'aria-selected': (__VLS_ctx.hubMainSection === 'notes'),
});
/** @type {__VLS_StyleScopedClasses['hub-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['hub-tab--with-marker']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
if (__VLS_ctx.hubNotesTabMarkerClass) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "hub-tab-marker-wrap" },
        title: "笔记本同步状态提醒",
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['hub-tab-marker-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "hub-tab-marker-ring" },
    });
    /** @type {__VLS_StyleScopedClasses['hub-tab-marker-ring']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
        ...{ class: (__VLS_ctx.hubNotesTabMarkerClass) },
    });
}
if (__VLS_ctx.hubMainSection === 'topics') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "hub-toolbar" },
    });
    /** @type {__VLS_StyleScopedClasses['hub-toolbar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "search",
        ...{ class: "hub-search" },
        placeholder: "搜索题干、材料或套卷信息…",
        enterkeyhint: "search",
    });
    (__VLS_ctx.searchQuery);
    /** @type {__VLS_StyleScopedClasses['hub-search']} */ ;
    if (__VLS_ctx.listLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "hub-muted" },
        });
        /** @type {__VLS_StyleScopedClasses['hub-muted']} */ ;
    }
    else if (__VLS_ctx.listError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "hub-error" },
        });
        /** @type {__VLS_StyleScopedClasses['hub-error']} */ ;
        (__VLS_ctx.listError);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "hub-list" },
        });
        /** @type {__VLS_StyleScopedClasses['hub-list']} */ ;
        if (!__VLS_ctx.items.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                ...{ class: "hub-empty" },
            });
            /** @type {__VLS_StyleScopedClasses['hub-empty']} */ ;
        }
        for (const [row] of __VLS_vFor((__VLS_ctx.items))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.hubMainSection === 'topics'))
                            return;
                        if (!!(__VLS_ctx.listLoading))
                            return;
                        if (!!(__VLS_ctx.listError))
                            return;
                        __VLS_ctx.openSource(row);
                        // @ts-ignore
                        [hubMainSection, hubMainSection, hubMainSection, hubNotesTabMarkerClass, hubNotesTabMarkerClass, searchQuery, listLoading, listError, listError, items, items, openSource,];
                    } },
                key: (row.id),
                ...{ class: "hub-row" },
            });
            /** @type {__VLS_StyleScopedClasses['hub-row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "hub-row-main" },
            });
            /** @type {__VLS_StyleScopedClasses['hub-row-main']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "hub-row-title" },
            });
            /** @type {__VLS_StyleScopedClasses['hub-row-title']} */ ;
            (__VLS_ctx.previewRowLead(row));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "hub-row-meta" },
            });
            /** @type {__VLS_StyleScopedClasses['hub-row-meta']} */ ;
            if (__VLS_ctx.paperMetaLine(row)) {
                (__VLS_ctx.paperMetaLine(row));
            }
            (__VLS_ctx.statusLabel(row));
            (row.attempt_count);
            (new Date(row.updated_at).toLocaleString('zh-CN', { hour12: false }));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "hub-row-actions" },
            });
            /** @type {__VLS_StyleScopedClasses['hub-row-actions']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.hubMainSection === 'topics'))
                            return;
                        if (!!(__VLS_ctx.listLoading))
                            return;
                        if (!!(__VLS_ctx.listError))
                            return;
                        __VLS_ctx.confirmDelete(row, $event);
                        // @ts-ignore
                        [previewRowLead, paperMetaLine, paperMetaLine, statusLabel, confirmDelete,];
                    } },
                type: "button",
                ...{ class: "hub-row-del" },
                disabled: (__VLS_ctx.deletingId === row.id),
            });
            /** @type {__VLS_StyleScopedClasses['hub-row-del']} */ ;
            (__VLS_ctx.deletingId === row.id ? '…' : '删除');
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.hubMainSection === 'topics'))
                            return;
                        if (!!(__VLS_ctx.listLoading))
                            return;
                        if (!!(__VLS_ctx.listError))
                            return;
                        __VLS_ctx.copySourceProblem(row, $event);
                        // @ts-ignore
                        [deletingId, deletingId, copySourceProblem,];
                    } },
                type: "button",
                ...{ class: "hub-row-copy" },
            });
            /** @type {__VLS_StyleScopedClasses['hub-row-copy']} */ ;
            (__VLS_ctx.copyBlinkId === row.id ? '已复制' : '复制题目');
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "hub-row-go" },
            });
            /** @type {__VLS_StyleScopedClasses['hub-row-go']} */ ;
            // @ts-ignore
            [copyBlinkId,];
        }
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hub-notes-pane" },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.hubMainSection === 'notes') }, null, null);
/** @type {__VLS_StyleScopedClasses['hub-notes-pane']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hub-notes-savebar" },
    role: "status",
    'aria-live': "polite",
    'aria-atomic': "true",
});
/** @type {__VLS_StyleScopedClasses['hub-notes-savebar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hub-notes-savebar-top" },
});
/** @type {__VLS_StyleScopedClasses['hub-notes-savebar-top']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: (__VLS_ctx.hubNotesBadgeClass) },
});
(__VLS_ctx.hubNotesBadgeText);
if (__VLS_ctx.hubNotesCloud.status === 'error') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.retryHubNotesSave) },
        type: "button",
        ...{ class: "hub-notes-retry" },
    });
    /** @type {__VLS_StyleScopedClasses['hub-notes-retry']} */ ;
}
if (__VLS_ctx.hubNotesSubHint) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "hub-notes-savebar-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['hub-notes-savebar-sub']} */ ;
    (__VLS_ctx.hubNotesSubHint);
}
if (__VLS_ctx.notesEditorMounted) {
    const __VLS_6 = ShenlunHubNotesEditor;
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
        modelValue: (__VLS_ctx.hubNotesMd),
    }));
    const __VLS_8 = __VLS_7({
        modelValue: (__VLS_ctx.hubNotesMd),
    }, ...__VLS_functionalComponentArgsRest(__VLS_7));
}
// @ts-ignore
[hubMainSection, hubNotesBadgeClass, hubNotesBadgeText, hubNotesCloud, retryHubNotesSave, hubNotesSubHint, hubNotesSubHint, notesEditorMounted, hubNotesMd,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
