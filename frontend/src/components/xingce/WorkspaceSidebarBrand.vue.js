/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed } from 'vue';
const runtimeLabel = computed(() => {
    if (typeof window === 'undefined')
        return 'unknown';
    const { hostname, port } = window.location;
    if (hostname === '127.0.0.1' || hostname === 'localhost') {
        return port ? `${hostname}:${port}` : hostname;
    }
    return hostname;
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "wsb" },
});
/** @type {__VLS_StyleScopedClasses['wsb']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "wsb-title" },
});
/** @type {__VLS_StyleScopedClasses['wsb-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "wsb-badge" },
    'data-mode': "local",
});
/** @type {__VLS_StyleScopedClasses['wsb-badge']} */ ;
(__VLS_ctx.runtimeLabel);
// @ts-ignore
[runtimeLabel,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
