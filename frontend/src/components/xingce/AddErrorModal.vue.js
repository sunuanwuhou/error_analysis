/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { reactive, ref, computed } from 'vue';
import { useXingceStore } from '@/stores/xingceStore';
const emit = defineEmits();
const store = useXingceStore();
const TYPES = ['言语理解与表达', '判断推理', '数量关系', '资料分析', '常识判断', '其他'];
const STATUS_OPTIONS = [
    { value: 'focus', label: '重点复习' },
    { value: 'review', label: '待复习' },
    { value: 'mastered', label: '已掌握' },
];
const form = reactive({
    type: '言语理解与表达',
    subtype: '',
    subSubtype: '',
    question: '',
    options: '',
    answer: '',
    myAnswer: '',
    rootReason: '',
    analysis: '',
    nextAction: '',
    status: 'focus',
    actualDurationSec: '',
    targetDurationSec: '',
    noteNodeId: '',
});
const submitting = ref(false);
const errMsg = ref('');
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
function validate() {
    if (!form.question.trim())
        return '题目不能为空';
    if (!form.subtype.trim())
        return '模块（2级）不能为空';
    return null;
}
function submit() {
    const err = validate();
    if (err) {
        errMsg.value = err;
        return;
    }
    errMsg.value = '';
    submitting.value = true;
    try {
        store.addError({
            type: form.type.trim(),
            subtype: form.subtype.trim(),
            subSubtype: form.subSubtype.trim() || undefined,
            question: form.question.trim(),
            options: form.options.trim() || undefined,
            answer: form.answer.trim() || undefined,
            myAnswer: form.myAnswer.trim() || undefined,
            rootReason: form.rootReason.trim() || undefined,
            analysis: form.analysis.trim() || undefined,
            nextAction: form.nextAction.trim() || undefined,
            status: form.status,
            actualDurationSec: form.actualDurationSec ? Number(form.actualDurationSec) : undefined,
            targetDurationSec: form.targetDurationSec ? Number(form.targetDurationSec) : undefined,
            noteNodeId: form.noteNodeId.trim() || undefined,
            workflowStage: 'captured',
        });
        emit('added');
        emit('close');
    }
    catch (e) {
        errMsg.value = String(e);
    }
    finally {
        submitting.value = false;
    }
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
/** @type {__VLS_StyleScopedClasses['am-close']} */ ;
/** @type {__VLS_StyleScopedClasses['am-input']} */ ;
/** @type {__VLS_StyleScopedClasses['am-select']} */ ;
/** @type {__VLS_StyleScopedClasses['am-textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['am-textarea']} */ ;
/** @type {__VLS_StyleScopedClasses['am-field']} */ ;
/** @type {__VLS_StyleScopedClasses['am-field']} */ ;
/** @type {__VLS_StyleScopedClasses['am-cancel']} */ ;
/** @type {__VLS_StyleScopedClasses['am-submit']} */ ;
/** @type {__VLS_StyleScopedClasses['am-submit']} */ ;
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
    ...{ class: "am-backdrop" },
});
/** @type {__VLS_StyleScopedClasses['am-backdrop']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-modal" },
});
/** @type {__VLS_StyleScopedClasses['am-modal']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-header" },
});
/** @type {__VLS_StyleScopedClasses['am-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "am-title" },
});
/** @type {__VLS_StyleScopedClasses['am-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('close');
            // @ts-ignore
            [emit,];
        } },
    ...{ class: "am-close" },
});
/** @type {__VLS_StyleScopedClasses['am-close']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-body" },
});
/** @type {__VLS_StyleScopedClasses['am-body']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-row am-row-3col" },
});
/** @type {__VLS_StyleScopedClasses['am-row']} */ ;
/** @type {__VLS_StyleScopedClasses['am-row-3col']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-field" },
});
/** @type {__VLS_StyleScopedClasses['am-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "am-label" },
});
/** @type {__VLS_StyleScopedClasses['am-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "req" },
});
/** @type {__VLS_StyleScopedClasses['req']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.form.type),
    ...{ class: "am-select" },
});
/** @type {__VLS_StyleScopedClasses['am-select']} */ ;
for (const [t] of __VLS_vFor((__VLS_ctx.TYPES))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (t),
    });
    (t);
    // @ts-ignore
    [form, TYPES,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-field" },
});
/** @type {__VLS_StyleScopedClasses['am-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "am-label" },
});
/** @type {__VLS_StyleScopedClasses['am-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "req" },
});
/** @type {__VLS_StyleScopedClasses['req']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "am-input" },
    placeholder: "如：逻辑判断",
});
(__VLS_ctx.form.subtype);
/** @type {__VLS_StyleScopedClasses['am-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-field" },
});
/** @type {__VLS_StyleScopedClasses['am-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "am-label" },
});
/** @type {__VLS_StyleScopedClasses['am-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "am-input" },
    placeholder: "如：必然推理",
});
(__VLS_ctx.form.subSubtype);
/** @type {__VLS_StyleScopedClasses['am-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-field" },
});
/** @type {__VLS_StyleScopedClasses['am-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "am-label" },
});
/** @type {__VLS_StyleScopedClasses['am-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "req" },
});
/** @type {__VLS_StyleScopedClasses['req']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (__VLS_ctx.form.question),
    ...{ class: "am-textarea" },
    rows: "4",
    placeholder: "请输入题目正文",
});
/** @type {__VLS_StyleScopedClasses['am-textarea']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-field" },
});
/** @type {__VLS_StyleScopedClasses['am-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "am-label" },
});
/** @type {__VLS_StyleScopedClasses['am-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (__VLS_ctx.form.options),
    ...{ class: "am-textarea" },
    rows: "3",
    placeholder: "A. 选项一&#10;B. 选项二&#10;C. 选项三&#10;D. 选项四",
});
/** @type {__VLS_StyleScopedClasses['am-textarea']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-row am-row-2col" },
});
/** @type {__VLS_StyleScopedClasses['am-row']} */ ;
/** @type {__VLS_StyleScopedClasses['am-row-2col']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-field" },
});
/** @type {__VLS_StyleScopedClasses['am-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "am-label" },
});
/** @type {__VLS_StyleScopedClasses['am-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "am-input" },
    placeholder: "如：A",
});
(__VLS_ctx.form.answer);
/** @type {__VLS_StyleScopedClasses['am-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-field" },
});
/** @type {__VLS_StyleScopedClasses['am-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "am-label" },
});
/** @type {__VLS_StyleScopedClasses['am-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "am-input" },
    placeholder: "如：B",
});
(__VLS_ctx.form.myAnswer);
/** @type {__VLS_StyleScopedClasses['am-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-field" },
});
/** @type {__VLS_StyleScopedClasses['am-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "am-label" },
});
/** @type {__VLS_StyleScopedClasses['am-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "am-input" },
    placeholder: "如：粗心看错题目",
});
(__VLS_ctx.form.rootReason);
/** @type {__VLS_StyleScopedClasses['am-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-field" },
});
/** @type {__VLS_StyleScopedClasses['am-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "am-label" },
});
/** @type {__VLS_StyleScopedClasses['am-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.textarea)({
    value: (__VLS_ctx.form.analysis),
    ...{ class: "am-textarea" },
    rows: "3",
    placeholder: "解析内容…",
});
/** @type {__VLS_StyleScopedClasses['am-textarea']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-field" },
});
/** @type {__VLS_StyleScopedClasses['am-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "am-label" },
});
/** @type {__VLS_StyleScopedClasses['am-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "am-input" },
    placeholder: "如：回看公式",
});
(__VLS_ctx.form.nextAction);
/** @type {__VLS_StyleScopedClasses['am-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-field" },
});
/** @type {__VLS_StyleScopedClasses['am-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "am-label" },
});
/** @type {__VLS_StyleScopedClasses['am-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.form.noteNodeId),
    ...{ class: "am-select" },
});
/** @type {__VLS_StyleScopedClasses['am-select']} */ ;
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
    [form, form, form, form, form, form, form, form, form, form, knowledgeLeaves, leafLabel,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-row am-row-3col" },
});
/** @type {__VLS_StyleScopedClasses['am-row']} */ ;
/** @type {__VLS_StyleScopedClasses['am-row-3col']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-field" },
});
/** @type {__VLS_StyleScopedClasses['am-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "am-label" },
});
/** @type {__VLS_StyleScopedClasses['am-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.form.status),
    ...{ class: "am-select" },
});
/** @type {__VLS_StyleScopedClasses['am-select']} */ ;
for (const [s] of __VLS_vFor((__VLS_ctx.STATUS_OPTIONS))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
        key: (s.value),
        value: (s.value),
    });
    (s.label);
    // @ts-ignore
    [form, STATUS_OPTIONS,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-field" },
});
/** @type {__VLS_StyleScopedClasses['am-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "am-label" },
});
/** @type {__VLS_StyleScopedClasses['am-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "am-input" },
    type: "number",
    min: "0",
    placeholder: "如：90",
});
(__VLS_ctx.form.actualDurationSec);
/** @type {__VLS_StyleScopedClasses['am-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-field" },
});
/** @type {__VLS_StyleScopedClasses['am-field']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "am-label" },
});
/** @type {__VLS_StyleScopedClasses['am-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ class: "am-input" },
    type: "number",
    min: "0",
    placeholder: "如：60",
});
(__VLS_ctx.form.targetDurationSec);
/** @type {__VLS_StyleScopedClasses['am-input']} */ ;
if (__VLS_ctx.errMsg) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "am-err" },
    });
    /** @type {__VLS_StyleScopedClasses['am-err']} */ ;
    (__VLS_ctx.errMsg);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "am-footer" },
});
/** @type {__VLS_StyleScopedClasses['am-footer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('close');
            // @ts-ignore
            [emit, form, form, errMsg, errMsg,];
        } },
    ...{ class: "am-cancel" },
});
/** @type {__VLS_StyleScopedClasses['am-cancel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.submit) },
    ...{ class: "am-submit" },
    disabled: (__VLS_ctx.submitting),
});
/** @type {__VLS_StyleScopedClasses['am-submit']} */ ;
(__VLS_ctx.submitting ? '保存中…' : '添加错题');
// @ts-ignore
[submit, submitting, submitting,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
