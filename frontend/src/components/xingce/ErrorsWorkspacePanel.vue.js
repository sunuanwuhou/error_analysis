/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed } from 'vue';
import { useXingceStore } from '@/stores/xingceStore';
import ErrorList from './ErrorList.vue';
const store = useXingceStore();
const batchMoveTarget = ref('');
const showBatchMoveModal = ref(false);
const emit = defineEmits();
function walkLeaves(nodes) {
    const out = [];
    for (const n of nodes) {
        const kids = (n.children ?? []);
        if (kids.length)
            out.push(...walkLeaves(kids));
        else
            out.push(n);
    }
    return out;
}
const batchMountLeaves = computed(() => walkLeaves(store.knowledgeTree));
function applyBatchMount() {
    if (!batchMoveTarget.value)
        return;
    store.batchApplyNoteNode(batchMoveTarget.value);
    batchMoveTarget.value = '';
}
function applyBatchMountFromModal() {
    applyBatchMount();
    showBatchMoveModal.value = false;
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "errors-area" },
});
/** @type {__VLS_StyleScopedClasses['errors-area']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "errors-header" },
});
/** @type {__VLS_StyleScopedClasses['errors-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "errors-header-actions" },
});
/** @type {__VLS_StyleScopedClasses['errors-header-actions']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "search-box" },
});
/** @type {__VLS_StyleScopedClasses['search-box']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "search-icon" },
});
/** @type {__VLS_StyleScopedClasses['search-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onKeydown: () => { } },
    type: "search",
    placeholder: "搜索题目、解析...",
});
(__VLS_ctx.store.searchQuery);
if (__VLS_ctx.store.searchQuery) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.store.searchQuery))
                    return;
                __VLS_ctx.store.searchQuery = '';
                // @ts-ignore
                [store, store, store,];
            } },
        type: "button",
        ...{ class: "search-clear" },
    });
    /** @type {__VLS_StyleScopedClasses['search-clear']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.store.toggleBatchMode();
            // @ts-ignore
            [store,];
        } },
    type: "button",
    ...{ class: (['btn', __VLS_ctx.store.batchMode ? 'btn-primary' : 'btn-secondary']) },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
(__VLS_ctx.store.batchMode ? '完成' : '批量操作');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "date-filter-bar" },
});
/** @type {__VLS_StyleScopedClasses['date-filter-bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "date",
});
(__VLS_ctx.store.dateFrom);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ style: {} },
});
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "date",
});
(__VLS_ctx.store.dateTo);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.store.dateFrom = '';
            __VLS_ctx.store.dateTo = '';
            // @ts-ignore
            [store, store, store, store, store, store,];
        } },
    type: "button",
    ...{ class: "btn btn-sm btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.store.clearFilters();
            // @ts-ignore
            [store,];
        } },
    type: "button",
    ...{ class: "btn btn-sm btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "content-header" },
});
/** @type {__VLS_StyleScopedClasses['content-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "breadcrumb" },
});
/** @type {__VLS_StyleScopedClasses['breadcrumb']} */ ;
(__VLS_ctx.store.errorListBreadcrumb);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "head-right-cluster" },
});
/** @type {__VLS_StyleScopedClasses['head-right-cluster']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "error-sort-controls" },
});
/** @type {__VLS_StyleScopedClasses['error-sort-controls']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "error-sort-label" },
});
/** @type {__VLS_StyleScopedClasses['error-sort-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: (...[$event]) => {
            __VLS_ctx.store.setErrorSortBy($event.target.value);
            // @ts-ignore
            [store, store,];
        } },
    ...{ class: "error-sort-select" },
    value: (__VLS_ctx.store.errorSortBy),
});
/** @type {__VLS_StyleScopedClasses['error-sort-select']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "created_at",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "wrong_count",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.store.toggleErrorSortOrder();
            // @ts-ignore
            [store, store,];
        } },
    type: "button",
    ...{ class: "btn btn-sm btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
(__VLS_ctx.store.errorSortOrder === 'asc' ? '升序' : '降序');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stats-bar" },
});
/** @type {__VLS_StyleScopedClasses['stats-bar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-item" },
});
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-num" },
});
/** @type {__VLS_StyleScopedClasses['stat-num']} */ ;
(__VLS_ctx.store.errorListStats.total);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-item" },
});
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-num" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['stat-num']} */ ;
(__VLS_ctx.store.errorListStats.focus);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-item" },
});
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-num" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['stat-num']} */ ;
(__VLS_ctx.store.errorListStats.review);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-item" },
});
/** @type {__VLS_StyleScopedClasses['stat-item']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-num" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['stat-num']} */ ;
(__VLS_ctx.store.errorListStats.mastered);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "stat-label" },
});
/** @type {__VLS_StyleScopedClasses['stat-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('openGlobalSearch');
            // @ts-ignore
            [store, store, store, store, store, emit,];
        } },
    type: "button",
    ...{ class: "btn btn-sm btn-secondary" },
    title: "Ctrl+K",
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
if (__VLS_ctx.store.batchMode) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "batch-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['batch-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.store.batchSelectedIds.length);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.store.batchMode))
                    return;
                __VLS_ctx.showBatchMoveModal = true;
                // @ts-ignore
                [store, store, showBatchMoveModal,];
            } },
        type: "button",
        ...{ class: "btn btn-sm btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.store.batchDeleteSelectedErrors) },
        type: "button",
        ...{ class: "btn btn-sm btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.store.batchMode))
                    return;
                __VLS_ctx.store.toggleBatchMode();
                // @ts-ignore
                [store, store,];
            } },
        type: "button",
        ...{ class: "btn btn-sm btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
}
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
if (__VLS_ctx.showBatchMoveModal) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showBatchMoveModal))
                    return;
                __VLS_ctx.showBatchMoveModal = false;
                // @ts-ignore
                [showBatchMoveModal, showBatchMoveModal,];
            } },
        ...{ class: "ewp-move-mask" },
    });
    /** @type {__VLS_StyleScopedClasses['ewp-move-mask']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onKeydown: (...[$event]) => {
                if (!(__VLS_ctx.showBatchMoveModal))
                    return;
                __VLS_ctx.showBatchMoveModal = false;
                // @ts-ignore
                [showBatchMoveModal,];
            } },
        ...{ class: "ewp-move-dialog" },
        role: "dialog",
        'aria-modal': "true",
    });
    /** @type {__VLS_StyleScopedClasses['ewp-move-dialog']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ewp-move-title" },
    });
    /** @type {__VLS_StyleScopedClasses['ewp-move-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "ewp-move-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['ewp-move-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        value: (__VLS_ctx.batchMoveTarget),
        ...{ class: "ewp-sel ewp-sel-dialog" },
    });
    /** @type {__VLS_StyleScopedClasses['ewp-sel']} */ ;
    /** @type {__VLS_StyleScopedClasses['ewp-sel-dialog']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    for (const [n] of __VLS_vFor((__VLS_ctx.batchMountLeaves))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (n.id),
            value: (n.id),
        });
        (__VLS_ctx.store.getNodePathText(n.id) ? `${__VLS_ctx.store.getNodePathText(n.id)} › ${n.title}` : n.title);
        // @ts-ignore
        [store, store, batchMoveTarget, batchMountLeaves,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ewp-move-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['ewp-move-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showBatchMoveModal))
                    return;
                __VLS_ctx.showBatchMoveModal = false;
                // @ts-ignore
                [showBatchMoveModal,];
            } },
        type: "button",
        ...{ class: "btn btn-sm btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.applyBatchMountFromModal) },
        type: "button",
        ...{ class: "btn btn-sm btn-primary" },
        disabled: (!__VLS_ctx.batchMoveTarget || !__VLS_ctx.store.batchSelectedIds.length),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
}
// @ts-ignore
[store, batchMoveTarget, applyBatchMountFromModal,];
var __VLS_3;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "errors-list" },
});
/** @type {__VLS_StyleScopedClasses['errors-list']} */ ;
const __VLS_6 = ErrorList;
// @ts-ignore
const __VLS_7 = __VLS_asFunctionalComponent1(__VLS_6, new __VLS_6({
    entries: (__VLS_ctx.store.filteredErrors),
}));
const __VLS_8 = __VLS_7({
    entries: (__VLS_ctx.store.filteredErrors),
}, ...__VLS_functionalComponentArgsRest(__VLS_7));
// @ts-ignore
[store,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
