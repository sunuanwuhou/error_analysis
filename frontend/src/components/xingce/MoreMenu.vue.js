/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { useXingceStore } from '@/stores/xingceStore';
import { xingceApi } from '@/api/xingce';
import LocalBackupModal from './LocalBackupModal.vue';
import DashboardModal from './DashboardModal.vue';
const emit = defineEmits();
const store = useXingceStore();
const open = ref(false);
const btnRef = ref(null);
const menuRef = ref(null);
function toggle() { open.value = !open.value; }
function closeOnOutside(e) {
    if (!open.value)
        return;
    if (!btnRef.value?.contains(e.target) && !menuRef.value?.contains(e.target)) {
        open.value = false;
    }
}
onMounted(() => document.addEventListener('mousedown', closeOnOutside));
onBeforeUnmount(() => document.removeEventListener('mousedown', closeOnOutside));
// ── 功能 ──────────────────────────────────────────────────────────────────────
function exportJson() {
    open.value = false;
    const payload = {
        exportTime: new Date().toISOString(),
        version: '2',
        errors: store.errors,
        knowledgeNodes: store.knowledgeNodes,
    };
    const data = JSON.stringify(payload, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const day = new Date().toISOString().slice(0, 10);
    a.download = `xingce_backup_${day}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
function exportKnowledgeTreeSnapshot() {
    open.value = false;
    const rows = [];
    function walk(nodes, parentPath) {
        for (const node of nodes) {
            const pathTitles = [...parentPath, String(node.title || '')];
            rows.push({
                id: String(node.id || ''),
                parentId: node.parentId ? String(node.parentId) : '',
                level: Number(node.level || 0),
                title: String(node.title || ''),
                path: pathTitles.filter(Boolean).join(' > '),
            });
            const kids = node.children;
            if (kids?.length)
                walk(kids, pathTitles);
        }
    }
    walk(store.knowledgeTree, []);
    const payload = {
        exportedAt: new Date().toISOString(),
        source: 'vue-xingce-workspace',
        rootCount: store.knowledgeTree.length,
        nodeCount: rows.length,
        roots: store.knowledgeTree.map(n => ({ id: n.id, title: n.title })),
        nodes: rows,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knowledge_tree_snapshot_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
async function cloudSave() {
    open.value = false;
    await store.flushSave();
    alert('已同步到云端');
}
function cloudLoad() {
    open.value = false;
    if (confirm('重新从云端加载数据？本地未保存的更改将丢失。')) {
        store.load();
    }
}
async function cloudFullSave() {
    open.value = false;
    const payload = {
        exportTime: new Date().toISOString(),
        errors: store.errors,
        knowledgeNodes: store.knowledgeNodes,
    };
    await xingceApi.putCloudBackup(payload);
    alert('云端全量备份完成');
}
async function cloudFullLoad() {
    open.value = false;
    if (!confirm('全量从云端同步会覆盖本地，继续吗？'))
        return;
    const data = await xingceApi.getCloudBackup();
    const backup = (data.backup ?? data.payload ?? {});
    const errors = backup.errors ?? [];
    const knowledgeNodes = backup.knowledgeNodes ?? backup.knowledge_nodes ?? [];
    if (!errors.length && !knowledgeNodes.length) {
        alert('云端暂无可用全量数据');
        return;
    }
    store.replaceWorkspaceSnapshot(errors, knowledgeNodes);
    await store.flushSave();
    await store.load();
    alert('云端全量已同步到本地');
}
function printList() {
    open.value = false;
    window.print();
}
const ccText = computed(() => {
    const list = store.filteredErrors.slice(0, 20);
    return list.map((e, i) => `${i + 1}. [${e.type}/${e.subtype}] ${String(e.question || '').slice(0, 80)}`).join('\n');
});
async function sendToCC() {
    open.value = false;
    const text = ccText.value || '暂无内容';
    try {
        await navigator.clipboard.writeText(text);
        alert('已复制到剪贴板，可直接发给 CC');
    }
    catch {
        alert(text);
    }
}
function clearCurrentModuleErrors() {
    open.value = false;
    const ids = store.filteredErrors.map(e => e.id);
    if (!ids.length)
        return;
    if (!confirm(`清空当前筛选内 ${ids.length} 条错题？`))
        return;
    store.clearErrorsByFilter(ids);
}
function clearAllErrors() {
    open.value = false;
    if (!confirm('清空全部错题？该操作不可恢复。'))
        return;
    store.clearAllErrors();
}
function resetAllStudyData() {
    open.value = false;
    if (!confirm('重置全部学习数据（状态/掌握度/练习轨迹）？'))
        return;
    store.resetAllStudyFields();
}
function openMarkdownNote() {
    open.value = false;
    emit('openMarkdownEditor');
}
const showStats = ref(false);
const showLocalBackups = ref(false);
function openStats() {
    open.value = false;
    showStats.value = true;
}
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['more-menu-advanced']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "btnRef",
    ...{ class: "more-menu" },
    ...{ class: ({ open: __VLS_ctx.open }) },
});
/** @type {__VLS_StyleScopedClasses['more-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['open']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.toggle) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "menuRef",
    ...{ class: "more-menu-panel" },
});
/** @type {__VLS_StyleScopedClasses['more-menu-panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (() => { __VLS_ctx.open = false; __VLS_ctx.emit('openImport'); }) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (() => { __VLS_ctx.open = false; __VLS_ctx.emit('randomNote'); }) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.exportJson) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.exportKnowledgeTreeSnapshot) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (() => { __VLS_ctx.open = false; __VLS_ctx.showLocalBackups = true; }) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.cloudFullSave) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.cloudFullLoad) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.sendToCC) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.openMarkdownNote) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (() => { __VLS_ctx.open = false; __VLS_ctx.emit('openHistory'); }) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (() => { __VLS_ctx.open = false; __VLS_ctx.emit('openTypeRules'); }) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.openStats) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.printList) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.details, __VLS_intrinsics.details)({
    ...{ class: "more-menu-advanced" },
});
/** @type {__VLS_StyleScopedClasses['more-menu-advanced']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.summary, __VLS_intrinsics.summary)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "more-menu-advanced-body" },
});
/** @type {__VLS_StyleScopedClasses['more-menu-advanced-body']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.clearCurrentModuleErrors) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.clearAllErrors) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.resetAllStudyData) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.cloudSave) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.cloudLoad) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
if (__VLS_ctx.showLocalBackups) {
    const __VLS_0 = LocalBackupModal;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onClose': {} },
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onClose': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.showLocalBackups))
                    return;
                __VLS_ctx.showLocalBackups = false;
                // @ts-ignore
                [open, open, open, open, open, open, toggle, emit, emit, emit, emit, exportJson, exportKnowledgeTreeSnapshot, showLocalBackups, showLocalBackups, showLocalBackups, cloudFullSave, cloudFullLoad, sendToCC, openMarkdownNote, openStats, printList, clearCurrentModuleErrors, clearAllErrors, resetAllStudyData, cloudSave, cloudLoad,];
            } });
    var __VLS_3;
    var __VLS_4;
}
if (__VLS_ctx.showStats) {
    const __VLS_7 = DashboardModal;
    // @ts-ignore
    const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
        ...{ 'onClose': {} },
    }));
    const __VLS_9 = __VLS_8({
        ...{ 'onClose': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_8));
    let __VLS_12;
    const __VLS_13 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.showStats))
                    return;
                __VLS_ctx.showStats = false;
                // @ts-ignore
                [showStats, showStats,];
            } });
    var __VLS_10;
    var __VLS_11;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
