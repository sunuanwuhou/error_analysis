/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { useXingceStore } from '@/stores/xingceStore';
import KnowledgeTreeNode from './KnowledgeTreeNode.vue';
const store = useXingceStore();
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['ktp-clear']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "ktp" },
});
/** @type {__VLS_StyleScopedClasses['ktp']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "ktp-header" },
});
/** @type {__VLS_StyleScopedClasses['ktp-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "ktp-title" },
});
/** @type {__VLS_StyleScopedClasses['ktp-title']} */ ;
if (__VLS_ctx.store.activeNodeId) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.store.activeNodeId))
                    return;
                __VLS_ctx.store.setActiveNode(null);
                // @ts-ignore
                [store, store,];
            } },
        ...{ class: "ktp-clear" },
    });
    /** @type {__VLS_StyleScopedClasses['ktp-clear']} */ ;
}
if (!__VLS_ctx.store.knowledgeTree.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ktp-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['ktp-empty']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ktp-tree" },
    });
    /** @type {__VLS_StyleScopedClasses['ktp-tree']} */ ;
    for (const [node] of __VLS_vFor((__VLS_ctx.store.knowledgeTree))) {
        const __VLS_0 = KnowledgeTreeNode;
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
            key: (node.id),
            node: (node),
            depth: (0),
        }));
        const __VLS_2 = __VLS_1({
            key: (node.id),
            node: (node),
            depth: (0),
        }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        // @ts-ignore
        [store, store,];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
