/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted } from 'vue';
import { useXingceStore } from '@/stores/xingceStore';
import { xingceApi } from '@/api/xingce';
const props = defineProps();
const emit = defineEmits();
const store = useXingceStore();
const phase = ref('loading');
const queue = ref([]);
const idx = ref(0);
const answers = ref([]);
const selected = ref(null);
const startedAt = ref(0);
const saving = ref(false);
const errorMsg = ref('');
const todaySessionId = ref('');
const todayCurrentItemId = ref('');
const todayTotalCount = ref(0);
const todayCompletedCount = ref(0);
const answeredEntryById = ref({});
const TITLE_MAP = {
    daily: '📝 今日复习',
    full: '📚 全量练习',
    review: '🧩 待复盘训练',
    retrain: '🔁 待复训训练',
};
const current = computed(() => queue.value[idx.value] ?? null);
const options = computed(() => {
    const e = current.value;
    if (!e?.options)
        return [];
    return e.options.split(/\n|\|/).map(s => s.trim()).filter(Boolean);
});
const progressPct = computed(() => props.mode === 'daily'
    ? (todayTotalCount.value ? Math.round((todayCompletedCount.value / todayTotalCount.value) * 100) : 0)
    : (queue.value.length ? Math.round((idx.value / queue.value.length) * 100) : 0));
const progressText = computed(() => {
    if (props.mode === 'daily') {
        const cur = Math.min(todayCompletedCount.value + 1, Math.max(todayTotalCount.value, 1));
        return `${cur} / ${todayTotalCount.value || 0}`;
    }
    return `${idx.value + 1} / ${queue.value.length}`;
});
// ── 构建题目队列 ─────────────────────────────────────────────────────────────
async function buildQueue() {
    if (props.mode === 'full') {
        return store.filteredErrors
            .filter(e => e.status !== 'mastered' && e.masteryLevel !== 'mastered')
            .slice(0, 120);
    }
    try {
        if (props.mode === 'daily') {
            const data = await xingceApi.startTodaySession(30);
            const session = data.session;
            todaySessionId.value = String(session.sessionId || '');
            todayCurrentItemId.value = String(session.nextItemId || '');
            todayTotalCount.value = Number(session.totalCount || session.queueSize || 0);
            todayCompletedCount.value = Number(session.completedCount || 0);
            const next = (session.nextQuestion || null);
            if (!next || !next.id)
                return [];
            idx.value = 0;
            return [next];
        }
        if (props.mode === 'review' || props.mode === 'retrain') {
            const data = await xingceApi.getWorkbench(12);
            const key = props.mode === 'review' ? 'reviewQueue' : 'retrainQueue';
            const raw = data[key];
            return resolveIds((raw ?? []).map(i => i.id ?? ''));
        }
    }
    catch {
        // 降级到本地
    }
    return store.errors.filter(e => e.status !== 'mastered').slice(0, 12);
}
function resolveIds(ids) {
    const result = [];
    for (const id of ids) {
        const e = store.errors.find(x => x.id === id);
        if (e)
            result.push(e);
    }
    return result;
}
onMounted(async () => {
    queue.value = await buildQueue();
    if (!queue.value.length) {
        errorMsg.value = '当前暂无需要练习的题目';
        phase.value = 'done';
        return;
    }
    phase.value = 'question';
    startedAt.value = Date.now();
});
// ── 答题阶段 ──────────────────────────────────────────────────────────────────
function selectOption(opt) {
    selected.value = opt;
}
function submitAnswer(skip = false) {
    const e = current.value;
    if (!e)
        return;
    const durationSec = Math.max(1, Math.round((Date.now() - startedAt.value) / 1000));
    const letter = skip ? '' : (selected.value ?? '');
    const correct = !skip && !!e.answer && letter.trim().toUpperCase()[0] === e.answer.trim().toUpperCase()[0];
    if (props.mode === 'daily' && todaySessionId.value) {
        const itemId = todayCurrentItemId.value;
        answeredEntryById.value = { ...answeredEntryById.value, [e.id]: e };
        if (itemId) {
            phase.value = 'loading';
            xingceApi.answerTodaySession(todaySessionId.value, itemId, skip ? false : correct)
                .then(resp => {
                const session = resp.session;
                todayCompletedCount.value = Number(session?.completedCount || (todayCompletedCount.value + 1));
                todayTotalCount.value = Number(session?.totalCount || todayTotalCount.value);
                const nextItemId = String(session?.nextItemId || '');
                const nextQuestion = (session?.nextQuestion || null);
                if (nextItemId && nextQuestion?.id) {
                    todayCurrentItemId.value = nextItemId;
                    queue.value = [nextQuestion];
                    idx.value = 0;
                    selected.value = null;
                    startedAt.value = Date.now();
                    phase.value = 'question';
                }
                else {
                    phase.value = 'review';
                }
            })
                .catch(() => {
                phase.value = 'question';
            });
            return;
        }
    }
    answers.value.push({ id: e.id, userAnswer: letter, correct, skipped: skip, durationSec });
    selected.value = null;
    startedAt.value = Date.now();
    if (idx.value + 1 >= queue.value.length) {
        phase.value = 'review';
    }
    else {
        idx.value++;
    }
}
// ── 回顾阶段 ──────────────────────────────────────────────────────────────────
const reviewItems = computed(() => answers.value.map(a => ({
    answer: a,
    entry: answeredEntryById.value[a.id] || queue.value.find(e => e.id === a.id),
})));
const scoreText = computed(() => {
    const done = answers.value.filter(a => !a.skipped);
    const correct = done.filter(a => a.correct);
    return `${correct.length} / ${done.length} 正确`;
});
// ── 保存 ──────────────────────────────────────────────────────────────────────
async function saveResults() {
    saving.value = true;
    const today = new Date().toISOString().slice(0, 10);
    const realAnswers = answers.value.filter(a => !a.skipped);
    try {
        // 1. 批量记录 attempts
        const items = realAnswers.map(a => {
            const e = queue.value.find(x => x.id === a.id);
            return {
                sessionMode: props.mode === 'full'
                    ? 'full'
                    : props.mode === 'review'
                        ? 'review'
                        : props.mode === 'retrain'
                            ? 'retrain'
                            : 'daily',
                source: `vue_quiz_${props.mode}`,
                questionId: a.id,
                errorId: a.id,
                type: e?.type ?? '',
                subtype: e?.subtype ?? '',
                subSubtype: e?.subSubtype ?? '',
                questionText: e?.question ?? '',
                myAnswer: a.userAnswer,
                correctAnswer: e?.answer ?? '',
                result: a.correct ? 'correct' : 'wrong',
                durationSec: a.durationSec,
                statusTag: e?.status ?? '',
                confidence: a.correct ? 3 : 1,
                solvingNote: e?.note ?? '',
                scratchData: {},
                noteNodeId: e?.noteNodeId ?? '',
                meta: {
                    mistakeType: e?.rootReason ?? e?.errorReason ?? '',
                    triggerPoint: '',
                    correctModel: e?.analysis ?? '',
                    nextAction: a.correct ? '继续复训' : '回看错因与解析',
                },
            };
        });
        if (items.length) {
            await fetch('/api/practice/attempts/batch', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items }),
            });
        }
        // 2. 记录会话汇总
        await fetch('/api/practice/log', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date: today,
                mode: props.mode === 'full' ? 'targeted' : 'daily',
                weaknessTag: '',
                total: realAnswers.length,
                correct: realAnswers.filter(a => a.correct).length,
                errorIds: realAnswers.map(a => a.id),
            }),
        });
        // 3. 更新本地错题状态
        realAnswers.forEach(a => {
            const e = queue.value.find(x => x.id === a.id);
            if (!e)
                return;
            if (a.correct) {
                store.updateError(a.id, { status: 'review', masteryLevel: 'fuzzy' });
            }
            else {
                store.updateError(a.id, { status: 'focus', masteryLevel: 'not_mastered', myAnswer: a.userAnswer });
            }
        });
        // 4. 刷新练习面板与卡片练习摘要
        store.loadPracticePanel();
        const touchedIds = [...new Set(realAnswers.map(a => a.id).filter(Boolean))];
        if (touchedIds.length) {
            store.invalidatePracticeSummaries(touchedIds);
            store.queuePracticeSummaries(touchedIds);
        }
        phase.value = 'done';
    }
    catch (err) {
        console.error('save quiz results failed', err);
        errorMsg.value = '保存失败，请重试';
    }
    finally {
        saving.value = false;
    }
}
function tryClose() {
    if (phase.value === 'question' && answers.value.length > 0) {
        if (!confirm('练习尚未保存，确认关闭？'))
            return;
    }
    if (props.mode === 'daily' && phase.value === 'question' && todaySessionId.value) {
        xingceApi.pauseTodaySession(todaySessionId.value).catch(() => {
            // Ignore pause failure; session still resumable by server state.
        });
    }
    emit('close');
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
/** @type {__VLS_StyleScopedClasses['qm-close']} */ ;
/** @type {__VLS_StyleScopedClasses['qm-option']} */ ;
/** @type {__VLS_StyleScopedClasses['qm-option']} */ ;
/** @type {__VLS_StyleScopedClasses['qm-next']} */ ;
/** @type {__VLS_StyleScopedClasses['qm-next']} */ ;
/** @type {__VLS_StyleScopedClasses['qm-save']} */ ;
/** @type {__VLS_StyleScopedClasses['ri-correct']} */ ;
/** @type {__VLS_StyleScopedClasses['ri-result']} */ ;
/** @type {__VLS_StyleScopedClasses['ri-wrong']} */ ;
/** @type {__VLS_StyleScopedClasses['ri-result']} */ ;
/** @type {__VLS_StyleScopedClasses['ri-skipped']} */ ;
/** @type {__VLS_StyleScopedClasses['ri-result']} */ ;
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
    ...{ onClick: (__VLS_ctx.tryClose) },
    ...{ class: "qm-backdrop" },
});
/** @type {__VLS_StyleScopedClasses['qm-backdrop']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "qm-modal" },
});
/** @type {__VLS_StyleScopedClasses['qm-modal']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "qm-header" },
});
/** @type {__VLS_StyleScopedClasses['qm-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "qm-title" },
});
/** @type {__VLS_StyleScopedClasses['qm-title']} */ ;
(__VLS_ctx.TITLE_MAP[__VLS_ctx.mode]);
if (__VLS_ctx.phase === 'question') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "qm-progress-text" },
    });
    /** @type {__VLS_StyleScopedClasses['qm-progress-text']} */ ;
    (__VLS_ctx.progressText);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.tryClose) },
    ...{ class: "qm-close" },
});
/** @type {__VLS_StyleScopedClasses['qm-close']} */ ;
if (__VLS_ctx.phase === 'question') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "qm-progress-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['qm-progress-bar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "qm-progress-fill" },
        ...{ style: ({ width: __VLS_ctx.progressPct + '%' }) },
    });
    /** @type {__VLS_StyleScopedClasses['qm-progress-fill']} */ ;
}
if (__VLS_ctx.phase === 'loading') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "qm-body qm-center" },
    });
    /** @type {__VLS_StyleScopedClasses['qm-body']} */ ;
    /** @type {__VLS_StyleScopedClasses['qm-center']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "qm-spinner" },
    });
    /** @type {__VLS_StyleScopedClasses['qm-spinner']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
else if (__VLS_ctx.phase === 'question' && __VLS_ctx.current) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "qm-body" },
    });
    /** @type {__VLS_StyleScopedClasses['qm-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "qm-question" },
    });
    /** @type {__VLS_StyleScopedClasses['qm-question']} */ ;
    (__VLS_ctx.current.question);
    if (__VLS_ctx.current.targetDurationSec && Number(__VLS_ctx.current.targetDurationSec) > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "qm-target-hint" },
        });
        /** @type {__VLS_StyleScopedClasses['qm-target-hint']} */ ;
        (Math.round(Number(__VLS_ctx.current.targetDurationSec)));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "qm-options" },
    });
    /** @type {__VLS_StyleScopedClasses['qm-options']} */ ;
    for (const [opt] of __VLS_vFor((__VLS_ctx.options))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.phase === 'loading'))
                        return;
                    if (!(__VLS_ctx.phase === 'question' && __VLS_ctx.current))
                        return;
                    __VLS_ctx.selectOption(opt);
                    // @ts-ignore
                    [tryClose, tryClose, TITLE_MAP, mode, phase, phase, phase, phase, progressText, progressPct, current, current, current, current, current, options, selectOption,];
                } },
            key: (opt),
            ...{ class: "qm-option" },
            ...{ class: ({ selected: __VLS_ctx.selected === opt }) },
        });
        /** @type {__VLS_StyleScopedClasses['qm-option']} */ ;
        /** @type {__VLS_StyleScopedClasses['selected']} */ ;
        (opt);
        // @ts-ignore
        [selected,];
    }
    if (!__VLS_ctx.options.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "qm-no-options" },
        });
        /** @type {__VLS_StyleScopedClasses['qm-no-options']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "qm-yn-row" },
        });
        /** @type {__VLS_StyleScopedClasses['qm-yn-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.phase === 'loading'))
                        return;
                    if (!(__VLS_ctx.phase === 'question' && __VLS_ctx.current))
                        return;
                    if (!(!__VLS_ctx.options.length))
                        return;
                    __VLS_ctx.submitAnswer(false);
                    // @ts-ignore
                    [options, submitAnswer,];
                } },
            ...{ class: "qm-yn-btn yn-correct" },
        });
        /** @type {__VLS_StyleScopedClasses['qm-yn-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['yn-correct']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (() => { __VLS_ctx.selected = 'X'; __VLS_ctx.submitAnswer(false); }) },
            ...{ class: "qm-yn-btn yn-wrong" },
        });
        /** @type {__VLS_StyleScopedClasses['qm-yn-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['yn-wrong']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "qm-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['qm-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.phase === 'loading'))
                    return;
                if (!(__VLS_ctx.phase === 'question' && __VLS_ctx.current))
                    return;
                __VLS_ctx.submitAnswer(true);
                // @ts-ignore
                [selected, submitAnswer, submitAnswer,];
            } },
        ...{ class: "qm-skip" },
    });
    /** @type {__VLS_StyleScopedClasses['qm-skip']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.phase === 'loading'))
                    return;
                if (!(__VLS_ctx.phase === 'question' && __VLS_ctx.current))
                    return;
                __VLS_ctx.submitAnswer(false);
                // @ts-ignore
                [submitAnswer,];
            } },
        ...{ class: "qm-next" },
        disabled: (!__VLS_ctx.selected && !!__VLS_ctx.options.length),
    });
    /** @type {__VLS_StyleScopedClasses['qm-next']} */ ;
    (__VLS_ctx.idx + 1 >= __VLS_ctx.queue.length ? '完成' : '下一题');
}
else if (__VLS_ctx.phase === 'review') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "qm-body" },
    });
    /** @type {__VLS_StyleScopedClasses['qm-body']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "qm-score" },
    });
    /** @type {__VLS_StyleScopedClasses['qm-score']} */ ;
    (__VLS_ctx.scoreText);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "qm-review-list" },
    });
    /** @type {__VLS_StyleScopedClasses['qm-review-list']} */ ;
    for (const [item, i] of __VLS_vFor((__VLS_ctx.reviewItems))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (item.answer.id),
            ...{ class: "qm-review-item" },
            ...{ class: ({ 'ri-correct': item.answer.correct, 'ri-wrong': !item.answer.correct && !item.answer.skipped, 'ri-skipped': item.answer.skipped }) },
        });
        /** @type {__VLS_StyleScopedClasses['qm-review-item']} */ ;
        /** @type {__VLS_StyleScopedClasses['ri-correct']} */ ;
        /** @type {__VLS_StyleScopedClasses['ri-wrong']} */ ;
        /** @type {__VLS_StyleScopedClasses['ri-skipped']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "ri-header" },
        });
        /** @type {__VLS_StyleScopedClasses['ri-header']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ri-num" },
        });
        /** @type {__VLS_StyleScopedClasses['ri-num']} */ ;
        (i + 1);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ri-result" },
        });
        /** @type {__VLS_StyleScopedClasses['ri-result']} */ ;
        (item.answer.skipped ? '跳过' : item.answer.correct ? '✓ 正确' : '✗ 错误');
        if (item.entry?.answer) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ri-answer" },
            });
            /** @type {__VLS_StyleScopedClasses['ri-answer']} */ ;
            (item.entry.answer);
        }
        if (item.answer.userAnswer) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ri-my-answer" },
            });
            /** @type {__VLS_StyleScopedClasses['ri-my-answer']} */ ;
            (item.answer.userAnswer);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "ri-question" },
        });
        /** @type {__VLS_StyleScopedClasses['ri-question']} */ ;
        (item.entry?.question);
        if (item.entry?.analysis) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "ri-analysis" },
            });
            /** @type {__VLS_StyleScopedClasses['ri-analysis']} */ ;
            (item.entry.analysis);
        }
        // @ts-ignore
        [phase, options, selected, idx, queue, scoreText, reviewItems,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "qm-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['qm-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.saveResults) },
        ...{ class: "qm-save" },
        disabled: (__VLS_ctx.saving),
    });
    /** @type {__VLS_StyleScopedClasses['qm-save']} */ ;
    (__VLS_ctx.saving ? '保存中…' : '保存结果');
}
else if (__VLS_ctx.phase === 'done') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "qm-body qm-center" },
    });
    /** @type {__VLS_StyleScopedClasses['qm-body']} */ ;
    /** @type {__VLS_StyleScopedClasses['qm-center']} */ ;
    if (__VLS_ctx.errorMsg) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "qm-error" },
        });
        /** @type {__VLS_StyleScopedClasses['qm-error']} */ ;
        (__VLS_ctx.errorMsg);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "qm-done-msg" },
        });
        /** @type {__VLS_StyleScopedClasses['qm-done-msg']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.phase === 'loading'))
                    return;
                if (!!(__VLS_ctx.phase === 'question' && __VLS_ctx.current))
                    return;
                if (!!(__VLS_ctx.phase === 'review'))
                    return;
                if (!(__VLS_ctx.phase === 'done'))
                    return;
                __VLS_ctx.emit('close');
                // @ts-ignore
                [phase, saveResults, saving, saving, errorMsg, errorMsg, emit,];
            } },
        ...{ class: "qm-next" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['qm-next']} */ ;
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
