/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed } from 'vue';
import { useXingceStore } from '@/stores/xingceStore';
import KnowledgeTree from './KnowledgeTree.vue';
const store = useXingceStore();
const TASK_OPTIONS = [
    { value: 'all', label: '全部任务' },
    { value: 'diagnose', label: '待判因' },
    { value: 'review_ready', label: '待复盘' },
    { value: 'retrain', label: '待复训' },
];
const STATUS_OPTIONS = [
    { value: 'all', label: '全部' },
    { value: 'focus', label: '重点复习' },
    { value: 'review', label: '待复习' },
    { value: 'mastered', label: '已掌握' },
];
const advancedOpen = ref(false);
const reasonOpen = ref(false);
const dateOpen = ref(false);
const searchMetaText = computed(() => {
    if (!store.hasKnowledgeSearch())
        return '支持按节点名和路径搜索';
    const count = store.visibleKnowledgeNodeCount;
    return count > 0 ? `命中 ${count} 个节点` : '未找到匹配节点';
});
function clearTreeSearch() {
    store.knowledgeTreeSearch = '';
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['fs-bc-remove']} */ ;
/** @type {__VLS_StyleScopedClasses['fs-search']} */ ;
/** @type {__VLS_StyleScopedClasses['fs-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['fs-reason-item']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
if (!__VLS_ctx.store.knowledgeFocusMode) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "xc-vue-fs-advanced" },
    });
    /** @type {__VLS_StyleScopedClasses['xc-vue-fs-advanced']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.store.knowledgeFocusMode))
                    return;
                __VLS_ctx.advancedOpen = !__VLS_ctx.advancedOpen;
                // @ts-ignore
                [store, advancedOpen, advancedOpen,];
            } },
        type: "button",
        ...{ class: "fs-advanced-toggle" },
    });
    /** @type {__VLS_StyleScopedClasses['fs-advanced-toggle']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.advancedOpen ? '▾' : '▸');
    if (__VLS_ctx.advancedOpen) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "fs-advanced-panel" },
        });
        /** @type {__VLS_StyleScopedClasses['fs-advanced-panel']} */ ;
        if (__VLS_ctx.store.activeFilterCrumbs.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "fs-breadcrumb" },
            });
            /** @type {__VLS_StyleScopedClasses['fs-breadcrumb']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "fs-bc-label" },
            });
            /** @type {__VLS_StyleScopedClasses['fs-bc-label']} */ ;
            for (const [c] of __VLS_vFor((__VLS_ctx.store.activeFilterCrumbs))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    key: (c.key + c.label),
                    ...{ class: "fs-bc-chip" },
                });
                /** @type {__VLS_StyleScopedClasses['fs-bc-chip']} */ ;
                (c.label);
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(!__VLS_ctx.store.knowledgeFocusMode))
                                return;
                            if (!(__VLS_ctx.advancedOpen))
                                return;
                            if (!(__VLS_ctx.store.activeFilterCrumbs.length))
                                return;
                            __VLS_ctx.store.removeFilterCrumb(c.key);
                            // @ts-ignore
                            [store, store, store, advancedOpen, advancedOpen,];
                        } },
                    type: "button",
                    ...{ class: "fs-bc-remove" },
                    title: ('移除：' + c.label),
                    'aria-label': "移除筛选",
                });
                /** @type {__VLS_StyleScopedClasses['fs-bc-remove']} */ ;
                // @ts-ignore
                [];
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "fs-section" },
        });
        /** @type {__VLS_StyleScopedClasses['fs-section']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ class: "fs-search" },
            placeholder: "搜索题目…（空格 = AND）",
            type: "search",
        });
        (__VLS_ctx.store.searchQuery);
        /** @type {__VLS_StyleScopedClasses['fs-search']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "fs-section" },
        });
        /** @type {__VLS_StyleScopedClasses['fs-section']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "fs-label" },
        });
        /** @type {__VLS_StyleScopedClasses['fs-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "fs-chip-row" },
        });
        /** @type {__VLS_StyleScopedClasses['fs-chip-row']} */ ;
        for (const [opt] of __VLS_vFor((__VLS_ctx.TASK_OPTIONS))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(!__VLS_ctx.store.knowledgeFocusMode))
                            return;
                        if (!(__VLS_ctx.advancedOpen))
                            return;
                        __VLS_ctx.store.setTaskFilter(opt.value);
                        // @ts-ignore
                        [store, store, TASK_OPTIONS,];
                    } },
                key: (opt.value),
                type: "button",
                ...{ class: "fs-chip" },
                ...{ class: ({ active: __VLS_ctx.store.taskFilter === opt.value }) },
            });
            /** @type {__VLS_StyleScopedClasses['fs-chip']} */ ;
            /** @type {__VLS_StyleScopedClasses['active']} */ ;
            (opt.label);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "fs-chip-badge" },
            });
            /** @type {__VLS_StyleScopedClasses['fs-chip-badge']} */ ;
            if (opt.value === 'all') {
                (__VLS_ctx.store.errors.length);
            }
            else {
                (__VLS_ctx.store.taskCounts[opt.value]);
            }
            // @ts-ignore
            [store, store, store,];
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "fs-section" },
        });
        /** @type {__VLS_StyleScopedClasses['fs-section']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "fs-label" },
        });
        /** @type {__VLS_StyleScopedClasses['fs-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "fs-chip-row" },
        });
        /** @type {__VLS_StyleScopedClasses['fs-chip-row']} */ ;
        for (const [opt] of __VLS_vFor((__VLS_ctx.STATUS_OPTIONS))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(!__VLS_ctx.store.knowledgeFocusMode))
                            return;
                        if (!(__VLS_ctx.advancedOpen))
                            return;
                        __VLS_ctx.store.setStatusFilter(opt.value);
                        // @ts-ignore
                        [store, STATUS_OPTIONS,];
                    } },
                key: (opt.value),
                type: "button",
                ...{ class: "fs-chip" },
                ...{ class: ({ active: __VLS_ctx.store.statusFilter === opt.value }) },
            });
            /** @type {__VLS_StyleScopedClasses['fs-chip']} */ ;
            /** @type {__VLS_StyleScopedClasses['active']} */ ;
            (opt.label);
            // @ts-ignore
            [store,];
        }
        if (__VLS_ctx.store.reasonOptions.length > 0) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "fs-section" },
            });
            /** @type {__VLS_StyleScopedClasses['fs-section']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(!__VLS_ctx.store.knowledgeFocusMode))
                            return;
                        if (!(__VLS_ctx.advancedOpen))
                            return;
                        if (!(__VLS_ctx.store.reasonOptions.length > 0))
                            return;
                        __VLS_ctx.reasonOpen = !__VLS_ctx.reasonOpen;
                        // @ts-ignore
                        [store, reasonOpen, reasonOpen,];
                    } },
                type: "button",
                ...{ class: "fs-collapse-header" },
            });
            /** @type {__VLS_StyleScopedClasses['fs-collapse-header']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "fs-label" },
                ...{ style: {} },
            });
            /** @type {__VLS_StyleScopedClasses['fs-label']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "fs-collapse-arrow" },
            });
            /** @type {__VLS_StyleScopedClasses['fs-collapse-arrow']} */ ;
            (__VLS_ctx.reasonOpen ? '▾' : '▸');
            if (__VLS_ctx.store.reasonFilter) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                    ...{ class: "fs-active-dot" },
                });
                /** @type {__VLS_StyleScopedClasses['fs-active-dot']} */ ;
            }
            if (__VLS_ctx.reasonOpen) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "fs-reason-list" },
                });
                /** @type {__VLS_StyleScopedClasses['fs-reason-list']} */ ;
                for (const [item] of __VLS_vFor((__VLS_ctx.store.reasonOptions.slice(0, 20)))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!(!__VLS_ctx.store.knowledgeFocusMode))
                                    return;
                                if (!(__VLS_ctx.advancedOpen))
                                    return;
                                if (!(__VLS_ctx.store.reasonOptions.length > 0))
                                    return;
                                if (!(__VLS_ctx.reasonOpen))
                                    return;
                                __VLS_ctx.store.toggleReasonFilter(item.reason);
                                // @ts-ignore
                                [store, store, store, reasonOpen, reasonOpen,];
                            } },
                        key: (item.reason),
                        type: "button",
                        ...{ class: "fs-reason-item" },
                        ...{ class: ({ active: __VLS_ctx.store.reasonFilter === item.reason }) },
                    });
                    /** @type {__VLS_StyleScopedClasses['fs-reason-item']} */ ;
                    /** @type {__VLS_StyleScopedClasses['active']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "fs-reason-label" },
                    });
                    /** @type {__VLS_StyleScopedClasses['fs-reason-label']} */ ;
                    (item.reason);
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "fs-reason-count" },
                    });
                    /** @type {__VLS_StyleScopedClasses['fs-reason-count']} */ ;
                    (item.count);
                    // @ts-ignore
                    [store,];
                }
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "fs-section" },
        });
        /** @type {__VLS_StyleScopedClasses['fs-section']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(!__VLS_ctx.store.knowledgeFocusMode))
                        return;
                    if (!(__VLS_ctx.advancedOpen))
                        return;
                    __VLS_ctx.dateOpen = !__VLS_ctx.dateOpen;
                    // @ts-ignore
                    [dateOpen, dateOpen,];
                } },
            type: "button",
            ...{ class: "fs-collapse-header" },
        });
        /** @type {__VLS_StyleScopedClasses['fs-collapse-header']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "fs-label" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['fs-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "fs-collapse-arrow" },
        });
        /** @type {__VLS_StyleScopedClasses['fs-collapse-arrow']} */ ;
        (__VLS_ctx.dateOpen ? '▾' : '▸');
        if (__VLS_ctx.store.dateFrom || __VLS_ctx.store.dateTo) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                ...{ class: "fs-active-dot" },
            });
            /** @type {__VLS_StyleScopedClasses['fs-active-dot']} */ ;
        }
        if (__VLS_ctx.dateOpen) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "fs-date-row" },
            });
            /** @type {__VLS_StyleScopedClasses['fs-date-row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ class: "fs-date-input" },
                type: "date",
                title: "起始日期",
            });
            (__VLS_ctx.store.dateFrom);
            /** @type {__VLS_StyleScopedClasses['fs-date-input']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "fs-date-sep" },
            });
            /** @type {__VLS_StyleScopedClasses['fs-date-sep']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                ...{ class: "fs-date-input" },
                type: "date",
                title: "结束日期",
            });
            (__VLS_ctx.store.dateTo);
            /** @type {__VLS_StyleScopedClasses['fs-date-input']} */ ;
        }
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sidebar-tree-toolbar" },
});
/** @type {__VLS_StyleScopedClasses['sidebar-tree-toolbar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sidebar-tree-toolbar-row" },
});
/** @type {__VLS_StyleScopedClasses['sidebar-tree-toolbar-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sidebar-tree-search" },
});
/** @type {__VLS_StyleScopedClasses['sidebar-tree-search']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "search-icon" },
});
/** @type {__VLS_StyleScopedClasses['search-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    type: "search",
    placeholder: "搜索知识树节点...",
    autocomplete: "off",
});
(__VLS_ctx.store.knowledgeTreeSearch);
if (__VLS_ctx.store.knowledgeTreeSearch) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.clearTreeSearch) },
        type: "button",
        ...{ class: "search-clear" },
        'aria-label': "清空知识树搜索",
    });
    /** @type {__VLS_StyleScopedClasses['search-clear']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.store.knowledgeFocusMode = !__VLS_ctx.store.knowledgeFocusMode;
            // @ts-ignore
            [store, store, store, store, store, store, store, store, dateOpen, dateOpen, clearTreeSearch,];
        } },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
(__VLS_ctx.store.knowledgeFocusMode ? '退出专注' : '专注树');
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sidebar-tree-search-meta" },
});
/** @type {__VLS_StyleScopedClasses['sidebar-tree-search-meta']} */ ;
(__VLS_ctx.searchMetaText);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nav-scroll" },
});
/** @type {__VLS_StyleScopedClasses['nav-scroll']} */ ;
const __VLS_0 = KnowledgeTree;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    hideToolbar: true,
}));
const __VLS_2 = __VLS_1({
    hideToolbar: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
// @ts-ignore
[store, searchMetaText,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
