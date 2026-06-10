/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, watch } from 'vue';
import { marked } from 'marked';
import { useXingceStore } from '@/stores/xingceStore';
marked.setOptions({ gfm: true, breaks: true });
const store = useXingceStore();
const editing = ref(false);
const draftMd = ref('');
const activeNode = computed(() => {
    if (!store.activeNodeId)
        return null;
    return store.knowledgeNodes.find(n => n.id === store.activeNodeId) ?? null;
});
const noteContent = computed(() => {
    if (!store.activeNodeId)
        return '';
    const node = activeNode.value;
    const md = node?.contentMd;
    if (typeof md === 'string' && md.trim())
        return md;
    const fromNotes = store.notesByType[store.activeNodeId];
    if (fromNotes && typeof fromNotes === 'string')
        return fromNotes;
    if (fromNotes && typeof fromNotes === 'object') {
        const v = fromNotes.content;
        if (typeof v === 'string')
            return v;
    }
    const nt = node?.noteContent;
    if (typeof nt === 'string' && nt.trim())
        return nt;
    return '';
});
const pathLine = computed(() => {
    if (!store.activeNodeId)
        return '';
    return store.getNodePathText(store.activeNodeId);
});
const renderedNote = computed(() => {
    const raw = noteContent.value;
    if (!String(raw).trim())
        return '';
    return marked.parse(raw);
});
const draftRendered = computed(() => {
    const raw = draftMd.value;
    if (!String(raw).trim()) {
        return '<p class="np-ph">预览将显示在此</p>';
    }
    return marked.parse(raw);
});
watch(() => store.activeNodeId, () => {
    editing.value = false;
    draftMd.value = noteContent.value;
});
watch(noteContent, (v) => {
    if (!editing.value)
        draftMd.value = v;
});
function startEdit() {
    draftMd.value = noteContent.value;
    editing.value = true;
}
function cancelEdit() {
    editing.value = false;
    draftMd.value = noteContent.value;
}
function saveEdit() {
    if (!store.activeNodeId)
        return;
    store.updateKnowledgeNode(store.activeNodeId, { contentMd: draftMd.value });
    editing.value = false;
}
const __VLS_exposed = { startEdit };
defineExpose(__VLS_exposed);
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['np-empty']} */ ;
/** @type {__VLS_StyleScopedClasses['np-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['np-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['np-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
/** @type {__VLS_StyleScopedClasses['np-edit-split']} */ ;
/** @type {__VLS_StyleScopedClasses['np-md']} */ ;
/** @type {__VLS_StyleScopedClasses['np-md']} */ ;
/** @type {__VLS_StyleScopedClasses['np-md']} */ ;
/** @type {__VLS_StyleScopedClasses['np-md']} */ ;
/** @type {__VLS_StyleScopedClasses['np-md']} */ ;
/** @type {__VLS_StyleScopedClasses['np-md']} */ ;
/** @type {__VLS_StyleScopedClasses['np-md']} */ ;
/** @type {__VLS_StyleScopedClasses['np-md']} */ ;
/** @type {__VLS_StyleScopedClasses['np-md']} */ ;
/** @type {__VLS_StyleScopedClasses['np-md']} */ ;
/** @type {__VLS_StyleScopedClasses['np-md']} */ ;
/** @type {__VLS_StyleScopedClasses['np-md']} */ ;
/** @type {__VLS_StyleScopedClasses['np-md']} */ ;
/** @type {__VLS_StyleScopedClasses['np-md']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "np" },
});
/** @type {__VLS_StyleScopedClasses['np']} */ ;
if (!__VLS_ctx.store.activeNodeId) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "np-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['np-empty']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "np-header" },
    });
    /** @type {__VLS_StyleScopedClasses['np-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "np-title-block" },
    });
    /** @type {__VLS_StyleScopedClasses['np-title-block']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "np-node-title" },
    });
    /** @type {__VLS_StyleScopedClasses['np-node-title']} */ ;
    (__VLS_ctx.activeNode?.title ?? __VLS_ctx.store.activeNodeId);
    if (__VLS_ctx.pathLine) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "np-path" },
        });
        /** @type {__VLS_StyleScopedClasses['np-path']} */ ;
        (__VLS_ctx.pathLine);
    }
    if (__VLS_ctx.store.errorCountByNode[__VLS_ctx.store.activeNodeId]) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "np-count" },
        });
        /** @type {__VLS_StyleScopedClasses['np-count']} */ ;
        (__VLS_ctx.store.errorCountByNode[__VLS_ctx.store.activeNodeId]);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "np-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['np-actions']} */ ;
    if (!__VLS_ctx.editing) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.startEdit) },
            type: "button",
            ...{ class: "np-btn" },
        });
        /** @type {__VLS_StyleScopedClasses['np-btn']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.saveEdit) },
            type: "button",
            ...{ class: "np-btn primary" },
        });
        /** @type {__VLS_StyleScopedClasses['np-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['primary']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.cancelEdit) },
            type: "button",
            ...{ class: "np-btn" },
        });
        /** @type {__VLS_StyleScopedClasses['np-btn']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "np-body" },
        ...{ class: ({ 'np-body--edit': __VLS_ctx.editing }) },
    });
    /** @type {__VLS_StyleScopedClasses['np-body']} */ ;
    /** @type {__VLS_StyleScopedClasses['np-body--edit']} */ ;
    if (__VLS_ctx.editing) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "np-edit-split" },
        });
        /** @type {__VLS_StyleScopedClasses['np-edit-split']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "np-edit-pane" },
        });
        /** @type {__VLS_StyleScopedClasses['np-edit-pane']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "np-edit-label" },
        });
        /** @type {__VLS_StyleScopedClasses['np-edit-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (__VLS_ctx.draftMd),
            ...{ class: "np-editor" },
            placeholder: "# 规则总结&#10;## 易错点&#10;- …",
            spellcheck: "false",
        });
        /** @type {__VLS_StyleScopedClasses['np-editor']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "np-edit-pane np-edit-preview" },
        });
        /** @type {__VLS_StyleScopedClasses['np-edit-pane']} */ ;
        /** @type {__VLS_StyleScopedClasses['np-edit-preview']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "np-edit-label" },
        });
        /** @type {__VLS_StyleScopedClasses['np-edit-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
            ...{ class: "np-content np-md np-md-preview" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vHtml, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.draftRendered) }, null, null);
        /** @type {__VLS_StyleScopedClasses['np-content']} */ ;
        /** @type {__VLS_StyleScopedClasses['np-md']} */ ;
        /** @type {__VLS_StyleScopedClasses['np-md-preview']} */ ;
    }
    else {
        if (__VLS_ctx.noteContent) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
                ...{ class: "np-content np-md" },
            });
            __VLS_asFunctionalDirective(__VLS_directives.vHtml, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.renderedNote) }, null, null);
            /** @type {__VLS_StyleScopedClasses['np-content']} */ ;
            /** @type {__VLS_StyleScopedClasses['np-md']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "np-no-note" },
            });
            /** @type {__VLS_StyleScopedClasses['np-no-note']} */ ;
        }
    }
}
// @ts-ignore
[store, store, store, store, store, store, activeNode, pathLine, pathLine, editing, editing, editing, startEdit, saveEdit, cancelEdit, draftMd, draftRendered, noteContent, renderedNote,];
const __VLS_export = (await import('vue')).defineComponent({
    setup: () => __VLS_exposed,
});
export default {};
