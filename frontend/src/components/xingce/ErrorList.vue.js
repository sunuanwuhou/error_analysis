/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, watch } from 'vue';
import { useXingceStore } from '@/stores/xingceStore';
import ErrorGroup from './ErrorGroup.vue';
const props = defineProps();
const store = useXingceStore();
const groups = computed(() => {
    const map = new Map();
    for (const e of props.entries) {
        const key = [e.type, e.subtype].filter(Boolean).join('|');
        if (!map.has(key))
            map.set(key, []);
        map.get(key).push(e);
    }
    return [...map.entries()].map(([key, entries]) => ({ key, entries }));
});
// 每当可见列表变化时，批量加载练习统计
watch(() => props.entries, (list) => {
    const ids = list.slice(0, 120).map(e => e.id);
    store.queuePracticeSummaries(ids);
}, { immediate: true });
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "el" },
});
/** @type {__VLS_StyleScopedClasses['el']} */ ;
if (!__VLS_ctx.entries.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "el-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['el-empty']} */ ;
}
for (const [g] of __VLS_vFor((__VLS_ctx.groups))) {
    const __VLS_0 = ErrorGroup;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        key: (g.key),
        groupKey: (g.key),
        label: (g.key.split('|').filter(Boolean).join(' › ')),
        entries: (g.entries),
        defaultOpen: (__VLS_ctx.groups.length <= 3),
    }));
    const __VLS_2 = __VLS_1({
        key: (g.key),
        groupKey: (g.key),
        label: (g.key.split('|').filter(Boolean).join(' › ')),
        entries: (g.entries),
        defaultOpen: (__VLS_ctx.groups.length <= 3),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    // @ts-ignore
    [entries, groups, groups,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeProps: {},
});
export default {};
