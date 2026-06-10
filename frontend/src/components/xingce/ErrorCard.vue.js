/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed } from 'vue';
import { useXingceStore } from '@/stores/xingceStore';
import PracticeModal from './PracticeModal.vue';
const WORKFLOW_OPTIONS = [
    { value: 'captured', label: '待判因' },
    { value: 'diagnosing', label: '判因中' },
    { value: 'review_ready', label: '待复盘' },
    { value: 'retrain_due', label: '待复训' },
    { value: 'mastered', label: '已闭环' },
];
const props = defineProps();
const store = useXingceStore();
const expanded = ref(false);
const confirmDelete = ref(false);
const practicing = ref(false);
function cycleStatus() {
    const next = {
        focus: 'review', review: 'mastered', mastered: 'focus'
    };
    store.updateError(props.entry.id, { status: next[props.entry.status] ?? 'focus' });
}
function cycleMastery() {
    const next = {
        not_mastered: 'fuzzy', fuzzy: 'mastered', mastered: 'not_mastered'
    };
    store.updateError(props.entry.id, {
        masteryLevel: next[props.entry.masteryLevel ?? 'not_mastered']
    });
}
function doDelete() {
    if (!confirmDelete.value) {
        confirmDelete.value = true;
        setTimeout(() => confirmDelete.value = false, 3000);
        return;
    }
    store.deleteError(props.entry.id);
}
const statusMap = {
    focus: { label: '重点复习', cls: 'tag-focus' },
    review: { label: '待复习', cls: 'tag-review' },
    mastered: { label: '已掌握', cls: 'tag-mastered' },
};
const masteryMap = {
    not_mastered: { label: '未掌握', cls: 'mastery-no' },
    fuzzy: { label: '模糊', cls: 'mastery-fuzzy' },
    mastered: { label: '已掌握', cls: 'mastery-yes' },
};
const statusInfo = computed(() => statusMap[props.entry.status] ?? statusMap.focus);
const masteryInfo = computed(() => masteryMap[props.entry.masteryLevel ?? 'not_mastered']);
const knowledgePath = computed(() => [props.entry.type, props.entry.subtype, props.entry.subSubtype].filter(Boolean).join(' › '));
const optionLines = computed(() => props.entry.options ? props.entry.options.split(/\n|\|/).map(s => s.trim()).filter(Boolean) : []);
const problemTypeLabel = {
    cognition: '认知',
    execution: '执行',
    mixed: '混合',
    unknown: '待定',
};
const summary = computed(() => store.practiceSummaries[props.entry.id] ?? null);
/** 对齐旧版 `getErrorWrongCount`：摘要 / quiz / 错题本体字段取最大 */
const wrongCount = computed(() => {
    const s = summary.value;
    const e = props.entry;
    const summaryWrong = Number(s?.recentWrongCount ?? s?.wrongCount ?? 0);
    const quiz = e.quiz;
    const quizWrong = Number(quiz?.wrongCount ?? 0);
    const directWrong = Number(e.recentWrongCount ?? e.wrongCount ?? 0);
    const vals = [summaryWrong, quizWrong, directWrong].filter(v => Number.isFinite(v) && v >= 0).map(v => Math.floor(v));
    return vals.length ? Math.max(...vals) : 0;
});
/** 对齐旧版 `getRecentDurationSeconds` */
const recentDurationSec = computed(() => {
    const s = summary.value;
    const fromSummary = Number(s?.lastDuration ?? 0);
    if (Number.isFinite(fromSummary) && fromSummary > 0)
        return fromSummary;
    const actual = Number(props.entry.actualDurationSec ?? 0);
    if (Number.isFinite(actual) && actual > 0)
        return actual;
    const legacy = Number(props.entry.lastDuration ?? 0);
    return Number.isFinite(legacy) && legacy > 0 ? legacy : 0;
});
const targetDurationSec = computed(() => {
    const t = Number(props.entry.targetDurationSec ?? 0);
    return Number.isFinite(t) && t > 0 ? t : 0;
});
function fmtDuration(sec) {
    if (!sec || sec <= 0)
        return '';
    const s = Math.round(sec);
    if (s < 60)
        return `${s}秒`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r ? `${m}分${r}秒` : `${m}分钟`;
}
function formatPracticeSummaryTime(raw) {
    if (!raw)
        return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime()))
        return String(raw);
    const now = new Date();
    const sameYear = d.getFullYear() === now.getFullYear();
    const dateText = sameYear
        ? `${d.getMonth() + 1}/${d.getDate()}`
        : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
    return `${dateText} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
/** 对齐旧版 `renderPracticeSummaryMeta`（第四条 cyan chip） */
const practiceMetaLine = computed(() => {
    const s = summary.value;
    if (!s)
        return '';
    const resultMap = {
        correct: '正确',
        wrong: '错误',
        skipped: '跳过',
        partial: '部分正确',
    };
    const bits = [];
    if (s.lastResult)
        bits.push(`最近结果 ${resultMap[s.lastResult] ?? s.lastResult}`);
    if (Number(s.recentWrongCount || 0) > 0)
        bits.push(`错 ${Number(s.recentWrongCount)} 次`);
    if (s.lastConfidence)
        bits.push(`信心 ${s.lastConfidence}`);
    if (s.lastDuration)
        bits.push(`上次用时 ${fmtDuration(s.lastDuration)}`);
    if (s.avgDuration)
        bits.push(`平均用时 ${fmtDuration(s.avgDuration)}`);
    if (s.lastTime)
        bits.push(formatPracticeSummaryTime(s.lastTime));
    return bits.join(' / ');
});
const practiceSummaryMetaDisplay = computed(() => {
    if (practiceMetaLine.value)
        return practiceMetaLine.value;
    if (wrongCount.value > 0)
        return `Wrong x${wrongCount.value}`;
    return '';
});
const showPracticeChips = computed(() => wrongCount.value > 0
    || recentDurationSec.value > 0
    || targetDurationSec.value > 0
    || !!practiceMetaLine.value);
function walkLeaves(nodes) {
    const out = [];
    for (const n of nodes) {
        const kids = n.children ?? [];
        if (kids.length)
            out.push(...walkLeaves(kids));
        else
            out.push(n);
    }
    return out;
}
const knowledgeLeaves = computed(() => walkLeaves(store.knowledgeTree));
function leafLabel(n) {
    const p = store.getNodePathText(n.id);
    return p ? `${p} › ${n.title}` : n.title;
}
function onWorkflowChange(ev) {
    const v = ev.target.value;
    store.updateError(props.entry.id, { workflowStage: v });
}
function onMoveNode(ev) {
    const v = ev.target.value;
    store.updateError(props.entry.id, { noteNodeId: v || undefined });
}
function onNoteBlur(ev) {
    store.updateError(props.entry.id, { note: ev.target.value });
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
/** @type {__VLS_StyleScopedClasses['ec-batch-cb']} */ ;
/** @type {__VLS_StyleScopedClasses['ec']} */ ;
/** @type {__VLS_StyleScopedClasses['ec-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['ec-act']} */ ;
/** @type {__VLS_StyleScopedClasses['ec-del']} */ ;
/** @type {__VLS_StyleScopedClasses['ec-section']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "ec" },
    ...{ class: ({ 'ec--expanded': __VLS_ctx.expanded, 'ec--batch': __VLS_ctx.store.batchMode }) },
    'data-error-id': (__VLS_ctx.entry.id),
});
/** @type {__VLS_StyleScopedClasses['ec']} */ ;
/** @type {__VLS_StyleScopedClasses['ec--expanded']} */ ;
/** @type {__VLS_StyleScopedClasses['ec--batch']} */ ;
if (__VLS_ctx.store.batchMode) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ onClick: () => { } },
        ...{ class: "ec-batch-cb" },
    });
    /** @type {__VLS_StyleScopedClasses['ec-batch-cb']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onChange: (...[$event]) => {
                if (!(__VLS_ctx.store.batchMode))
                    return;
                __VLS_ctx.store.toggleBatchSelect(__VLS_ctx.entry.id);
                // @ts-ignore
                [expanded, store, store, store, entry, entry,];
            } },
        type: "checkbox",
        checked: (__VLS_ctx.store.batchSelectedIds.includes(__VLS_ctx.entry.id)),
    });
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "ec-inner" },
});
/** @type {__VLS_StyleScopedClasses['ec-inner']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "ec-tags" },
});
/** @type {__VLS_StyleScopedClasses['ec-tags']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "ec-tag" },
    ...{ class: (__VLS_ctx.statusInfo.cls) },
});
/** @type {__VLS_StyleScopedClasses['ec-tag']} */ ;
(__VLS_ctx.statusInfo.label);
if (__VLS_ctx.entry.subSubtype) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ec-tag tag-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['ec-tag']} */ ;
    /** @type {__VLS_StyleScopedClasses['tag-sub']} */ ;
    (__VLS_ctx.entry.subSubtype);
}
if (__VLS_ctx.knowledgePath) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ec-tag tag-path" },
        title: (__VLS_ctx.knowledgePath),
    });
    /** @type {__VLS_StyleScopedClasses['ec-tag']} */ ;
    /** @type {__VLS_StyleScopedClasses['tag-path']} */ ;
    (__VLS_ctx.knowledgePath);
}
if (__VLS_ctx.entry.problemType && __VLS_ctx.entry.problemType !== 'unknown') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ec-tag tag-pt" },
    });
    /** @type {__VLS_StyleScopedClasses['ec-tag']} */ ;
    /** @type {__VLS_StyleScopedClasses['tag-pt']} */ ;
    (__VLS_ctx.problemTypeLabel[__VLS_ctx.entry.problemType] ?? __VLS_ctx.entry.problemType);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "ec-tag" },
    ...{ class: (__VLS_ctx.masteryInfo.cls) },
});
/** @type {__VLS_StyleScopedClasses['ec-tag']} */ ;
(__VLS_ctx.masteryInfo.label);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "ec-question" },
});
/** @type {__VLS_StyleScopedClasses['ec-question']} */ ;
(__VLS_ctx.entry.question);
if (__VLS_ctx.optionLines.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ec-options" },
    });
    /** @type {__VLS_StyleScopedClasses['ec-options']} */ ;
    for (const [opt, i] of __VLS_vFor((__VLS_ctx.optionLines))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            key: (i),
            ...{ class: "ec-option" },
        });
        /** @type {__VLS_StyleScopedClasses['ec-option']} */ ;
        (opt);
        // @ts-ignore
        [store, entry, entry, entry, entry, entry, entry, entry, entry, statusInfo, statusInfo, knowledgePath, knowledgePath, knowledgePath, problemTypeLabel, masteryInfo, masteryInfo, optionLines, optionLines,];
    }
}
if (__VLS_ctx.showPracticeChips) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ec-practice-chips" },
    });
    /** @type {__VLS_StyleScopedClasses['ec-practice-chips']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ec-pc pc-wrong" },
    });
    /** @type {__VLS_StyleScopedClasses['ec-pc']} */ ;
    /** @type {__VLS_StyleScopedClasses['pc-wrong']} */ ;
    (__VLS_ctx.wrongCount);
    if (__VLS_ctx.fmtDuration(__VLS_ctx.recentDurationSec)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ec-pc pc-time" },
        });
        /** @type {__VLS_StyleScopedClasses['ec-pc']} */ ;
        /** @type {__VLS_StyleScopedClasses['pc-time']} */ ;
        (__VLS_ctx.fmtDuration(__VLS_ctx.recentDurationSec));
    }
    if (__VLS_ctx.fmtDuration(__VLS_ctx.targetDurationSec)) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ec-pc pc-target" },
        });
        /** @type {__VLS_StyleScopedClasses['ec-pc']} */ ;
        /** @type {__VLS_StyleScopedClasses['pc-target']} */ ;
        (__VLS_ctx.fmtDuration(__VLS_ctx.targetDurationSec));
    }
    if (__VLS_ctx.practiceSummaryMetaDisplay) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ec-pc pc-meta" },
        });
        /** @type {__VLS_StyleScopedClasses['ec-pc']} */ ;
        /** @type {__VLS_StyleScopedClasses['pc-meta']} */ ;
        (__VLS_ctx.practiceSummaryMetaDisplay);
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "ec-actions" },
});
/** @type {__VLS_StyleScopedClasses['ec-actions']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.expanded = !__VLS_ctx.expanded;
            // @ts-ignore
            [expanded, expanded, showPracticeChips, wrongCount, fmtDuration, fmtDuration, fmtDuration, fmtDuration, recentDurationSec, recentDurationSec, targetDurationSec, targetDurationSec, practiceSummaryMetaDisplay, practiceSummaryMetaDisplay,];
        } },
    ...{ class: "ec-toggle" },
});
/** @type {__VLS_StyleScopedClasses['ec-toggle']} */ ;
(__VLS_ctx.expanded ? '收起' : '详情');
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.cycleStatus) },
    ...{ class: "ec-act" },
    ...{ class: (__VLS_ctx.statusInfo.cls) },
    title: ('切换：' + __VLS_ctx.statusInfo.label),
});
/** @type {__VLS_StyleScopedClasses['ec-act']} */ ;
(__VLS_ctx.statusInfo.label);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.cycleMastery) },
    ...{ class: "ec-act" },
    ...{ class: (__VLS_ctx.masteryInfo.cls) },
    title: ('切换掌握度：' + __VLS_ctx.masteryInfo.label),
});
/** @type {__VLS_StyleScopedClasses['ec-act']} */ ;
(__VLS_ctx.masteryInfo.label);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.practicing = true;
            // @ts-ignore
            [expanded, statusInfo, statusInfo, statusInfo, masteryInfo, masteryInfo, masteryInfo, cycleStatus, cycleMastery, practicing,];
        } },
    ...{ class: "ec-act tag-sub" },
    ...{ style: {} },
});
/** @type {__VLS_StyleScopedClasses['ec-act']} */ ;
/** @type {__VLS_StyleScopedClasses['tag-sub']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.doDelete) },
    ...{ class: "ec-del" },
    ...{ class: ({ confirm: __VLS_ctx.confirmDelete }) },
});
/** @type {__VLS_StyleScopedClasses['ec-del']} */ ;
/** @type {__VLS_StyleScopedClasses['confirm']} */ ;
(__VLS_ctx.confirmDelete ? '确认?' : '删除');
if (__VLS_ctx.practicing) {
    const __VLS_0 = PracticeModal;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onClose': {} },
        entry: (__VLS_ctx.entry),
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onClose': {} },
        entry: (__VLS_ctx.entry),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.practicing))
                    return;
                __VLS_ctx.practicing = false;
                // @ts-ignore
                [entry, practicing, practicing, doDelete, confirmDelete, confirmDelete,];
            } });
    var __VLS_3;
    var __VLS_4;
}
if (__VLS_ctx.expanded) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ec-detail" },
    });
    /** @type {__VLS_StyleScopedClasses['ec-detail']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ec-pills" },
    });
    /** @type {__VLS_StyleScopedClasses['ec-pills']} */ ;
    if (__VLS_ctx.entry.myAnswer) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ec-pill pill-wrong" },
        });
        /** @type {__VLS_StyleScopedClasses['ec-pill']} */ ;
        /** @type {__VLS_StyleScopedClasses['pill-wrong']} */ ;
        (__VLS_ctx.entry.myAnswer);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ec-pill pill-correct" },
    });
    /** @type {__VLS_StyleScopedClasses['ec-pill']} */ ;
    /** @type {__VLS_StyleScopedClasses['pill-correct']} */ ;
    (__VLS_ctx.entry.answer ?? '-');
    if (__VLS_ctx.entry.confidence) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ec-pill pill-meta" },
        });
        /** @type {__VLS_StyleScopedClasses['ec-pill']} */ ;
        /** @type {__VLS_StyleScopedClasses['pill-meta']} */ ;
        (__VLS_ctx.entry.confidence);
    }
    if (__VLS_ctx.entry.actualDurationSec) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ec-pill pill-meta" },
        });
        /** @type {__VLS_StyleScopedClasses['ec-pill']} */ ;
        /** @type {__VLS_StyleScopedClasses['pill-meta']} */ ;
        (__VLS_ctx.entry.actualDurationSec);
    }
    if (__VLS_ctx.entry.targetDurationSec) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ec-pill pill-meta" },
        });
        /** @type {__VLS_StyleScopedClasses['ec-pill']} */ ;
        /** @type {__VLS_StyleScopedClasses['pill-meta']} */ ;
        (__VLS_ctx.entry.targetDurationSec);
    }
    if (__VLS_ctx.entry.errorReason || __VLS_ctx.entry.rootReason) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "ec-section" },
        });
        /** @type {__VLS_StyleScopedClasses['ec-section']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ec-section-label" },
        });
        /** @type {__VLS_StyleScopedClasses['ec-section-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        (__VLS_ctx.entry.errorReason || __VLS_ctx.entry.rootReason);
    }
    if (__VLS_ctx.entry.analysis) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "ec-section" },
        });
        /** @type {__VLS_StyleScopedClasses['ec-section']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ec-section-label" },
        });
        /** @type {__VLS_StyleScopedClasses['ec-section-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "ec-analysis" },
        });
        /** @type {__VLS_StyleScopedClasses['ec-analysis']} */ ;
        (__VLS_ctx.entry.analysis);
    }
    if (__VLS_ctx.entry.tip || __VLS_ctx.entry.nextAction) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "ec-section" },
        });
        /** @type {__VLS_StyleScopedClasses['ec-section']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ec-section-label" },
        });
        /** @type {__VLS_StyleScopedClasses['ec-section-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        (__VLS_ctx.entry.tip || __VLS_ctx.entry.nextAction);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ec-section ec-tools" },
    });
    /** @type {__VLS_StyleScopedClasses['ec-section']} */ ;
    /** @type {__VLS_StyleScopedClasses['ec-tools']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ec-section-label" },
    });
    /** @type {__VLS_StyleScopedClasses['ec-section-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "ec-tool-grid" },
    });
    /** @type {__VLS_StyleScopedClasses['ec-tool-grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ec-mini-label" },
    });
    /** @type {__VLS_StyleScopedClasses['ec-mini-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: (__VLS_ctx.onWorkflowChange) },
        ...{ class: "ec-select" },
        value: (__VLS_ctx.entry.workflowStage || 'captured'),
    });
    /** @type {__VLS_StyleScopedClasses['ec-select']} */ ;
    for (const [w] of __VLS_vFor((__VLS_ctx.WORKFLOW_OPTIONS))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (w.value),
            value: (w.value),
        });
        (w.label);
        // @ts-ignore
        [expanded, entry, entry, entry, entry, entry, entry, entry, entry, entry, entry, entry, entry, entry, entry, entry, entry, entry, entry, entry, entry, onWorkflowChange, WORKFLOW_OPTIONS,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ec-mini-label" },
    });
    /** @type {__VLS_StyleScopedClasses['ec-mini-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
        ...{ onChange: (__VLS_ctx.onMoveNode) },
        ...{ class: "ec-select" },
        value: (__VLS_ctx.entry.noteNodeId || ''),
    });
    /** @type {__VLS_StyleScopedClasses['ec-select']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        value: "",
    });
    for (const [n] of __VLS_vFor((__VLS_ctx.knowledgeLeaves))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            key: (n.id),
            value: (n.id),
        });
        (__VLS_ctx.leafLabel(n));
        // @ts-ignore
        [entry, onMoveNode, knowledgeLeaves, leafLabel,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ec-mini-label" },
    });
    /** @type {__VLS_StyleScopedClasses['ec-mini-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
        ...{ onBlur: (__VLS_ctx.onNoteBlur) },
        ...{ class: "ec-note-input" },
        rows: "2",
        value: (__VLS_ctx.entry.note || ''),
        placeholder: "失焦自动保存",
    });
    /** @type {__VLS_StyleScopedClasses['ec-note-input']} */ ;
}
// @ts-ignore
[entry, onNoteBlur,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
