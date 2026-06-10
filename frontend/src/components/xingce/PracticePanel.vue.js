/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useXingceStore } from '@/stores/xingceStore';
import { xingceApi } from '@/api/xingce';
import MoreMenu from './MoreMenu.vue';
const store = useXingceStore();
const router = useRouter();
onMounted(() => {
    store.loadMe();
    store.loadPracticePanel();
});
const progressText = computed(() => {
    const done = store.todayDone || 0;
    const total = store.todayTotal || 0;
    return `${done}/${total}`;
});
const progressPct = computed(() => {
    const total = store.todayTotal || 0;
    if (!total)
        return 0;
    return Math.max(0, Math.min(100, Math.round(((store.todayDone || 0) / total) * 100)));
});
const dailyBadge = computed(() => store.quizBadge || 0);
const fullBadge = computed(() => store.eligibleFullPracticeCount);
const cloudDetailsExpanded = ref(false);
function toggleCloudDetails() {
    cloudDetailsExpanded.value = !cloudDetailsExpanded.value;
}
const cloudUserLabel = computed(() => {
    const u = store.currentUser?.username;
    return u ? `Cloud: ${u}` : 'Cloud: offline';
});
const cloudSyncBadgeClass = computed(() => {
    if (store.saving)
        return 'saving';
    if (store.loadError)
        return 'error';
    return 'idle';
});
const cloudSyncBadgeText = computed(() => {
    if (store.saving)
        return '保存中';
    if (store.loadError)
        return '错误';
    return 'idle';
});
function fmtLocalTime(iso) {
    if (!iso)
        return '—';
    try {
        return new Date(iso).toLocaleString('zh-CN', { hour12: false });
    }
    catch {
        return String(iso);
    }
}
const emit = defineEmits();
function goModuleHome() {
    window.location.href = '/new/?portal=1';
}
function goStudyHome() {
    void router.push({ name: 'XingceWorkspace' });
}
function goShenlunWorkbench() {
    window.location.href = '/new/shenlun';
}
async function logout() {
    if (!confirm('确定退出登录？'))
        return;
    try {
        await xingceApi.logout();
    }
    catch { /* ignore */ }
    window.location.href = '/login.html';
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
if (!__VLS_ctx.store.knowledgeFocusMode) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sidebar-tools" },
    });
    /** @type {__VLS_StyleScopedClasses['sidebar-tools']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sidebar-tools-row sidebar-module-portal-slot" },
    });
    /** @type {__VLS_StyleScopedClasses['sidebar-tools-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['sidebar-module-portal-slot']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.goModuleHome) },
        type: "button",
        ...{ class: "btn btn-module-portal-hero" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-module-portal-hero']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "btn-module-portal-main" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-module-portal-main']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "btn-module-portal-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['btn-module-portal-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sidebar-tools-row workspace-entry-row workspace-submodule-row" },
    });
    /** @type {__VLS_StyleScopedClasses['sidebar-tools-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['workspace-entry-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['workspace-submodule-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        type: "button",
        ...{ class: "btn btn-secondary" },
        disabled: true,
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.goStudyHome) },
        type: "button",
        ...{ class: "btn btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.goShenlunWorkbench) },
        type: "button",
        ...{ class: "btn btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sidebar-tools-row" },
    });
    /** @type {__VLS_StyleScopedClasses['sidebar-tools-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.store.knowledgeFocusMode))
                    return;
                __VLS_ctx.emit('openAdd');
                // @ts-ignore
                [store, goModuleHome, goStudyHome, goShenlunWorkbench, emit,];
            } },
        type: "button",
        ...{ class: "btn btn-primary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.store.knowledgeFocusMode))
                    return;
                __VLS_ctx.emit('openImport');
                // @ts-ignore
                [emit,];
            } },
        type: "button",
        ...{ class: "btn btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    const __VLS_0 = MoreMenu;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onOpenImport': {} },
        ...{ 'onRandomNote': {} },
        ...{ 'onOpenMarkdownEditor': {} },
        ...{ 'onOpenHistory': {} },
        ...{ 'onOpenTypeRules': {} },
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onOpenImport': {} },
        ...{ 'onRandomNote': {} },
        ...{ 'onOpenMarkdownEditor': {} },
        ...{ 'onOpenHistory': {} },
        ...{ 'onOpenTypeRules': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ openImport: {} },
        { onOpenImport: (...[$event]) => {
                if (!(!__VLS_ctx.store.knowledgeFocusMode))
                    return;
                __VLS_ctx.emit('openImport');
                // @ts-ignore
                [emit,];
            } });
    const __VLS_7 = ({ randomNote: {} },
        { onRandomNote: (...[$event]) => {
                if (!(!__VLS_ctx.store.knowledgeFocusMode))
                    return;
                __VLS_ctx.emit('startRandomNote');
                // @ts-ignore
                [emit,];
            } });
    const __VLS_8 = ({ openMarkdownEditor: {} },
        { onOpenMarkdownEditor: (...[$event]) => {
                if (!(!__VLS_ctx.store.knowledgeFocusMode))
                    return;
                __VLS_ctx.emit('openMarkdownEditor');
                // @ts-ignore
                [emit,];
            } });
    const __VLS_9 = ({ openHistory: {} },
        { onOpenHistory: (...[$event]) => {
                if (!(!__VLS_ctx.store.knowledgeFocusMode))
                    return;
                __VLS_ctx.emit('openHistory');
                // @ts-ignore
                [emit,];
            } });
    const __VLS_10 = ({ openTypeRules: {} },
        { onOpenTypeRules: (...[$event]) => {
                if (!(!__VLS_ctx.store.knowledgeFocusMode))
                    return;
                __VLS_ctx.emit('openTypeRules');
                // @ts-ignore
                [emit,];
            } });
    var __VLS_3;
    var __VLS_4;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cloud-controls sidebar-cloud-controls" },
    });
    /** @type {__VLS_StyleScopedClasses['cloud-controls']} */ ;
    /** @type {__VLS_StyleScopedClasses['sidebar-cloud-controls']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cloud-meta" },
    });
    /** @type {__VLS_StyleScopedClasses['cloud-meta']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cloud-status-line" },
    });
    /** @type {__VLS_StyleScopedClasses['cloud-status-line']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ style: {} },
    });
    (__VLS_ctx.cloudUserLabel);
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "cloud-status-badge" },
        ...{ class: (__VLS_ctx.cloudSyncBadgeClass) },
    });
    /** @type {__VLS_StyleScopedClasses['cloud-status-badge']} */ ;
    (__VLS_ctx.cloudSyncBadgeText);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.toggleCloudDetails) },
        type: "button",
        ...{ class: "cloud-details-toggle" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['cloud-details-toggle']} */ ;
    (__VLS_ctx.cloudDetailsExpanded ? '收起' : '详情');
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "cloud-status-hint" },
        ...{ style: {} },
    });
    /** @type {__VLS_StyleScopedClasses['cloud-status-hint']} */ ;
    if (__VLS_ctx.cloudDetailsExpanded) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "cloud-origin-list expanded" },
            ...{ style: {} },
        });
        /** @type {__VLS_StyleScopedClasses['cloud-origin-list']} */ ;
        /** @type {__VLS_StyleScopedClasses['expanded']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (__VLS_ctx.fmtLocalTime(__VLS_ctx.store.lastSavedAt));
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ style: {} },
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (__VLS_ctx.fmtLocalTime(__VLS_ctx.store.lastPulledAt));
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ style: {} },
        });
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ style: {} },
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sidebar-tools-row sidebar-cloud-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['sidebar-tools-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['sidebar-cloud-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.store.knowledgeFocusMode))
                    return;
                __VLS_ctx.store.load();
                // @ts-ignore
                [store, store, store, cloudUserLabel, cloudSyncBadgeClass, cloudSyncBadgeText, toggleCloudDetails, cloudDetailsExpanded, cloudDetailsExpanded, fmtLocalTime, fmtLocalTime,];
            } },
        type: "button",
        ...{ class: "btn btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.store.knowledgeFocusMode))
                    return;
                __VLS_ctx.store.flushSave();
                // @ts-ignore
                [store,];
            } },
        type: "button",
        ...{ class: "btn btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.logout) },
        type: "button",
        ...{ class: "btn btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "quiz-block" },
    });
    /** @type {__VLS_StyleScopedClasses['quiz-block']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.store.knowledgeFocusMode))
                    return;
                __VLS_ctx.emit('startQuiz', 'daily');
                // @ts-ignore
                [emit, logout,];
            } },
        type: "button",
        ...{ class: "quiz-btn" },
    });
    /** @type {__VLS_StyleScopedClasses['quiz-btn']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    (__VLS_ctx.dailyBadge);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.store.knowledgeFocusMode))
                    return;
                __VLS_ctx.emit('startQuiz', 'full');
                // @ts-ignore
                [emit, dailyBadge,];
            } },
        type: "button",
        ...{ class: "quiz-btn full-practice" },
    });
    /** @type {__VLS_StyleScopedClasses['quiz-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['full-practice']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "badge" },
    });
    /** @type {__VLS_StyleScopedClasses['badge']} */ ;
    (__VLS_ctx.fullBadge);
    if (__VLS_ctx.store.reviewBadge > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(!__VLS_ctx.store.knowledgeFocusMode))
                        return;
                    if (!(__VLS_ctx.store.reviewBadge > 0))
                        return;
                    __VLS_ctx.emit('startQuiz', 'review');
                    // @ts-ignore
                    [store, emit, fullBadge,];
                } },
            type: "button",
            ...{ class: "quiz-btn review-queue" },
        });
        /** @type {__VLS_StyleScopedClasses['quiz-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['review-queue']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        (__VLS_ctx.store.reviewBadge);
    }
    if (__VLS_ctx.store.retrainBadge > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(!__VLS_ctx.store.knowledgeFocusMode))
                        return;
                    if (!(__VLS_ctx.store.retrainBadge > 0))
                        return;
                    __VLS_ctx.emit('startQuiz', 'retrain');
                    // @ts-ignore
                    [store, store, emit,];
                } },
            type: "button",
            ...{ class: "quiz-btn retrain-queue" },
        });
        /** @type {__VLS_StyleScopedClasses['quiz-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['retrain-queue']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "badge" },
        });
        /** @type {__VLS_StyleScopedClasses['badge']} */ ;
        (__VLS_ctx.store.retrainBadge);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(!__VLS_ctx.store.knowledgeFocusMode))
                    return;
                __VLS_ctx.emit('startRandomNote');
                // @ts-ignore
                [store, emit,];
            } },
        type: "button",
        ...{ class: "quiz-btn random-note" },
    });
    /** @type {__VLS_StyleScopedClasses['quiz-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['random-note']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    let __VLS_11;
    /** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
    RouterLink;
    // @ts-ignore
    const __VLS_12 = __VLS_asFunctionalComponent1(__VLS_11, new __VLS_11({
        ...{ class: "quiz-btn suite-bank" },
        to: ({ name: 'XingceSuiteBank' }),
    }));
    const __VLS_13 = __VLS_12({
        ...{ class: "quiz-btn suite-bank" },
        to: ({ name: 'XingceSuiteBank' }),
    }, ...__VLS_functionalComponentArgsRest(__VLS_12));
    /** @type {__VLS_StyleScopedClasses['quiz-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['suite-bank']} */ ;
    const { default: __VLS_16 } = __VLS_14.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    // @ts-ignore
    [];
    var __VLS_14;
    let __VLS_17;
    /** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
    RouterLink;
    // @ts-ignore
    const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
        ...{ class: "quiz-btn bank-drill" },
        to: ({ name: 'XingceBankDrill' }),
    }));
    const __VLS_19 = __VLS_18({
        ...{ class: "quiz-btn bank-drill" },
        to: ({ name: 'XingceBankDrill' }),
    }, ...__VLS_functionalComponentArgsRest(__VLS_18));
    /** @type {__VLS_StyleScopedClasses['quiz-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['bank-drill']} */ ;
    const { default: __VLS_22 } = __VLS_20.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    // @ts-ignore
    [];
    var __VLS_20;
    if (__VLS_ctx.store.errors.length !== __VLS_ctx.fullBadge) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ style: {} },
        });
        (__VLS_ctx.store.errors.length);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "today-progress" },
    });
    /** @type {__VLS_StyleScopedClasses['today-progress']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "prog-label" },
    });
    /** @type {__VLS_StyleScopedClasses['prog-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.progressText);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "prog-bar-bg" },
    });
    /** @type {__VLS_StyleScopedClasses['prog-bar-bg']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "prog-bar-fill" },
        ...{ style: ({ width: __VLS_ctx.progressPct + '%' }) },
    });
    /** @type {__VLS_StyleScopedClasses['prog-bar-fill']} */ ;
}
// @ts-ignore
[store, store, fullBadge, progressText, progressPct,];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
