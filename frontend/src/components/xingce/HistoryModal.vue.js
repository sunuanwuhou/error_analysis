/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { onMounted, ref } from 'vue';
import { xingceApi } from '@/api/xingce';
const emit = defineEmits();
const loading = ref(true);
const err = ref('');
const items = ref([]);
function fmtTime(iso) {
    if (!iso)
        return '—';
    try {
        return new Date(iso).toLocaleString('zh-CN', { hour12: false });
    }
    catch {
        return String(iso);
    }
}
function resultLabel(r) {
    const m = {
        correct: '正确',
        wrong: '错误',
        skipped: '跳过',
        partial: '部分正确',
    };
    return r ? (m[r] ?? r) : '—';
}
onMounted(async () => {
    loading.value = true;
    err.value = '';
    try {
        const res = await xingceApi.getPracticeAttempts(200);
        items.value = res.items ?? [];
    }
    catch (e) {
        err.value = String(e);
    }
    finally {
        loading.value = false;
    }
});
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
/** @type {__VLS_StyleScopedClasses['hm-hint']} */ ;
/** @type {__VLS_StyleScopedClasses['hm-result']} */ ;
/** @type {__VLS_StyleScopedClasses['hm-result']} */ ;
/** @type {__VLS_StyleScopedClasses['hm-result']} */ ;
/** @type {__VLS_StyleScopedClasses['hm-result']} */ ;
/** @type {__VLS_StyleScopedClasses['hm-result']} */ ;
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
    ...{ class: "hm-backdrop" },
});
/** @type {__VLS_StyleScopedClasses['hm-backdrop']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onKeydown: (...[$event]) => {
            __VLS_ctx.emit('close');
            // @ts-ignore
            [emit,];
        } },
    ...{ class: "hm-modal" },
    role: "dialog",
    'aria-modal': "true",
});
/** @type {__VLS_StyleScopedClasses['hm-modal']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hm-head" },
});
/** @type {__VLS_StyleScopedClasses['hm-head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "hm-title" },
});
/** @type {__VLS_StyleScopedClasses['hm-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('close');
            // @ts-ignore
            [emit,];
        } },
    type: "button",
    ...{ class: "hm-close" },
    title: "关闭",
});
/** @type {__VLS_StyleScopedClasses['hm-close']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "hm-hint" },
});
/** @type {__VLS_StyleScopedClasses['hm-hint']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "hm-body" },
});
/** @type {__VLS_StyleScopedClasses['hm-body']} */ ;
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "hm-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['hm-empty']} */ ;
}
else if (__VLS_ctx.err) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "hm-empty hm-err" },
    });
    /** @type {__VLS_StyleScopedClasses['hm-empty']} */ ;
    /** @type {__VLS_StyleScopedClasses['hm-err']} */ ;
    (__VLS_ctx.err);
}
else if (!__VLS_ctx.items.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "hm-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['hm-empty']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "hm-list" },
    });
    /** @type {__VLS_StyleScopedClasses['hm-list']} */ ;
    for (const [it] of __VLS_vFor((__VLS_ctx.items))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (it.id),
            ...{ class: "hm-row" },
        });
        /** @type {__VLS_StyleScopedClasses['hm-row']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "hm-row-top" },
        });
        /** @type {__VLS_StyleScopedClasses['hm-row-top']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "hm-time" },
        });
        /** @type {__VLS_StyleScopedClasses['hm-time']} */ ;
        (__VLS_ctx.fmtTime(it.createdAt || it.updatedAt));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "hm-result" },
            ...{ class: ('r-' + (it.result || 'unk')) },
        });
        /** @type {__VLS_StyleScopedClasses['hm-result']} */ ;
        (__VLS_ctx.resultLabel(it.result));
        if (it.durationSec != null) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "hm-dur" },
            });
            /** @type {__VLS_StyleScopedClasses['hm-dur']} */ ;
            (it.durationSec);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "hm-meta" },
        });
        /** @type {__VLS_StyleScopedClasses['hm-meta']} */ ;
        if (it.type || it.subtype) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            ([it.type, it.subtype].filter(Boolean).join(' › '));
        }
        if (it.sessionMode) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "hm-mode" },
            });
            /** @type {__VLS_StyleScopedClasses['hm-mode']} */ ;
            (it.sessionMode);
        }
        if (it.questionText) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "hm-q" },
            });
            /** @type {__VLS_StyleScopedClasses['hm-q']} */ ;
            (String(it.questionText).slice(0, 200));
            (String(it.questionText).length > 200 ? '…' : '');
        }
        // @ts-ignore
        [loading, err, err, items, items, fmtTime, resultLabel,];
    }
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
