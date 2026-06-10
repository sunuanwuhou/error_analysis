/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { onBeforeMount } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { readPortalLastModule, savePortalLastModule } from '@/lib/portalPrefs';
const router = useRouter();
const route = useRoute();
onBeforeMount(() => {
    const p = route.query.portal;
    if (p === '1' || p === 'true')
        return;
    const last = readPortalLastModule();
    if (last === 'xingce') {
        void router.replace({ name: 'XingceWorkspace' });
    }
    else if (last === 'xingce_suite') {
        void router.replace({ name: 'XingceSuiteBank' });
    }
    else if (last === 'xingce_bank_drill') {
        void router.replace({ name: 'XingceBankDrill' });
    }
    else if (last === 'shenlun') {
        void router.replace({ name: 'ShenlunHub' });
    }
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['portal-tile']} */ ;
/** @type {__VLS_StyleScopedClasses['portal-tile']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "module-portal" },
});
/** @type {__VLS_StyleScopedClasses['module-portal']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "module-portal-card" },
});
/** @type {__VLS_StyleScopedClasses['module-portal-card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "module-portal-brand" },
});
/** @type {__VLS_StyleScopedClasses['module-portal-brand']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({
    ...{ class: "module-portal-title" },
});
/** @type {__VLS_StyleScopedClasses['module-portal-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "module-portal-desc" },
});
/** @type {__VLS_StyleScopedClasses['module-portal-desc']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "module-portal-actions" },
});
/** @type {__VLS_StyleScopedClasses['module-portal-actions']} */ ;
let __VLS_0;
/** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
RouterLink;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ 'onClick': {} },
    ...{ class: "portal-tile portal-tile--xingce" },
    to: ({ name: 'XingceWorkspace' }),
}));
const __VLS_2 = __VLS_1({
    ...{ 'onClick': {} },
    ...{ class: "portal-tile portal-tile--xingce" },
    to: ({ name: 'XingceWorkspace' }),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
let __VLS_5;
const __VLS_6 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.savePortalLastModule('xingce');
            // @ts-ignore
            [savePortalLastModule,];
        } });
/** @type {__VLS_StyleScopedClasses['portal-tile']} */ ;
/** @type {__VLS_StyleScopedClasses['portal-tile--xingce']} */ ;
const { default: __VLS_7 } = __VLS_3.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "portal-tile-label" },
});
/** @type {__VLS_StyleScopedClasses['portal-tile-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "portal-tile-sub" },
});
/** @type {__VLS_StyleScopedClasses['portal-tile-sub']} */ ;
// @ts-ignore
[];
var __VLS_3;
var __VLS_4;
let __VLS_8;
/** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
RouterLink;
// @ts-ignore
const __VLS_9 = __VLS_asFunctionalComponent1(__VLS_8, new __VLS_8({
    ...{ 'onClick': {} },
    ...{ class: "portal-tile portal-tile--suite" },
    to: ({ name: 'XingceSuiteBank' }),
}));
const __VLS_10 = __VLS_9({
    ...{ 'onClick': {} },
    ...{ class: "portal-tile portal-tile--suite" },
    to: ({ name: 'XingceSuiteBank' }),
}, ...__VLS_functionalComponentArgsRest(__VLS_9));
let __VLS_13;
const __VLS_14 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.savePortalLastModule('xingce_suite');
            // @ts-ignore
            [savePortalLastModule,];
        } });
/** @type {__VLS_StyleScopedClasses['portal-tile']} */ ;
/** @type {__VLS_StyleScopedClasses['portal-tile--suite']} */ ;
const { default: __VLS_15 } = __VLS_11.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "portal-tile-label" },
});
/** @type {__VLS_StyleScopedClasses['portal-tile-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "portal-tile-sub" },
});
/** @type {__VLS_StyleScopedClasses['portal-tile-sub']} */ ;
// @ts-ignore
[];
var __VLS_11;
var __VLS_12;
let __VLS_16;
/** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
RouterLink;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent1(__VLS_16, new __VLS_16({
    ...{ 'onClick': {} },
    ...{ class: "portal-tile portal-tile--bank-drill" },
    to: ({ name: 'XingceBankDrill' }),
}));
const __VLS_18 = __VLS_17({
    ...{ 'onClick': {} },
    ...{ class: "portal-tile portal-tile--bank-drill" },
    to: ({ name: 'XingceBankDrill' }),
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
let __VLS_21;
const __VLS_22 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.savePortalLastModule('xingce_bank_drill');
            // @ts-ignore
            [savePortalLastModule,];
        } });
/** @type {__VLS_StyleScopedClasses['portal-tile']} */ ;
/** @type {__VLS_StyleScopedClasses['portal-tile--bank-drill']} */ ;
const { default: __VLS_23 } = __VLS_19.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "portal-tile-label" },
});
/** @type {__VLS_StyleScopedClasses['portal-tile-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "portal-tile-sub" },
});
/** @type {__VLS_StyleScopedClasses['portal-tile-sub']} */ ;
// @ts-ignore
[];
var __VLS_19;
var __VLS_20;
let __VLS_24;
/** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
RouterLink;
// @ts-ignore
const __VLS_25 = __VLS_asFunctionalComponent1(__VLS_24, new __VLS_24({
    ...{ 'onClick': {} },
    ...{ class: "portal-tile portal-tile--shenlun" },
    to: ({ name: 'ShenlunHub' }),
}));
const __VLS_26 = __VLS_25({
    ...{ 'onClick': {} },
    ...{ class: "portal-tile portal-tile--shenlun" },
    to: ({ name: 'ShenlunHub' }),
}, ...__VLS_functionalComponentArgsRest(__VLS_25));
let __VLS_29;
const __VLS_30 = ({ click: {} },
    { onClick: (...[$event]) => {
            __VLS_ctx.savePortalLastModule('shenlun');
            // @ts-ignore
            [savePortalLastModule,];
        } });
/** @type {__VLS_StyleScopedClasses['portal-tile']} */ ;
/** @type {__VLS_StyleScopedClasses['portal-tile--shenlun']} */ ;
const { default: __VLS_31 } = __VLS_27.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "portal-tile-label" },
});
/** @type {__VLS_StyleScopedClasses['portal-tile-label']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "portal-tile-sub" },
});
/** @type {__VLS_StyleScopedClasses['portal-tile-sub']} */ ;
// @ts-ignore
[];
var __VLS_27;
var __VLS_28;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "module-portal-note" },
});
/** @type {__VLS_StyleScopedClasses['module-portal-note']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
