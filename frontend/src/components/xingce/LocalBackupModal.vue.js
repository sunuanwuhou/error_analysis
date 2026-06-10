/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { onMounted, ref } from 'vue';
import { xingceApi } from '@/api/xingce';
import { useXingceStore } from '@/stores/xingceStore';
const emit = defineEmits();
const store = useXingceStore();
const loading = ref(false);
const creating = ref(false);
const items = ref([]);
const err = ref('');
async function loadItems() {
    loading.value = true;
    err.value = '';
    try {
        const res = await xingceApi.listLocalBackups();
        items.value = res.items ?? [];
    }
    catch (e) {
        err.value = String(e);
    }
    finally {
        loading.value = false;
    }
}
async function createBackup() {
    creating.value = true;
    try {
        await xingceApi.createLocalBackup({ kind: 'manual', label: '手动备份' });
        await loadItems();
    }
    finally {
        creating.value = false;
    }
}
async function restoreBackup(item) {
    if (!confirm(`恢复备份 ${item.label || item.id}？`))
        return;
    await xingceApi.restoreLocalBackup(item.id, true);
    await store.load();
    emit('close');
}
async function removeBackup(item) {
    if (!confirm(`删除备份 ${item.label || item.id}？`))
        return;
    await xingceApi.deleteLocalBackup(item.id);
    await loadItems();
}
function downloadBackup(item) {
    const a = document.createElement('a');
    a.href = `/api/local-backups/${encodeURIComponent(item.id)}/download`;
    a.target = '_blank';
    a.rel = 'noopener';
    a.click();
}
function fmtTime(t) {
    if (!t)
        return '-';
    return t.replace('T', ' ').slice(0, 16);
}
onMounted(loadItems);
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
/** @type {__VLS_StyleScopedClasses['lb-btn']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    to: "body",
}));
const __VLS_2 = __VLS_1({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
const { default: __VLS_5 } = __VLS_3.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('close');
            // @ts-ignore
            [emit,];
        } },
    ...{ class: "lb-backdrop" },
});
/** @type {__VLS_StyleScopedClasses['lb-backdrop']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "lb-modal" },
});
/** @type {__VLS_StyleScopedClasses['lb-modal']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "lb-header" },
});
/** @type {__VLS_StyleScopedClasses['lb-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "lb-header-actions" },
});
/** @type {__VLS_StyleScopedClasses['lb-header-actions']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.createBackup) },
    ...{ class: "lb-create" },
    disabled: (__VLS_ctx.creating),
});
/** @type {__VLS_StyleScopedClasses['lb-create']} */ ;
(__VLS_ctx.creating ? '创建中…' : '创建备份');
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('close');
            // @ts-ignore
            [emit, createBackup, creating, creating,];
        } },
    ...{ class: "lb-close" },
});
/** @type {__VLS_StyleScopedClasses['lb-close']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "lb-body" },
});
/** @type {__VLS_StyleScopedClasses['lb-body']} */ ;
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "lb-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['lb-empty']} */ ;
}
else if (__VLS_ctx.err) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "lb-empty lb-err" },
    });
    /** @type {__VLS_StyleScopedClasses['lb-empty']} */ ;
    /** @type {__VLS_StyleScopedClasses['lb-err']} */ ;
    (__VLS_ctx.err);
}
else if (!__VLS_ctx.items.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "lb-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['lb-empty']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "lb-list" },
    });
    /** @type {__VLS_StyleScopedClasses['lb-list']} */ ;
    for (const [it] of __VLS_vFor((__VLS_ctx.items))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (it.id),
            ...{ class: "lb-item" },
        });
        /** @type {__VLS_StyleScopedClasses['lb-item']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "lb-main" },
        });
        /** @type {__VLS_StyleScopedClasses['lb-main']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "lb-title" },
        });
        /** @type {__VLS_StyleScopedClasses['lb-title']} */ ;
        (it.label || it.kind || '备份');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "lb-meta" },
        });
        /** @type {__VLS_StyleScopedClasses['lb-meta']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (it.id);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.fmtTime(it.updatedAt || it.createdAt));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (it.summary?.errorCount ?? '-');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "lb-actions" },
        });
        /** @type {__VLS_StyleScopedClasses['lb-actions']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.err))
                        return;
                    if (!!(!__VLS_ctx.items.length))
                        return;
                    __VLS_ctx.downloadBackup(it);
                    // @ts-ignore
                    [loading, err, err, items, items, fmtTime, downloadBackup,];
                } },
            ...{ class: "lb-btn" },
        });
        /** @type {__VLS_StyleScopedClasses['lb-btn']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.err))
                        return;
                    if (!!(!__VLS_ctx.items.length))
                        return;
                    __VLS_ctx.restoreBackup(it);
                    // @ts-ignore
                    [restoreBackup,];
                } },
            ...{ class: "lb-btn" },
        });
        /** @type {__VLS_StyleScopedClasses['lb-btn']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.err))
                        return;
                    if (!!(!__VLS_ctx.items.length))
                        return;
                    __VLS_ctx.removeBackup(it);
                    // @ts-ignore
                    [removeBackup,];
                } },
            ...{ class: "lb-btn danger" },
        });
        /** @type {__VLS_StyleScopedClasses['lb-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['danger']} */ ;
        // @ts-ignore
        [];
    }
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
