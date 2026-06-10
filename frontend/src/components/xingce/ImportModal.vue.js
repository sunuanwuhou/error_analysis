/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, ref } from 'vue';
import { useXingceStore } from '@/stores/xingceStore';
const emit = defineEmits();
const store = useXingceStore();
const raw = ref('');
const err = ref('');
const importing = ref(false);
/** json：粘贴导出 JSON；text：粉笔等纯文本（尝试按题号切块） */
const mode = ref('json');
/** 粉笔 / 文本：按「行首题号」粗切分为多条 */
function parseFenbiLoose(text) {
    const t = text.trim();
    if (!t.length)
        return [];
    const chunks = t
        .split(/\n(?=\s*\d{1,3}\s*[\.、．]\s*)|(?=\s*第\s*\d+\s*题)/)
        .map(s => s.trim())
        .filter(s => s.length > 10);
    const out = [];
    for (const chunk of chunks) {
        const lines = chunk.split(/\n/).map(l => l.trim()).filter(Boolean);
        const optLines = lines.filter(l => /^[ABCDabcd][\.．、\s]/.test(l));
        const answerLine = lines.find(l => /答案|正确答案/.test(l));
        let answer = '';
        if (answerLine) {
            const m = answerLine.match(/[:：]\s*([ABCDabcd])/i);
            if (m)
                answer = m[1].toUpperCase();
        }
        const questionLines = lines.filter(l => !/^[ABCDabcd][\.．、\s]/.test(l) && !/^(答案|正确答案)/.test(l));
        const question = questionLines.join('\n').trim();
        if (question.length < 5)
            continue;
        out.push({
            question,
            options: optLines.join('\n') || undefined,
            answer: answer || undefined,
            type: '其他',
            subtype: '导入',
        });
    }
    return out;
}
const parsed = computed(() => {
    const t = raw.value.trim();
    if (!t)
        return [];
    if (mode.value === 'text')
        return parseFenbiLoose(t);
    try {
        const data = JSON.parse(t);
        if (Array.isArray(data))
            return data;
        if (Array.isArray(data.errors))
            return data.errors;
        return [];
    }
    catch {
        return [];
    }
});
function normalizeType(v) {
    const s = String(v || '').trim();
    return s || '其他';
}
function normalizeSubtype(v) {
    const s = String(v || '').trim();
    return s || '未分类';
}
function doImport() {
    err.value = '';
    if (!parsed.value.length) {
        err.value =
            mode.value === 'json'
                ? '未识别到 JSON（数组或 { errors: [] }）'
                : '未从文本中解析出题目（尝试换行题号如 1. 或 第1题）';
        return;
    }
    importing.value = true;
    let ok = 0;
    try {
        for (const item of parsed.value) {
            const q = String(item.question || '').trim();
            if (!q)
                continue;
            store.addError({
                question: q,
                type: normalizeType(item.type),
                subtype: normalizeSubtype(item.subtype),
                subSubtype: String(item.subSubtype || '').trim() || undefined,
                options: String(item.options || '').trim() || undefined,
                answer: String(item.answer || '').trim() || undefined,
                myAnswer: String(item.myAnswer || '').trim() || undefined,
                rootReason: String(item.rootReason || item.errorReason || '').trim() || undefined,
                analysis: String(item.analysis || '').trim() || undefined,
                nextAction: String(item.nextAction || '').trim() || undefined,
                status: String(item.status || 'focus'),
                noteNodeId: String(item.noteNodeId || '').trim() || undefined,
                workflowStage: String(item.workflowStage || 'captured'),
            });
            ok++;
        }
    }
    finally {
        importing.value = false;
    }
    emit('imported', ok);
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
/** @type {__VLS_StyleScopedClasses['im-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['im-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['im-btn']} */ ;
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
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('close');
            // @ts-ignore
            [emit,];
        } },
    ...{ class: "im-backdrop" },
});
/** @type {__VLS_StyleScopedClasses['im-backdrop']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "im-modal" },
});
/** @type {__VLS_StyleScopedClasses['im-modal']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "im-header" },
});
/** @type {__VLS_StyleScopedClasses['im-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('close');
            // @ts-ignore
            [emit,];
        } },
    type: "button",
    ...{ class: "im-close" },
});
/** @type {__VLS_StyleScopedClasses['im-close']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "im-body" },
});
/** @type {__VLS_StyleScopedClasses['im-body']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "im-tabs" },
});
/** @type {__VLS_StyleScopedClasses['im-tabs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.mode = 'json';
            // @ts-ignore
            [mode,];
        } },
    type: "button",
    ...{ class: "im-tab" },
    ...{ class: ({ on: __VLS_ctx.mode === 'json' }) },
});
/** @type {__VLS_StyleScopedClasses['im-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['on']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.mode = 'text';
            // @ts-ignore
            [mode, mode,];
        } },
    type: "button",
    ...{ class: "im-tab" },
    ...{ class: ({ on: __VLS_ctx.mode === 'text' }) },
});
/** @type {__VLS_StyleScopedClasses['im-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['on']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (__VLS_ctx.raw),
    ...{ class: "im-text" },
    rows: "12",
    placeholder: (__VLS_ctx.mode === 'json'
        ? '粘贴 JSON：数组，或 { errors: [...] }'
        : '粘贴整卷文本；按行首「1.」「2、」「第3题」尝试切块；选项行以 A. B. 开头；答案行含「答案：A」'),
});
/** @type {__VLS_StyleScopedClasses['im-text']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "im-meta" },
});
/** @type {__VLS_StyleScopedClasses['im-meta']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.parsed.length);
if (__VLS_ctx.err) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "im-err" },
    });
    /** @type {__VLS_StyleScopedClasses['im-err']} */ ;
    (__VLS_ctx.err);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "im-footer" },
});
/** @type {__VLS_StyleScopedClasses['im-footer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('close');
            // @ts-ignore
            [emit, mode, mode, raw, parsed, err, err,];
        } },
    type: "button",
    ...{ class: "im-btn" },
});
/** @type {__VLS_StyleScopedClasses['im-btn']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.doImport) },
    type: "button",
    ...{ class: "im-btn primary" },
    disabled: (__VLS_ctx.importing || __VLS_ctx.parsed.length === 0),
});
/** @type {__VLS_StyleScopedClasses['im-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['primary']} */ ;
(__VLS_ctx.importing ? '导入中…' : `确认导入 ${__VLS_ctx.parsed.length} 条`);
// @ts-ignore
[parsed, parsed, doImport, importing, importing,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
