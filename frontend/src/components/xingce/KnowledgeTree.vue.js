/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, onMounted } from 'vue';
import { useXingceStore } from '@/stores/xingceStore';
import KnowledgeTreeNode from './KnowledgeTreeNode.vue';
const __VLS_props = withDefaults(defineProps(), { hideToolbar: false });
const store = useXingceStore();
const searchKw = computed({
    get: () => store.knowledgeTreeSearch,
    set: (v) => { store.knowledgeTreeSearch = v; },
});
const focusMode = computed({
    get: () => store.knowledgeFocusMode,
    set: (v) => { store.knowledgeFocusMode = v; },
});
/** 与旧版一致：不展示「无任何子节点且无错题」的虚拟根（如空的「其他」） */
const displayRoots = computed(() => {
    const agg = store.errorCountByNodeAgg;
    return store.knowledgeTree.filter((root) => {
        const id = String(root.id || '');
        if (!id.startsWith('__virtual_root__'))
            return true;
        const children = root.children?.length ?? 0;
        const n = agg[id] ?? 0;
        return children > 0 || n > 0;
    });
});
const hasActiveNode = computed(() => store.activeNodeId !== null);
const searchMetaText = computed(() => {
    if (!store.hasKnowledgeSearch())
        return '支持按节点名和路径搜索';
    const count = store.visibleKnowledgeNodeCount;
    return count > 0 ? `命中 ${count} 个节点` : '未找到匹配节点';
});
function clearNodeFilter() {
    store.setActiveNode(null);
}
function clearSearch() {
    store.knowledgeTreeSearch = '';
}
onMounted(() => {
    store.loadKnowledgeExpandedState();
});
const __VLS_defaults = { hideToolbar: false };
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['kt-search']} */ ;
/** @type {__VLS_StyleScopedClasses['kt-search']} */ ;
/** @type {__VLS_StyleScopedClasses['kt-search-clear']} */ ;
/** @type {__VLS_StyleScopedClasses['kt-focus-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['kt-focus-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['kt-clear-node']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "kt" },
});
/** @type {__VLS_StyleScopedClasses['kt']} */ ;
if (!__VLS_ctx.hideToolbar) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "kt-toolbar" },
    });
    /** @type {__VLS_StyleScopedClasses['kt-toolbar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "kt-search-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['kt-search-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "kt-search" },
        type: "search",
        placeholder: "搜索知识树节点…",
    });
    (__VLS_ctx.searchKw);
    /** @type {__VLS_StyleScopedClasses['kt-search']} */ ;
    if (__VLS_ctx.searchKw) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.clearSearch) },
            ...{ class: "kt-search-clear" },
            type: "button",
        });
        /** @type {__VLS_StyleScopedClasses['kt-search-clear']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.hideToolbar))
                    return;
                __VLS_ctx.focusMode = !__VLS_ctx.focusMode;
                // @ts-ignore
                [hideToolbar, searchKw, searchKw, clearSearch, focusMode, focusMode,];
            } },
        type: "button",
        ...{ class: "kt-focus-btn" },
        ...{ class: ({ active: __VLS_ctx.focusMode }) },
        title: (__VLS_ctx.focusMode ? '退出专注树模式' : '进入专注树模式'),
    });
    /** @type {__VLS_StyleScopedClasses['kt-focus-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    (__VLS_ctx.focusMode ? '退出专注' : '专注树');
}
if (!__VLS_ctx.hideToolbar) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "kt-search-meta" },
    });
    /** @type {__VLS_StyleScopedClasses['kt-search-meta']} */ ;
    (__VLS_ctx.searchMetaText);
}
if (__VLS_ctx.hasActiveNode) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "kt-active-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['kt-active-hint']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.clearNodeFilter) },
        ...{ class: "kt-clear-node" },
    });
    /** @type {__VLS_StyleScopedClasses['kt-clear-node']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "kt-body" },
});
/** @type {__VLS_StyleScopedClasses['kt-body']} */ ;
if (!__VLS_ctx.store.knowledgeTree.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "kt-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['kt-empty']} */ ;
}
for (const [root] of __VLS_vFor((__VLS_ctx.displayRoots))) {
    const __VLS_0 = KnowledgeTreeNode;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        key: (root.id),
        node: (root),
        depth: (0),
    }));
    const __VLS_2 = __VLS_1({
        key: (root.id),
        node: (root),
        depth: (0),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    // @ts-ignore
    [hideToolbar, focusMode, focusMode, focusMode, searchMetaText, hasActiveNode, clearNodeFilter, store, displayRoots,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
