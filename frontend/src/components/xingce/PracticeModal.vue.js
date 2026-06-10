/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed } from 'vue';
import { xingceApi } from '@/api/xingce';
import { useXingceStore } from '@/stores/xingceStore';
const props = defineProps();
const emit = defineEmits();
const store = useXingceStore();
const selected = ref(null);
const submitted = ref(false);
const saving = ref(false);
const startTime = Date.now();
const options = computed(() => props.entry.options
    ? props.entry.options.split(/\n|\|/).map(s => s.trim()).filter(Boolean)
    : ['A', 'B', 'C', 'D']);
const isCorrect = computed(() => selected.value === props.entry.answer);
async function submit() {
    if (!selected.value || submitted.value)
        return;
    submitted.value = true;
    saving.value = true;
    const durationSec = Math.round((Date.now() - startTime) / 1000);
    try {
        await xingceApi.logAttempt({
            errorId: props.entry.id,
            correct: isCorrect.value,
            durationSec,
        });
        store.invalidatePracticeSummaries([props.entry.id]);
        store.queuePracticeSummaries([props.entry.id]);
        // 更新掌握度
        if (isCorrect.value) {
            const next = {
                not_mastered: 'fuzzy', fuzzy: 'mastered', mastered: 'mastered'
            };
            store.updateError(props.entry.id, {
                masteryLevel: next[props.entry.masteryLevel ?? 'not_mastered'],
                actualDurationSec: durationSec,
            });
        }
        else {
            store.updateError(props.entry.id, {
                masteryLevel: 'not_mastered',
                actualDurationSec: durationSec,
            });
        }
    }
    catch { /* 静默失败，不影响 UI */ }
    saving.value = false;
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
/** @type {__VLS_StyleScopedClasses['pm-opt']} */ ;
/** @type {__VLS_StyleScopedClasses['pm-opt']} */ ;
/** @type {__VLS_StyleScopedClasses['pm-opt']} */ ;
/** @type {__VLS_StyleScopedClasses['pm-opt']} */ ;
/** @type {__VLS_StyleScopedClasses['pm-opt']} */ ;
/** @type {__VLS_StyleScopedClasses['pm-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['pm-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['pm-verdict']} */ ;
/** @type {__VLS_StyleScopedClasses['pm-verdict']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('close');
            // @ts-ignore
            [emit,];
        } },
    ...{ class: "pm-overlay" },
});
/** @type {__VLS_StyleScopedClasses['pm-overlay']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pm" },
});
/** @type {__VLS_StyleScopedClasses['pm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pm-header" },
});
/** @type {__VLS_StyleScopedClasses['pm-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "pm-type" },
});
/** @type {__VLS_StyleScopedClasses['pm-type']} */ ;
(__VLS_ctx.entry.type);
(__VLS_ctx.entry.subtype);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('close');
            // @ts-ignore
            [emit, entry, entry,];
        } },
    ...{ class: "pm-close" },
});
/** @type {__VLS_StyleScopedClasses['pm-close']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pm-question" },
});
/** @type {__VLS_StyleScopedClasses['pm-question']} */ ;
(__VLS_ctx.entry.question);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "pm-options" },
});
/** @type {__VLS_StyleScopedClasses['pm-options']} */ ;
for (const [opt, i] of __VLS_vFor((__VLS_ctx.options))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.selected = String.fromCharCode(65 + i);
                // @ts-ignore
                [entry, options, selected,];
            } },
        key: (i),
        ...{ class: "pm-opt" },
        ...{ class: ({
                selected: __VLS_ctx.selected === String.fromCharCode(65 + i) && !__VLS_ctx.submitted,
                correct: __VLS_ctx.submitted && String.fromCharCode(65 + i) === __VLS_ctx.entry.answer,
                wrong: __VLS_ctx.submitted && __VLS_ctx.selected === String.fromCharCode(65 + i) && !__VLS_ctx.isCorrect,
            }) },
        disabled: (__VLS_ctx.submitted),
    });
    /** @type {__VLS_StyleScopedClasses['pm-opt']} */ ;
    /** @type {__VLS_StyleScopedClasses['selected']} */ ;
    /** @type {__VLS_StyleScopedClasses['correct']} */ ;
    /** @type {__VLS_StyleScopedClasses['wrong']} */ ;
    (opt);
    // @ts-ignore
    [entry, selected, selected, submitted, submitted, submitted, submitted, isCorrect,];
}
if (!__VLS_ctx.submitted) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pm-footer" },
    });
    /** @type {__VLS_StyleScopedClasses['pm-footer']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.submit) },
        ...{ class: "pm-btn primary" },
        disabled: (!__VLS_ctx.selected),
    });
    /** @type {__VLS_StyleScopedClasses['pm-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.submitted))
                    return;
                __VLS_ctx.emit('close');
                // @ts-ignore
                [emit, selected, submitted, submit,];
            } },
        ...{ class: "pm-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['pm-btn']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pm-result" },
    });
    /** @type {__VLS_StyleScopedClasses['pm-result']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "pm-verdict" },
        ...{ class: (__VLS_ctx.isCorrect ? 'ok' : 'fail') },
    });
    /** @type {__VLS_StyleScopedClasses['pm-verdict']} */ ;
    (__VLS_ctx.isCorrect ? '✓ 正确' : '✕ 错误，正确答案：' + __VLS_ctx.entry.answer);
    if (__VLS_ctx.entry.analysis) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "pm-analysis" },
        });
        /** @type {__VLS_StyleScopedClasses['pm-analysis']} */ ;
        (__VLS_ctx.entry.analysis);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(!__VLS_ctx.submitted))
                    return;
                __VLS_ctx.emit('close');
                // @ts-ignore
                [emit, entry, entry, entry, isCorrect, isCorrect,];
            } },
        ...{ class: "pm-btn primary" },
    });
    /** @type {__VLS_StyleScopedClasses['pm-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['primary']} */ ;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
