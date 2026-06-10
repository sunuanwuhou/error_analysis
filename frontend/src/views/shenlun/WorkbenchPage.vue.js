/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, watch, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter, useRoute } from 'vue-router';
import { useShenlunStore } from '@/stores/shenlunStore';
import { flattenShenlunNodes, SL_TREE, shenlunNodeTitle, nodeIdToRouteQuery, } from '@/data/shenlunTree';
const store = useShenlunStore();
const { fenbiReferenceText, ccPromptDisplayText, ccPasteText } = storeToRefs(store);
const router = useRouter();
const route = useRoute();
const activeParagraph = ref(0);
const currentSeg = computed(() => store.segments[activeParagraph.value] ?? null);
watch(() => store.segments.length, (n) => {
    if (activeParagraph.value >= n)
        activeParagraph.value = Math.max(0, n - 1);
});
const finalSummaryModel = computed({
    get: () => store.finalSummary,
    set: (v) => store.updateFinalSummary(v),
});
const nodeTitle = computed(() => shenlunNodeTitle(store.selectedNodeId));
const flatNodes = flattenShenlunNodes(SL_TREE);
const canNewRound = computed(() => {
    const rows = store.attemptSummaries;
    return rows.length > 0 && rows[0].cc_status === 'success';
});
const deletingRoundId = ref(null);
function onNodeChange(ev) {
    const v = ev.target.value;
    void store.patchWorkbenchNode(v);
}
function roundStatusLabel(cc) {
    if (cc === 'success')
        return '已复盘';
    if (cc === 'failed')
        return '失败';
    if (cc === 'pending')
        return '等待中';
    return '进行中';
}
async function handleNewRound() {
    const ok = await store.createNewAIRound();
    if (ok)
        activeParagraph.value = 0;
}
async function confirmDeleteRound(row, ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (!window.confirm('确定删除这一轮练习/复盘记录？删除后不可恢复。'))
        return;
    deletingRoundId.value = row.id;
    try {
        await store.deleteAttemptRecord(row.id);
    }
    finally {
        deletingRoundId.value = null;
    }
}
function openResultRound(id) {
    void router.push({ name: 'ShenlunResult', params: { attemptId: id } });
}
watch(() => [route.query.node, route.query.source], () => void store.bootstrapFromRoute(route.query), { immediate: true });
watch(() => store.sourceRecord?.id, (id) => {
    if (route.name !== 'ShenlunWorkbench')
        return;
    if (!id)
        return;
    if (route.query.source === id)
        return;
    void router.replace({
        name: 'ShenlunWorkbench',
        query: { node: nodeIdToRouteQuery(store.selectedNodeId), source: id },
    });
});
function handleResetInput() {
    store.resetWorkbench();
    void router.replace({
        name: 'ShenlunWorkbench',
        query: { node: nodeIdToRouteQuery(store.selectedNodeId) },
    });
}
function goHub() {
    void router.push({
        name: 'ShenlunHub',
        query: { node: nodeIdToRouteQuery(store.selectedNodeId) },
    });
}
const copied = ref(false);
async function handleFormat() {
    await store.formatMaterial();
}
async function handleGeneratePrompt() {
    await store.generateCCPrompt();
}
async function copyPrompt() {
    try {
        await navigator.clipboard.writeText(ccPromptDisplayText.value);
        copied.value = true;
        setTimeout(() => (copied.value = false), 2000);
    }
    catch {
        // Fallback: select all in textarea
        const el = document.getElementById('cc-prompt-textarea');
        el?.select();
    }
}
async function handleSubmitPaste() {
    const id = await store.submitCCPaste();
    if (id) {
        await router.push({ name: 'ShenlunResult', params: { attemptId: id } });
    }
}
function goResultReview() {
    const id = store.attempt?.id;
    if (!id || id.startsWith('local-'))
        return;
    void router.push({ name: 'ShenlunResult', params: { attemptId: id } });
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['wb-status']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-status']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-step']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-textarea--extraction']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-textarea--summary']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-textarea--paste']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-segment-body']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-extraction-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-extraction-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-extraction-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-extraction-block']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-extraction-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-extraction-block']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-textarea--extraction']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-extraction-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-summary-block']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-extraction-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-summary-block']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-textarea--summary']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-paper-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-seg-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-seg-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-material-block']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-extraction-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-extraction-block']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-label']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-extraction-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-summary-block']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-label']} */ ;
/** @type {__VLS_StyleScopedClasses['cc-fenbi-embed']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-textarea--fenbi']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-textarea--fenbi']} */ ;
/** @type {__VLS_StyleScopedClasses['cc-label-row']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-label']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-segment-body']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-extraction-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-extraction-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-extraction-block']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-extraction-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-extraction-block']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-textarea--extraction']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-material-block']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "wb-page" },
});
/** @type {__VLS_StyleScopedClasses['wb-page']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "wb-header" },
});
/** @type {__VLS_StyleScopedClasses['wb-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "wb-header-nav" },
});
/** @type {__VLS_StyleScopedClasses['wb-header-nav']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.goHub) },
    type: "button",
    ...{ class: "btn-link wb-back" },
});
/** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
/** @type {__VLS_StyleScopedClasses['wb-back']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "wb-node-chip" },
});
/** @type {__VLS_StyleScopedClasses['wb-node-chip']} */ ;
(__VLS_ctx.nodeTitle);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "wb-header-main" },
});
/** @type {__VLS_StyleScopedClasses['wb-header-main']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "wb-tag" },
});
/** @type {__VLS_StyleScopedClasses['wb-tag']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({
    ...{ class: "wb-title" },
});
/** @type {__VLS_StyleScopedClasses['wb-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "wb-header-right" },
});
/** @type {__VLS_StyleScopedClasses['wb-header-right']} */ ;
if (__VLS_ctx.store.sourceLoading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "wb-status saving" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-status']} */ ;
    /** @type {__VLS_StyleScopedClasses['saving']} */ ;
}
else if (__VLS_ctx.store.sourceRecord) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "wb-status saved" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-status']} */ ;
    /** @type {__VLS_StyleScopedClasses['saved']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "wb-steps" },
});
/** @type {__VLS_StyleScopedClasses['wb-steps']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "wb-step" },
    ...{ class: ({ active: __VLS_ctx.store.phase === 'input' }) },
});
/** @type {__VLS_StyleScopedClasses['wb-step']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "wb-step-sep" },
});
/** @type {__VLS_StyleScopedClasses['wb-step-sep']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "wb-step" },
    ...{ class: ({ active: __VLS_ctx.store.phase === 'formatted' }) },
});
/** @type {__VLS_StyleScopedClasses['wb-step']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "wb-step-sep" },
});
/** @type {__VLS_StyleScopedClasses['wb-step-sep']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "wb-step" },
    ...{ class: ({ active: __VLS_ctx.store.phase === 'cc_prompt' }) },
});
/** @type {__VLS_StyleScopedClasses['wb-step']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
if (__VLS_ctx.store.sourceRecord) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "wb-section wb-meta-card" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-section']} */ ;
    /** @type {__VLS_StyleScopedClasses['wb-meta-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "wb-meta-grid" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-meta-grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "wb-meta-field" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-meta-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "wb-label wb-label--small" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-label']} */ ;
    /** @type {__VLS_StyleScopedClasses['wb-label--small']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: (...[$event]) => {
                if (!(__VLS_ctx.store.sourceRecord))
                    return;
                __VLS_ctx.onNodeChange($event);
                // @ts-ignore
                [goHub, nodeTitle, store, store, store, store, store, store, onNodeChange,];
            } },
        ...{ class: "wb-select" },
        value: (__VLS_ctx.store.selectedNodeId),
        disabled: (__VLS_ctx.store.sourceLoading),
    });
    /** @type {__VLS_StyleScopedClasses['wb-select']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    for (const [opt] of __VLS_vFor((__VLS_ctx.flatNodes))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (opt.id),
            value: (opt.id),
        });
        (opt.title);
        // @ts-ignore
        [store, store, flatNodes,];
    }
    if (__VLS_ctx.store.sourceError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "wb-error wb-error--compact" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-error']} */ ;
        /** @type {__VLS_StyleScopedClasses['wb-error--compact']} */ ;
        (__VLS_ctx.store.sourceError);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "wb-rounds" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-rounds']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "wb-rounds-head" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-rounds-head']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "wb-rounds-title" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-rounds-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.handleNewRound) },
        type: "button",
        ...{ class: "btn btn-secondary wb-round-new" },
        disabled: (!__VLS_ctx.canNewRound || __VLS_ctx.store.attemptLoading),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    /** @type {__VLS_StyleScopedClasses['wb-round-new']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "wb-rounds-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-rounds-hint']} */ ;
    if (__VLS_ctx.store.attemptSummariesLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "wb-muted" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-muted']} */ ;
    }
    else if (__VLS_ctx.store.attemptSummaries.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "wb-round-list" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-round-list']} */ ;
        for (const [row] of __VLS_vFor((__VLS_ctx.store.attemptSummaries))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (row.id),
                ...{ class: "wb-round-row" },
            });
            /** @type {__VLS_StyleScopedClasses['wb-round-row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "wb-round-main" },
            });
            /** @type {__VLS_StyleScopedClasses['wb-round-main']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "wb-round-no" },
            });
            /** @type {__VLS_StyleScopedClasses['wb-round-no']} */ ;
            (row.attempt_no);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "wb-round-st" },
            });
            /** @type {__VLS_StyleScopedClasses['wb-round-st']} */ ;
            (__VLS_ctx.roundStatusLabel(row.cc_status));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "wb-round-time" },
            });
            /** @type {__VLS_StyleScopedClasses['wb-round-time']} */ ;
            (new Date(row.updated_at).toLocaleString('zh-CN', { hour12: false }));
            if (row.id === __VLS_ctx.store.attempt?.id) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "wb-round-current" },
                });
                /** @type {__VLS_StyleScopedClasses['wb-round-current']} */ ;
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "wb-round-actions" },
            });
            /** @type {__VLS_StyleScopedClasses['wb-round-actions']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.store.sourceRecord))
                            return;
                        if (!!(__VLS_ctx.store.attemptSummariesLoading))
                            return;
                        if (!(__VLS_ctx.store.attemptSummaries.length))
                            return;
                        __VLS_ctx.openResultRound(row.id);
                        // @ts-ignore
                        [store, store, store, store, store, store, store, handleNewRound, canNewRound, roundStatusLabel, openResultRound,];
                    } },
                type: "button",
                ...{ class: "btn-link" },
                disabled: (row.cc_status !== 'success'),
            });
            /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.store.sourceRecord))
                            return;
                        if (!!(__VLS_ctx.store.attemptSummariesLoading))
                            return;
                        if (!(__VLS_ctx.store.attemptSummaries.length))
                            return;
                        __VLS_ctx.confirmDeleteRound(row, $event);
                        // @ts-ignore
                        [confirmDeleteRound,];
                    } },
                type: "button",
                ...{ class: "btn-link wb-round-del" },
                disabled: (__VLS_ctx.deletingRoundId === row.id || __VLS_ctx.store.attemptLoading),
            });
            /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
            /** @type {__VLS_StyleScopedClasses['wb-round-del']} */ ;
            (__VLS_ctx.deletingRoundId === row.id ? '…' : '删除');
            // @ts-ignore
            [store, deletingRoundId, deletingRoundId,];
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "wb-muted" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-muted']} */ ;
    }
}
if (__VLS_ctx.store.phase === 'input') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "wb-section wb-paper-card" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-section']} */ ;
    /** @type {__VLS_StyleScopedClasses['wb-paper-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "wb-label" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "wb-paper-grid" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-paper-grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "wb-field" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "wb-field-lab" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-field-lab']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onInput: (...[$event]) => {
                if (!(__VLS_ctx.store.phase === 'input'))
                    return;
                __VLS_ctx.store.scheduleAutosave();
                // @ts-ignore
                [store, store,];
            } },
        value: (__VLS_ctx.store.paperYear),
        type: "text",
        ...{ class: "wb-input" },
        placeholder: "如 2024",
    });
    /** @type {__VLS_StyleScopedClasses['wb-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "wb-field" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "wb-field-lab" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-field-lab']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onInput: (...[$event]) => {
                if (!(__VLS_ctx.store.phase === 'input'))
                    return;
                __VLS_ctx.store.scheduleAutosave();
                // @ts-ignore
                [store, store,];
            } },
        value: (__VLS_ctx.store.paperProvince),
        type: "text",
        ...{ class: "wb-input" },
        placeholder: "如 江苏",
    });
    /** @type {__VLS_StyleScopedClasses['wb-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "wb-field" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-field']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "wb-field-lab" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-field-lab']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onInput: (...[$event]) => {
                if (!(__VLS_ctx.store.phase === 'input'))
                    return;
                __VLS_ctx.store.scheduleAutosave();
                // @ts-ignore
                [store, store,];
            } },
        value: (__VLS_ctx.store.paperSuiteType),
        type: "text",
        ...{ class: "wb-input" },
        placeholder: "如 行政执法卷、申论一",
    });
    /** @type {__VLS_StyleScopedClasses['wb-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "wb-field wb-field--readonly" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-field']} */ ;
    /** @type {__VLS_StyleScopedClasses['wb-field--readonly']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "wb-field-lab" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-field-lab']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "wb-ro-val" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-ro-val']} */ ;
    (__VLS_ctx.shenlunNodeTitle(__VLS_ctx.store.selectedNodeId));
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "wb-section" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "wb-label" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        ...{ onInput: (...[$event]) => {
                if (!(__VLS_ctx.store.phase === 'input'))
                    return;
                __VLS_ctx.store.scheduleAutosave();
                // @ts-ignore
                [store, store, store, shenlunNodeTitle,];
            } },
        value: (__VLS_ctx.store.questionText),
        ...{ class: "wb-textarea wb-textarea--question" },
        placeholder: "粘贴题目要求，例如：根据材料，概括…存在的主要问题。",
    });
    /** @type {__VLS_StyleScopedClasses['wb-textarea']} */ ;
    /** @type {__VLS_StyleScopedClasses['wb-textarea--question']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "wb-section" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "wb-label" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        ...{ onInput: (...[$event]) => {
                if (!(__VLS_ctx.store.phase === 'input'))
                    return;
                __VLS_ctx.store.scheduleAutosave();
                // @ts-ignore
                [store, store,];
            } },
        value: (__VLS_ctx.store.materialText),
        ...{ class: "wb-textarea wb-textarea--material" },
        placeholder: "粘贴完整材料文本",
    });
    /** @type {__VLS_StyleScopedClasses['wb-textarea']} */ ;
    /** @type {__VLS_StyleScopedClasses['wb-textarea--material']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "wb-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.handleFormat) },
        ...{ class: "btn btn-primary" },
        disabled: (!__VLS_ctx.store.questionText.trim() || !__VLS_ctx.store.materialText.trim() || __VLS_ctx.store.attemptLoading),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.store.attemptLoading ? '分段中…' : '一键分段 →');
    if (__VLS_ctx.store.attemptError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "wb-error" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-error']} */ ;
        (__VLS_ctx.store.attemptError);
    }
}
else if (__VLS_ctx.store.phase === 'formatted') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "wb-section wb-section--question-preview" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-section']} */ ;
    /** @type {__VLS_StyleScopedClasses['wb-section--question-preview']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "wb-q-row" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-q-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "wb-label" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.handleResetInput) },
        ...{ class: "btn-link" },
        type: "button",
    });
    /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "wb-question-text" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-question-text']} */ ;
    (__VLS_ctx.store.questionText);
    if (__VLS_ctx.store.attempt?.cc_status === 'success' &&
        __VLS_ctx.store.attempt &&
        !__VLS_ctx.store.attempt.id.startsWith('local-')) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "wb-done-hint" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-done-hint']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.goResultReview) },
            type: "button",
            ...{ class: "btn-link" },
        });
        /** @type {__VLS_StyleScopedClasses['btn-link']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "wb-seg-tabrail" },
        'aria-label': "段落切换",
    });
    /** @type {__VLS_StyleScopedClasses['wb-seg-tabrail']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "wb-seg-tabscroll" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-seg-tabscroll']} */ ;
    for (const [seg] of __VLS_vFor((__VLS_ctx.store.segments))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.store.phase === 'input'))
                        return;
                    if (!(__VLS_ctx.store.phase === 'formatted'))
                        return;
                    __VLS_ctx.activeParagraph = seg.index;
                    // @ts-ignore
                    [store, store, store, store, store, store, store, store, store, store, store, store, store, handleFormat, handleResetInput, goResultReview, activeParagraph,];
                } },
            key: (seg.index),
            type: "button",
            ...{ class: "wb-seg-tab" },
            ...{ class: ({ active: __VLS_ctx.activeParagraph === seg.index }) },
        });
        /** @type {__VLS_StyleScopedClasses['wb-seg-tab']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        (seg.index + 1);
        // @ts-ignore
        [activeParagraph,];
    }
    if (__VLS_ctx.currentSeg) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "wb-segments" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-segments']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "wb-segment" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-segment']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "wb-segment-header" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-segment-header']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "wb-segment-num" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-segment-num']} */ ;
        (__VLS_ctx.currentSeg.index + 1);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "wb-segment-body" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-segment-body']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "wb-material-block" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-material-block']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "wb-material-text" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-material-text']} */ ;
        (__VLS_ctx.currentSeg.source_text);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "wb-extraction-stack" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-extraction-stack']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "wb-extraction-block" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-extraction-block']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "wb-label wb-label--small" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-label']} */ ;
        /** @type {__VLS_StyleScopedClasses['wb-label--small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            ...{ onInput: (...[$event]) => {
                    if (!!(__VLS_ctx.store.phase === 'input'))
                        return;
                    if (!(__VLS_ctx.store.phase === 'formatted'))
                        return;
                    if (!(__VLS_ctx.currentSeg))
                        return;
                    __VLS_ctx.store.updateExtraction(__VLS_ctx.currentSeg.index, $event.target.value);
                    // @ts-ignore
                    [store, currentSeg, currentSeg, currentSeg, currentSeg,];
                } },
            value: (__VLS_ctx.currentSeg.my_extraction),
            ...{ class: "wb-textarea wb-textarea--extraction" },
            placeholder: "从该段材料中提炼要点，逐条写出",
        });
        /** @type {__VLS_StyleScopedClasses['wb-textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['wb-textarea--extraction']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "wb-summary-block" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-summary-block']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "wb-label wb-label--small" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-label']} */ ;
        /** @type {__VLS_StyleScopedClasses['wb-label--small']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "wb-inline-hint" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-inline-hint']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
            value: (__VLS_ctx.finalSummaryModel),
            ...{ class: "wb-textarea wb-textarea--summary" },
            placeholder: "综合各段，写出本条题目的最终归纳结论",
        });
        /** @type {__VLS_StyleScopedClasses['wb-textarea']} */ ;
        /** @type {__VLS_StyleScopedClasses['wb-textarea--summary']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "wb-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.handleGeneratePrompt) },
        ...{ class: "btn btn-primary" },
        disabled: (!__VLS_ctx.store.canGoToCC || __VLS_ctx.store.attemptLoading),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.store.attemptLoading ? '生成中…' : '生成 AI 提示词 →');
    if (!__VLS_ctx.store.canGoToCC) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "wb-hint" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-hint']} */ ;
    }
    if (__VLS_ctx.store.attemptError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "wb-error" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-error']} */ ;
        (__VLS_ctx.store.attemptError);
    }
}
else if (__VLS_ctx.store.phase === 'cc_prompt') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cc-banner" },
    });
    /** @type {__VLS_StyleScopedClasses['cc-banner']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "cc-banner-title" },
    });
    /** @type {__VLS_StyleScopedClasses['cc-banner-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "cc-banner-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['cc-banner-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cc-fenbi-embed" },
    });
    /** @type {__VLS_StyleScopedClasses['cc-fenbi-embed']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "cc-fenbi-embed-label" },
        for: "cc-fenbi-textarea",
    });
    /** @type {__VLS_StyleScopedClasses['cc-fenbi-embed-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "wb-optional-tag" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-optional-tag']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "cc-fenbi-hint cc-fenbi-hint--embed" },
    });
    /** @type {__VLS_StyleScopedClasses['cc-fenbi-hint']} */ ;
    /** @type {__VLS_StyleScopedClasses['cc-fenbi-hint--embed']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        id: "cc-fenbi-textarea",
        value: (__VLS_ctx.fenbiReferenceText),
        ...{ class: "wb-textarea wb-textarea--fenbi" },
        placeholder: "可选：粘贴粉笔等机构给出的本题参考答案或要点…",
    });
    /** @type {__VLS_StyleScopedClasses['wb-textarea']} */ ;
    /** @type {__VLS_StyleScopedClasses['wb-textarea--fenbi']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "wb-section" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cc-label-row" },
    });
    /** @type {__VLS_StyleScopedClasses['cc-label-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "wb-label" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.copyPrompt) },
        ...{ class: "btn btn-copy" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-copy']} */ ;
    (__VLS_ctx.copied ? '✓ 已复制' : '复制全部');
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        id: "cc-prompt-textarea",
        ...{ class: "wb-textarea wb-textarea--prompt" },
        value: (__VLS_ctx.ccPromptDisplayText),
        readonly: true,
    });
    /** @type {__VLS_StyleScopedClasses['wb-textarea']} */ ;
    /** @type {__VLS_StyleScopedClasses['wb-textarea--prompt']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "wb-section" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-section']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "wb-label" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        value: (__VLS_ctx.ccPasteText),
        ...{ class: "wb-textarea wb-textarea--paste" },
        placeholder: '\u7c98\u8d34\u0020\u0041\u0049\u0020\u8fd4\u56de\u7684\u0020\u004a\u0053\u004f\u004e\uff0c\u4f8b\u5982\uff1a\u000a\u007b\u000a\u0020\u0020\u0022\u0073\u0065\u0067\u006d\u0065\u006e\u0074\u0073\u0022\u003a\u0020\u005b\u002e\u002e\u002e\u005d\u002c\u000a\u0020\u0020\u0022\u0072\u0065\u0066\u0065\u0072\u0065\u006e\u0063\u0065\u005f\u0066\u0069\u006e\u0061\u006c\u005f\u0073\u0075\u006d\u006d\u0061\u0072\u0079\u0022\u003a\u0020\u0022\u002e\u002e\u002e\u0022\u002c\u000a\u0020\u0020\u0022\u006f\u0076\u0065\u0072\u0061\u006c\u006c\u005f\u0063\u006f\u006d\u006d\u0065\u006e\u0074\u0022\u003a\u0020\u0022\u002e\u002e\u002e\u0022\u002c\u000a\u0020\u0020\u0022\u006f\u0076\u0065\u0072\u0061\u006c\u006c\u005f\u0069\u0073\u0073\u0075\u0065\u005f\u0074\u0061\u0067\u0073\u0022\u003a\u0020\u005b\u002e\u002e\u002e\u005d\u000a\u007d',
    });
    /** @type {__VLS_StyleScopedClasses['wb-textarea']} */ ;
    /** @type {__VLS_StyleScopedClasses['wb-textarea--paste']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "wb-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.store.phase === 'input'))
                    return;
                if (!!(__VLS_ctx.store.phase === 'formatted'))
                    return;
                if (!(__VLS_ctx.store.phase === 'cc_prompt'))
                    return;
                __VLS_ctx.store.phase = 'formatted';
                // @ts-ignore
                [store, store, store, store, store, store, store, store, currentSeg, finalSummaryModel, handleGeneratePrompt, fenbiReferenceText, copyPrompt, copied, ccPromptDisplayText, ccPasteText,];
            } },
        ...{ class: "btn btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.handleSubmitPaste) },
        ...{ class: "btn btn-primary" },
        disabled: (!__VLS_ctx.store.canSubmitPaste || __VLS_ctx.store.ccPasteLoading),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    (__VLS_ctx.store.ccPasteLoading ? '解析中…' : '提交结果 →');
    if (__VLS_ctx.store.ccPasteError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "wb-error" },
        });
        /** @type {__VLS_StyleScopedClasses['wb-error']} */ ;
        (__VLS_ctx.store.ccPasteError);
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "wb-submitted" },
    });
    /** @type {__VLS_StyleScopedClasses['wb-submitted']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
// @ts-ignore
[store, store, store, store, store, handleSubmitPaste,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
