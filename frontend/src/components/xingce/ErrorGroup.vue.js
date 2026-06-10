/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref } from 'vue';
import ErrorCard from './ErrorCard.vue';
const props = defineProps();
const open = ref(props.defaultOpen ?? true);
const renderLimit = ref(30);
const hasMore = () => props.entries.length > renderLimit.value;
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['eg-header']} */ ;
/** @type {__VLS_StyleScopedClasses['eg-more']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "eg" },
});
/** @type {__VLS_StyleScopedClasses['eg']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.open = !__VLS_ctx.open;
            // @ts-ignore
            [open, open,];
        } },
    ...{ class: "eg-header" },
});
/** @type {__VLS_StyleScopedClasses['eg-header']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "eg-arrow" },
});
/** @type {__VLS_StyleScopedClasses['eg-arrow']} */ ;
(__VLS_ctx.open ? '▾' : '▸');
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "eg-label" },
});
/** @type {__VLS_StyleScopedClasses['eg-label']} */ ;
(__VLS_ctx.label);
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "eg-count" },
});
/** @type {__VLS_StyleScopedClasses['eg-count']} */ ;
(__VLS_ctx.entries.length);
if (__VLS_ctx.open) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "eg-body" },
    });
    /** @type {__VLS_StyleScopedClasses['eg-body']} */ ;
    for (const [entry] of __VLS_vFor((__VLS_ctx.entries.slice(0, __VLS_ctx.renderLimit)))) {
        const __VLS_0 = ErrorCard;
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
            key: (entry.id),
            entry: (entry),
        }));
        const __VLS_2 = __VLS_1({
            key: (entry.id),
            entry: (entry),
        }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        // @ts-ignore
        [open, open, label, entries, entries, renderLimit,];
    }
    if (__VLS_ctx.hasMore()) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.open))
                        return;
                    if (!(__VLS_ctx.hasMore()))
                        return;
                    __VLS_ctx.renderLimit += 30;
                    // @ts-ignore
                    [renderLimit, hasMore,];
                } },
            ...{ class: "eg-more" },
        });
        /** @type {__VLS_StyleScopedClasses['eg-more']} */ ;
        (__VLS_ctx.entries.length - __VLS_ctx.renderLimit);
    }
}
// @ts-ignore
[entries, renderLimit,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
