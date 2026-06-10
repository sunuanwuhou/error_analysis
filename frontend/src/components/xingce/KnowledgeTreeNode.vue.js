/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, ref, nextTick } from 'vue';
import { useXingceStore } from '@/stores/xingceStore';
const props = defineProps();
const store = useXingceStore();
const renaming = ref(false);
const draftTitle = ref('');
const renameInputRef = ref(null);
const isExpanded = computed(() => store.knowledgeExpandedIds.has(props.node.id));
const isActive = computed(() => store.activeNodeId === props.node.id);
const aggCount = computed(() => store.errorCountByNodeAgg[props.node.id] ?? 0);
const hasChildren = computed(() => (props.node.children?.length ?? 0) > 0);
const isVisible = computed(() => {
    if (!store.isNodeVisibleBySearch(props.node))
        return false;
    return true;
});
// 搜索时自动展开匹配的节点
const shouldExpand = computed(() => {
    if (store.hasKnowledgeSearch() && hasChildren.value)
        return true;
    return isExpanded.value;
});
function handleClick() {
    if (!isActive.value) {
        store.setActiveNode(props.node.id);
    }
}
function handleToggle(e) {
    e.stopPropagation();
    store.toggleKnowledgeNode(props.node.id);
}
async function beginRename(e) {
    e.stopPropagation();
    renaming.value = true;
    draftTitle.value = props.node.title;
    await nextTick();
    renameInputRef.value?.focus();
    renameInputRef.value?.select();
}
function cancelRename() {
    renaming.value = false;
}
function commitRename() {
    if (!renaming.value)
        return;
    const prev = props.node.title;
    const next = draftTitle.value.trim();
    renaming.value = false;
    if (!next || next === prev)
        return;
    store.renameKnowledgeNode(props.node.id, next);
}
function moveNodeByPrompt(e) {
    e.stopPropagation();
    if (!store.canMoveKnowledgeNode(props.node.id)) {
        window.alert('基础一级节点不支持移动');
        return;
    }
    const options = store.getKnowledgeMoveTargetOptions(props.node.id);
    if (!options.length) {
        window.alert('暂无可移动目标');
        return;
    }
    const menu = options.map((item, idx) => `${idx + 1}. ${item.label}`).join('\n');
    const answer = window.prompt(`选择目标父节点编号：\n\n${menu}`, '1');
    if (answer == null)
        return;
    const picked = options[Number(answer) - 1];
    if (!picked) {
        window.alert('选择无效');
        return;
    }
    store.moveKnowledgeNode(props.node.id, picked.id);
}
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['ktn-row']} */ ;
/** @type {__VLS_StyleScopedClasses['ktn-row']} */ ;
/** @type {__VLS_StyleScopedClasses['ktn-row']} */ ;
/** @type {__VLS_StyleScopedClasses['ktn-row']} */ ;
/** @type {__VLS_StyleScopedClasses['depth-0']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['ktn-arrow']} */ ;
/** @type {__VLS_StyleScopedClasses['ktn-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['ktn-badge']} */ ;
/** @type {__VLS_StyleScopedClasses['ktn-move-btn']} */ ;
if (__VLS_ctx.isVisible) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ktn-wrap" },
    });
    /** @type {__VLS_StyleScopedClasses['ktn-wrap']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: (__VLS_ctx.handleClick) },
        ...{ class: "ktn-row" },
        ...{ class: ({ active: __VLS_ctx.isActive, 'depth-0': __VLS_ctx.depth === 0, 'depth-1': __VLS_ctx.depth === 1 }) },
        ...{ style: ({ paddingLeft: `${8 + __VLS_ctx.depth * 14}px` }) },
    });
    /** @type {__VLS_StyleScopedClasses['ktn-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    /** @type {__VLS_StyleScopedClasses['depth-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['depth-1']} */ ;
    if (__VLS_ctx.hasChildren) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ onClick: (__VLS_ctx.handleToggle) },
            ...{ class: "ktn-arrow" },
        });
        /** @type {__VLS_StyleScopedClasses['ktn-arrow']} */ ;
        (__VLS_ctx.shouldExpand ? '▾' : '▸');
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
            ...{ class: "ktn-arrow-placeholder" },
        });
        /** @type {__VLS_StyleScopedClasses['ktn-arrow-placeholder']} */ ;
    }
    if (!__VLS_ctx.renaming) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ onDblclick: (__VLS_ctx.beginRename) },
            ...{ class: "ktn-title" },
            title: ('双击重命名'),
        });
        /** @type {__VLS_StyleScopedClasses['ktn-title']} */ ;
        (__VLS_ctx.node.title);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onClick: () => { } },
            ...{ onKeydown: (__VLS_ctx.commitRename) },
            ...{ onKeydown: (__VLS_ctx.cancelRename) },
            ...{ onBlur: (__VLS_ctx.commitRename) },
            ref: "renameInputRef",
            value: (__VLS_ctx.draftTitle),
            ...{ class: "ktn-rename" },
            type: "text",
        });
        /** @type {__VLS_StyleScopedClasses['ktn-rename']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ktn-badge" },
        ...{ class: ({ 'badge-warn': __VLS_ctx.aggCount > 20, 'is-empty': __VLS_ctx.aggCount === 0 }) },
    });
    /** @type {__VLS_StyleScopedClasses['ktn-badge']} */ ;
    /** @type {__VLS_StyleScopedClasses['badge-warn']} */ ;
    /** @type {__VLS_StyleScopedClasses['is-empty']} */ ;
    (__VLS_ctx.aggCount);
    if (__VLS_ctx.isActive && __VLS_ctx.store.canMoveKnowledgeNode(__VLS_ctx.node.id)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.moveNodeByPrompt) },
            ...{ class: "ktn-move-btn" },
            title: "移动到其它父节点",
        });
        /** @type {__VLS_StyleScopedClasses['ktn-move-btn']} */ ;
    }
    if (__VLS_ctx.hasChildren && __VLS_ctx.shouldExpand) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "ktn-children" },
        });
        /** @type {__VLS_StyleScopedClasses['ktn-children']} */ ;
        for (const [child] of __VLS_vFor((__VLS_ctx.node.children))) {
            let __VLS_0;
            /** @ts-ignore @type { | typeof __VLS_components.KnowledgeTreeNode} */
            KnowledgeTreeNode;
            // @ts-ignore
            const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
                key: (child.id),
                node: (child),
                depth: (__VLS_ctx.depth + 1),
            }));
            const __VLS_2 = __VLS_1({
                key: (child.id),
                node: (child),
                depth: (__VLS_ctx.depth + 1),
            }, ...__VLS_functionalComponentArgsRest(__VLS_1));
            // @ts-ignore
            [isVisible, handleClick, isActive, isActive, depth, depth, depth, depth, hasChildren, hasChildren, handleToggle, shouldExpand, shouldExpand, renaming, beginRename, node, node, node, commitRename, commitRename, cancelRename, draftTitle, aggCount, aggCount, aggCount, store, moveNodeByPrompt,];
        }
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
