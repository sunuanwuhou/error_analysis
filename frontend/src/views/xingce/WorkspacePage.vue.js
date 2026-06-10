/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useXingceStore } from '@/stores/xingceStore';
import PracticePanel from '@/components/xingce/PracticePanel.vue';
import FilterSidebar from '@/components/xingce/FilterSidebar.vue';
import NotesWorkspacePanel from '@/components/xingce/NotesWorkspacePanel.vue';
import ErrorsWorkspacePanel from '@/components/xingce/ErrorsWorkspacePanel.vue';
import GlobalSearchModal from '@/components/xingce/GlobalSearchModal.vue';
import QuizModal from '@/components/xingce/QuizModal.vue';
import AddErrorModal from '@/components/xingce/AddErrorModal.vue';
import ImportModal from '@/components/xingce/ImportModal.vue';
import HistoryModal from '@/components/xingce/HistoryModal.vue';
import TypeRulesModal from '@/components/xingce/TypeRulesModal.vue';
import { savePortalLastModule } from '@/lib/portalPrefs';
import '@/styles/xingce-vue-legacy.css';
const store = useXingceStore();
const router = useRouter();
const route = useRoute();
const quizMode = ref(null);
const showAddModal = ref(false);
const showImportModal = ref(false);
const showGlobalSearch = ref(false);
const showHistoryModal = ref(false);
const showTypeRulesModal = ref(false);
const notesWorkspaceRef = ref(null);
/** 与旧版 `switchTab` 默认一致：工作区先展示「学习笔记」 */
const mainTab = ref('notes');
const runtimeMode = computed(() => {
    if (typeof window === 'undefined')
        return 'unknown';
    const { hostname } = window.location;
    if (hostname === '127.0.0.1' || hostname === 'localhost')
        return 'local';
    return 'docker';
});
const runtimeLabel = computed(() => {
    if (typeof window === 'undefined')
        return 'unknown';
    const { hostname, port } = window.location;
    if (hostname === '127.0.0.1' || hostname === 'localhost') {
        return port ? `${hostname}:${port}` : hostname;
    }
    return hostname;
});
function onGlobalKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        showGlobalSearch.value = true;
    }
}
onMounted(() => {
    savePortalLastModule('xingce');
    store.load();
    store.loadMe();
    window.addEventListener('keydown', onGlobalKeydown);
});
onUnmounted(() => {
    window.removeEventListener('keydown', onGlobalKeydown);
});
function onPickQuestion(id) {
    showGlobalSearch.value = false;
    mainTab.value = 'errors';
    store.clearFilters();
    nextTick(() => {
        const safe = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id.replace(/"/g, '\\"');
        const el = document.querySelector(`[data-error-id="${safe}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.classList.add('ec--picked');
        window.setTimeout(() => el?.classList.remove('ec--picked'), 2200);
    });
}
function onStartRandomNote() {
    const withNotes = store.knowledgeNodes.filter((n) => {
        const md = String(n.contentMd ?? '').trim();
        const nt = String(n.noteContent ?? '').trim();
        return !!(md || nt);
    });
    if (!withNotes.length) {
        window.alert('暂无笔记内容');
        return;
    }
    const pick = withNotes[Math.floor(Math.random() * withNotes.length)];
    store.setActiveNode(pick.id);
    mainTab.value = 'notes';
}
function onOpenMarkdownEditor() {
    mainTab.value = 'notes';
    nextTick(() => notesWorkspaceRef.value?.enterNoteEdit());
}
function onPickNote(nodeId) {
    store.setActiveNode(nodeId);
    mainTab.value = 'notes';
    showGlobalSearch.value = false;
}
function qsOne(v) {
    if (typeof v === 'string')
        return v;
    if (Array.isArray(v) && v[0])
        return String(v[0]);
    return '';
}
function consumeSuiteGlobalSearchHandoff() {
    if (store.loading)
        return;
    const errId = qsOne(route.query.gsPickError);
    const noteId = qsOne(route.query.gsPickNote);
    if (!errId && !noteId)
        return;
    const q = { ...route.query };
    delete q.gsPickError;
    delete q.gsPickNote;
    void router.replace({ path: route.path, query: q });
    if (errId)
        onPickQuestion(errId);
    else
        onPickNote(noteId);
}
watch(() => [store.loading, route.query.gsPickError, route.query.gsPickNote], consumeSuiteGlobalSearchHandoff, { flush: 'post' });
function onPickSuite(paperId, questionId) {
    showGlobalSearch.value = false;
    const q = { paper: paperId, suiteMode: 'preview' };
    if (questionId)
        q.qid = questionId;
    void router.push({
        name: 'XingceSuiteBank',
        query: q,
    });
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['xc-save-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['xc-save-pill']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "xc-vue-legacy" },
});
/** @type {__VLS_StyleScopedClasses['xc-vue-legacy']} */ ;
if (__VLS_ctx.store.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "xc-loading" },
    });
    /** @type {__VLS_StyleScopedClasses['xc-loading']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "xc-spinner" },
    });
    /** @type {__VLS_StyleScopedClasses['xc-spinner']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
else if (__VLS_ctx.store.loadError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "xc-error-state" },
    });
    /** @type {__VLS_StyleScopedClasses['xc-error-state']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "xc-error-msg" },
    });
    /** @type {__VLS_StyleScopedClasses['xc-error-msg']} */ ;
    (__VLS_ctx.store.loadError);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.store.loading))
                    return;
                if (!(__VLS_ctx.store.loadError))
                    return;
                __VLS_ctx.store.load();
                // @ts-ignore
                [store, store, store, store,];
            } },
        type: "button",
        ...{ class: "btn btn-primary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
        ...{ class: "sidebar" },
        ...{ class: ({ 'is-tree-focus': __VLS_ctx.store.knowledgeFocusMode }) },
    });
    /** @type {__VLS_StyleScopedClasses['sidebar']} */ ;
    /** @type {__VLS_StyleScopedClasses['is-tree-focus']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sidebar-logo" },
    });
    /** @type {__VLS_StyleScopedClasses['sidebar-logo']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "runtime-badge" },
        'data-mode': (__VLS_ctx.runtimeMode),
    });
    /** @type {__VLS_StyleScopedClasses['runtime-badge']} */ ;
    (__VLS_ctx.runtimeLabel);
    const __VLS_0 = PracticePanel;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onStartQuiz': {} },
        ...{ 'onStartRandomNote': {} },
        ...{ 'onOpenAdd': {} },
        ...{ 'onOpenImport': {} },
        ...{ 'onOpenMarkdownEditor': {} },
        ...{ 'onOpenHistory': {} },
        ...{ 'onOpenTypeRules': {} },
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onStartQuiz': {} },
        ...{ 'onStartRandomNote': {} },
        ...{ 'onOpenAdd': {} },
        ...{ 'onOpenImport': {} },
        ...{ 'onOpenMarkdownEditor': {} },
        ...{ 'onOpenHistory': {} },
        ...{ 'onOpenTypeRules': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ startQuiz: {} },
        { onStartQuiz: ((mode) => { __VLS_ctx.quizMode = mode; }) });
    const __VLS_7 = ({ startRandomNote: {} },
        { onStartRandomNote: (__VLS_ctx.onStartRandomNote) });
    const __VLS_8 = ({ openAdd: {} },
        { onOpenAdd: (...[$event]) => {
                if (!!(__VLS_ctx.store.loading))
                    return;
                if (!!(__VLS_ctx.store.loadError))
                    return;
                __VLS_ctx.showAddModal = true;
                // @ts-ignore
                [store, runtimeMode, runtimeLabel, quizMode, onStartRandomNote, showAddModal,];
            } });
    const __VLS_9 = ({ openImport: {} },
        { onOpenImport: (...[$event]) => {
                if (!!(__VLS_ctx.store.loading))
                    return;
                if (!!(__VLS_ctx.store.loadError))
                    return;
                __VLS_ctx.showImportModal = true;
                // @ts-ignore
                [showImportModal,];
            } });
    const __VLS_10 = ({ openMarkdownEditor: {} },
        { onOpenMarkdownEditor: (__VLS_ctx.onOpenMarkdownEditor) });
    const __VLS_11 = ({ openHistory: {} },
        { onOpenHistory: (...[$event]) => {
                if (!!(__VLS_ctx.store.loading))
                    return;
                if (!!(__VLS_ctx.store.loadError))
                    return;
                __VLS_ctx.showHistoryModal = true;
                // @ts-ignore
                [onOpenMarkdownEditor, showHistoryModal,];
            } });
    const __VLS_12 = ({ openTypeRules: {} },
        { onOpenTypeRules: (...[$event]) => {
                if (!!(__VLS_ctx.store.loading))
                    return;
                if (!!(__VLS_ctx.store.loadError))
                    return;
                __VLS_ctx.showTypeRulesModal = true;
                // @ts-ignore
                [showTypeRulesModal,];
            } });
    var __VLS_3;
    var __VLS_4;
    const __VLS_13 = FilterSidebar;
    // @ts-ignore
    const __VLS_14 = __VLS_asFunctionalComponent1(__VLS_13, new __VLS_13({}));
    const __VLS_15 = __VLS_14({}, ...__VLS_functionalComponentArgsRest(__VLS_14));
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "main-area" },
    });
    /** @type {__VLS_StyleScopedClasses['main-area']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "xc-ws-main-inner" },
    });
    /** @type {__VLS_StyleScopedClasses['xc-ws-main-inner']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "xc-ws-tabs" },
    });
    /** @type {__VLS_StyleScopedClasses['xc-ws-tabs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.store.loading))
                    return;
                if (!!(__VLS_ctx.store.loadError))
                    return;
                __VLS_ctx.mainTab = 'notes';
                // @ts-ignore
                [mainTab,];
            } },
        type: "button",
        ...{ class: "tab-btn" },
        'data-testid': "workspace-tab-notes",
        ...{ class: ({ active: __VLS_ctx.mainTab === 'notes' }) },
    });
    /** @type {__VLS_StyleScopedClasses['tab-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.store.loading))
                    return;
                if (!!(__VLS_ctx.store.loadError))
                    return;
                __VLS_ctx.mainTab = 'errors';
                // @ts-ignore
                [mainTab, mainTab,];
            } },
        type: "button",
        ...{ class: "tab-btn" },
        'data-testid': "workspace-tab-errors",
        ...{ class: ({ active: __VLS_ctx.mainTab === 'errors' }) },
    });
    /** @type {__VLS_StyleScopedClasses['tab-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "xc-ws-top-meta" },
    });
    /** @type {__VLS_StyleScopedClasses['xc-ws-top-meta']} */ ;
    if (__VLS_ctx.store.currentUser) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "xc-user-pill" },
        });
        /** @type {__VLS_StyleScopedClasses['xc-user-pill']} */ ;
        (__VLS_ctx.store.currentUser.username);
    }
    if (__VLS_ctx.mainTab === 'errors') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "xc-mini-count" },
            title: "当前筛选 / 全库",
        });
        /** @type {__VLS_StyleScopedClasses['xc-mini-count']} */ ;
        (__VLS_ctx.store.filteredErrors.length);
        (__VLS_ctx.store.errors.length);
    }
    if (__VLS_ctx.store.activeNodeId || __VLS_ctx.store.statusFilter !== 'all' || __VLS_ctx.store.taskFilter !== 'all' || __VLS_ctx.store.reasonFilter || __VLS_ctx.store.dateFrom || __VLS_ctx.store.dateTo || __VLS_ctx.store.searchQuery) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.store.loading))
                        return;
                    if (!!(__VLS_ctx.store.loadError))
                        return;
                    if (!(__VLS_ctx.store.activeNodeId || __VLS_ctx.store.statusFilter !== 'all' || __VLS_ctx.store.taskFilter !== 'all' || __VLS_ctx.store.reasonFilter || __VLS_ctx.store.dateFrom || __VLS_ctx.store.dateTo || __VLS_ctx.store.searchQuery))
                        return;
                    __VLS_ctx.store.clearFilters();
                    // @ts-ignore
                    [store, store, store, store, store, store, store, store, store, store, store, store, mainTab, mainTab,];
                } },
            type: "button",
            ...{ class: "btn btn-sm btn-secondary" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    }
    if (__VLS_ctx.store.saving) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "xc-save-pill saving" },
        });
        /** @type {__VLS_StyleScopedClasses['xc-save-pill']} */ ;
        /** @type {__VLS_StyleScopedClasses['saving']} */ ;
    }
    else if (__VLS_ctx.store.lastSavedAt) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "xc-save-pill saved" },
        });
        /** @type {__VLS_StyleScopedClasses['xc-save-pill']} */ ;
        /** @type {__VLS_StyleScopedClasses['saved']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "xc-ws-tab-panes" },
    });
    /** @type {__VLS_StyleScopedClasses['xc-ws-tab-panes']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        id: "tabContentNotes",
        ...{ class: "tab-content" },
        ...{ class: ({ active: __VLS_ctx.mainTab === 'notes' }) },
        'data-filtered-count': (__VLS_ctx.store.filteredErrors.length),
        'data-total-count': (__VLS_ctx.store.errors.length),
    });
    /** @type {__VLS_StyleScopedClasses['tab-content']} */ ;
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    const __VLS_18 = NotesWorkspacePanel;
    // @ts-ignore
    const __VLS_19 = __VLS_asFunctionalComponent1(__VLS_18, new __VLS_18({
        ...{ 'onOpenImport': {} },
        ...{ 'onOpenGlobalSearch': {} },
        ref: "notesWorkspaceRef",
    }));
    const __VLS_20 = __VLS_19({
        ...{ 'onOpenImport': {} },
        ...{ 'onOpenGlobalSearch': {} },
        ref: "notesWorkspaceRef",
    }, ...__VLS_functionalComponentArgsRest(__VLS_19));
    let __VLS_23;
    const __VLS_24 = ({ openImport: {} },
        { onOpenImport: (...[$event]) => {
                if (!!(__VLS_ctx.store.loading))
                    return;
                if (!!(__VLS_ctx.store.loadError))
                    return;
                __VLS_ctx.showImportModal = true;
                // @ts-ignore
                [store, store, store, store, showImportModal, mainTab,];
            } });
    const __VLS_25 = ({ openGlobalSearch: {} },
        { onOpenGlobalSearch: (...[$event]) => {
                if (!!(__VLS_ctx.store.loading))
                    return;
                if (!!(__VLS_ctx.store.loadError))
                    return;
                __VLS_ctx.showGlobalSearch = true;
                // @ts-ignore
                [showGlobalSearch,];
            } });
    var __VLS_26 = {};
    var __VLS_21;
    var __VLS_22;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        id: "tabContentErrors",
        ...{ class: "tab-content" },
        ...{ class: ({ active: __VLS_ctx.mainTab === 'errors' }) },
    });
    /** @type {__VLS_StyleScopedClasses['tab-content']} */ ;
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    const __VLS_28 = ErrorsWorkspacePanel;
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent1(__VLS_28, new __VLS_28({
        ...{ 'onOpenGlobalSearch': {} },
    }));
    const __VLS_30 = __VLS_29({
        ...{ 'onOpenGlobalSearch': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    let __VLS_33;
    const __VLS_34 = ({ openGlobalSearch: {} },
        { onOpenGlobalSearch: (...[$event]) => {
                if (!!(__VLS_ctx.store.loading))
                    return;
                if (!!(__VLS_ctx.store.loadError))
                    return;
                __VLS_ctx.showGlobalSearch = true;
                // @ts-ignore
                [mainTab, showGlobalSearch,];
            } });
    var __VLS_31;
    var __VLS_32;
}
if (__VLS_ctx.showGlobalSearch) {
    const __VLS_35 = GlobalSearchModal;
    // @ts-ignore
    const __VLS_36 = __VLS_asFunctionalComponent1(__VLS_35, new __VLS_35({
        ...{ 'onClose': {} },
        ...{ 'onPickQuestion': {} },
        ...{ 'onPickNote': {} },
        ...{ 'onPickSuite': {} },
    }));
    const __VLS_37 = __VLS_36({
        ...{ 'onClose': {} },
        ...{ 'onPickQuestion': {} },
        ...{ 'onPickNote': {} },
        ...{ 'onPickSuite': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_36));
    let __VLS_40;
    const __VLS_41 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.showGlobalSearch))
                    return;
                __VLS_ctx.showGlobalSearch = false;
                // @ts-ignore
                [showGlobalSearch, showGlobalSearch,];
            } });
    const __VLS_42 = ({ pickQuestion: {} },
        { onPickQuestion: (__VLS_ctx.onPickQuestion) });
    const __VLS_43 = ({ pickNote: {} },
        { onPickNote: (__VLS_ctx.onPickNote) });
    const __VLS_44 = ({ pickSuite: {} },
        { onPickSuite: (__VLS_ctx.onPickSuite) });
    var __VLS_38;
    var __VLS_39;
}
if (__VLS_ctx.quizMode) {
    const __VLS_45 = QuizModal;
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent1(__VLS_45, new __VLS_45({
        ...{ 'onClose': {} },
        mode: (__VLS_ctx.quizMode),
    }));
    const __VLS_47 = __VLS_46({
        ...{ 'onClose': {} },
        mode: (__VLS_ctx.quizMode),
    }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    let __VLS_50;
    const __VLS_51 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.quizMode))
                    return;
                __VLS_ctx.quizMode = null;
                // @ts-ignore
                [quizMode, quizMode, quizMode, onPickQuestion, onPickNote, onPickSuite,];
            } });
    var __VLS_48;
    var __VLS_49;
}
if (__VLS_ctx.showAddModal) {
    const __VLS_52 = AddErrorModal;
    // @ts-ignore
    const __VLS_53 = __VLS_asFunctionalComponent1(__VLS_52, new __VLS_52({
        ...{ 'onClose': {} },
        ...{ 'onAdded': {} },
    }));
    const __VLS_54 = __VLS_53({
        ...{ 'onClose': {} },
        ...{ 'onAdded': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_53));
    let __VLS_57;
    const __VLS_58 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.showAddModal))
                    return;
                __VLS_ctx.showAddModal = false;
                // @ts-ignore
                [showAddModal, showAddModal,];
            } });
    const __VLS_59 = ({ added: {} },
        { onAdded: (() => { }) });
    var __VLS_55;
    var __VLS_56;
}
if (__VLS_ctx.showImportModal) {
    const __VLS_60 = ImportModal;
    // @ts-ignore
    const __VLS_61 = __VLS_asFunctionalComponent1(__VLS_60, new __VLS_60({
        ...{ 'onClose': {} },
        ...{ 'onImported': {} },
    }));
    const __VLS_62 = __VLS_61({
        ...{ 'onClose': {} },
        ...{ 'onImported': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_61));
    let __VLS_65;
    const __VLS_66 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.showImportModal))
                    return;
                __VLS_ctx.showImportModal = false;
                // @ts-ignore
                [showImportModal, showImportModal,];
            } });
    const __VLS_67 = ({ imported: {} },
        { onImported: (() => { }) });
    var __VLS_63;
    var __VLS_64;
}
if (__VLS_ctx.showHistoryModal) {
    const __VLS_68 = HistoryModal;
    // @ts-ignore
    const __VLS_69 = __VLS_asFunctionalComponent1(__VLS_68, new __VLS_68({
        ...{ 'onClose': {} },
    }));
    const __VLS_70 = __VLS_69({
        ...{ 'onClose': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_69));
    let __VLS_73;
    const __VLS_74 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.showHistoryModal))
                    return;
                __VLS_ctx.showHistoryModal = false;
                // @ts-ignore
                [showHistoryModal, showHistoryModal,];
            } });
    var __VLS_71;
    var __VLS_72;
}
if (__VLS_ctx.showTypeRulesModal) {
    const __VLS_75 = TypeRulesModal;
    // @ts-ignore
    const __VLS_76 = __VLS_asFunctionalComponent1(__VLS_75, new __VLS_75({
        ...{ 'onClose': {} },
    }));
    const __VLS_77 = __VLS_76({
        ...{ 'onClose': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_76));
    let __VLS_80;
    const __VLS_81 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.showTypeRulesModal))
                    return;
                __VLS_ctx.showTypeRulesModal = false;
                // @ts-ignore
                [showTypeRulesModal, showTypeRulesModal,];
            } });
    var __VLS_78;
    var __VLS_79;
}
// @ts-ignore
var __VLS_27 = __VLS_26;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
