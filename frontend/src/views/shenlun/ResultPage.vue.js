/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { shenlunApi } from '@/api/shenlun';
import { nodeIdToRouteQuery } from '@/data/shenlunTree';
const route = useRoute();
const router = useRouter();
const attempt = ref(null);
const loading = ref(true);
const error = ref(null);
const deleting = ref(false);
const activeSegmentIndex = ref(0);
const activeTab = ref('segments');
// submit-cc is synchronous, so result should already be ready.
// Polling is kept as a safety fallback (e.g. if user navigates directly to URL).
let pollCount = 0;
async function loadAttempt() {
    const id = route.params.attemptId;
    try {
        const att = await shenlunApi.getAttempt(id);
        attempt.value = att;
        if (att.cc_status === 'pending' && pollCount < 20) {
            pollCount++;
            setTimeout(() => void loadAttempt(), 3000);
            return;
        }
    }
    catch (e) {
        error.value = e.message;
    }
    finally {
        loading.value = false;
    }
}
onMounted(() => void loadAttempt());
const ccResult = computed(() => attempt.value?.cc_result_json ?? null);
const segments = computed(() => ccResult.value?.segments ?? []);
const activeSegment = computed(() => segments.value[activeSegmentIndex.value] ?? null);
const statusLabel = computed(() => {
    const s = attempt.value?.cc_status;
    if (s === 'pending')
        return '等待 CC 返回中…';
    if (s === 'success')
        return '已完成复盘';
    if (s === 'failed')
        return 'CC 返回失败';
    return '';
});
function tagClass(tag) {
    if (tag.includes('遗漏'))
        return 'tag tag--miss';
    if (tag.includes('错误') || tag.includes('偏差'))
        return 'tag tag--wrong';
    if (tag.includes('空泛') || tag.includes('过虚'))
        return 'tag tag--vague';
    return 'tag tag--default';
}
function goWorkbench() {
    const att = attempt.value;
    if (!att)
        return;
    void router.push({
        name: 'ShenlunWorkbench',
        query: { source: att.source_id },
    });
}
function goHubList() {
    const att = attempt.value;
    const nid = att?.source_node_id ?? '';
    void router.push({
        name: 'ShenlunHub',
        query: { node: nodeIdToRouteQuery(nid) },
    });
}
async function deleteThisRound() {
    const att = attempt.value;
    if (!att?.id)
        return;
    if (!window.confirm('确定删除这一轮复盘/练习记录？删除后可在工作台查看其它轮次或重新批改。'))
        return;
    deleting.value = true;
    try {
        const sid = att.source_id;
        await shenlunApi.deleteAttempt(att.id);
        void router.replace({
            name: 'ShenlunWorkbench',
            query: { source: sid },
        });
    }
    catch (e) {
        window.alert(e.message);
    }
    finally {
        deleting.value = false;
    }
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['rp-del']} */ ;
/** @type {__VLS_StyleScopedClasses['rp-del']} */ ;
/** @type {__VLS_StyleScopedClasses['rp-status']} */ ;
/** @type {__VLS_StyleScopedClasses['rp-status']} */ ;
/** @type {__VLS_StyleScopedClasses['rp-status']} */ ;
/** @type {__VLS_StyleScopedClasses['rp-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['seg-nav-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['seg-nav-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['seg-points']} */ ;
/** @type {__VLS_StyleScopedClasses['seg-points']} */ ;
/** @type {__VLS_StyleScopedClasses['seg-points--matched']} */ ;
/** @type {__VLS_StyleScopedClasses['seg-points-title']} */ ;
/** @type {__VLS_StyleScopedClasses['seg-points--missed']} */ ;
/** @type {__VLS_StyleScopedClasses['seg-points-title']} */ ;
/** @type {__VLS_StyleScopedClasses['seg-points--wrong']} */ ;
/** @type {__VLS_StyleScopedClasses['seg-points-title']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
/** @type {__VLS_StyleScopedClasses['seg-compare-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['overall-grid']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "rp-page" },
});
/** @type {__VLS_StyleScopedClasses['rp-page']} */ ;
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rp-center" },
    });
    /** @type {__VLS_StyleScopedClasses['rp-center']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "rp-spinner" },
    });
    /** @type {__VLS_StyleScopedClasses['rp-spinner']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
}
else if (__VLS_ctx.error) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rp-center rp-error" },
    });
    /** @type {__VLS_StyleScopedClasses['rp-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['rp-error']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    (__VLS_ctx.error);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.loading))
                    return;
                if (!(__VLS_ctx.error))
                    return;
                __VLS_ctx.router.back();
                // @ts-ignore
                [loading, error, error, router,];
            } },
        ...{ class: "btn btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
}
else if (__VLS_ctx.attempt) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
        ...{ class: "rp-header" },
    });
    /** @type {__VLS_StyleScopedClasses['rp-header']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rp-header-left" },
    });
    /** @type {__VLS_StyleScopedClasses['rp-header-left']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "rp-tag" },
    });
    /** @type {__VLS_StyleScopedClasses['rp-tag']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "rp-status" },
        ...{ class: (__VLS_ctx.attempt.cc_status) },
    });
    /** @type {__VLS_StyleScopedClasses['rp-status']} */ ;
    (__VLS_ctx.statusLabel);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rp-header-actions" },
    });
    /** @type {__VLS_StyleScopedClasses['rp-header-actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.goWorkbench) },
        type: "button",
        ...{ class: "btn btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.goHubList) },
        type: "button",
        ...{ class: "btn btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.deleteThisRound) },
        type: "button",
        ...{ class: "btn rp-del" },
        disabled: (__VLS_ctx.deleting),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['rp-del']} */ ;
    (__VLS_ctx.deleting ? '删除中…' : '删除本轮');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.loading))
                    return;
                if (!!(__VLS_ctx.error))
                    return;
                if (!(__VLS_ctx.attempt))
                    return;
                __VLS_ctx.router.push({ name: 'ShenlunHub' });
                // @ts-ignore
                [router, attempt, attempt, statusLabel, goWorkbench, goHubList, deleteThisRound, deleting, deleting,];
            } },
        type: "button",
        ...{ class: "btn btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    if (__VLS_ctx.attempt.cc_status === 'pending') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rp-waiting" },
        });
        /** @type {__VLS_StyleScopedClasses['rp-waiting']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
            ...{ class: "rp-spinner" },
        });
        /** @type {__VLS_StyleScopedClasses['rp-spinner']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
    }
    else if (__VLS_ctx.attempt.cc_status === 'failed') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rp-fail-banner" },
        });
        /** @type {__VLS_StyleScopedClasses['rp-fail-banner']} */ ;
    }
    else if (__VLS_ctx.ccResult) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rp-tabs" },
        });
        /** @type {__VLS_StyleScopedClasses['rp-tabs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.error))
                        return;
                    if (!(__VLS_ctx.attempt))
                        return;
                    if (!!(__VLS_ctx.attempt.cc_status === 'pending'))
                        return;
                    if (!!(__VLS_ctx.attempt.cc_status === 'failed'))
                        return;
                    if (!(__VLS_ctx.ccResult))
                        return;
                    __VLS_ctx.activeTab = 'segments';
                    // @ts-ignore
                    [attempt, attempt, ccResult, activeTab,];
                } },
            ...{ class: "rp-tab" },
            ...{ class: ({ active: __VLS_ctx.activeTab === 'segments' }) },
        });
        /** @type {__VLS_StyleScopedClasses['rp-tab']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.error))
                        return;
                    if (!(__VLS_ctx.attempt))
                        return;
                    if (!!(__VLS_ctx.attempt.cc_status === 'pending'))
                        return;
                    if (!!(__VLS_ctx.attempt.cc_status === 'failed'))
                        return;
                    if (!(__VLS_ctx.ccResult))
                        return;
                    __VLS_ctx.activeTab = 'overall';
                    // @ts-ignore
                    [activeTab, activeTab,];
                } },
            ...{ class: "rp-tab" },
            ...{ class: ({ active: __VLS_ctx.activeTab === 'overall' }) },
        });
        /** @type {__VLS_StyleScopedClasses['rp-tab']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        if (__VLS_ctx.activeTab === 'segments') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "seg-nav" },
            });
            /** @type {__VLS_StyleScopedClasses['seg-nav']} */ ;
            for (const [_, i] of __VLS_vFor((__VLS_ctx.segments))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.loading))
                                return;
                            if (!!(__VLS_ctx.error))
                                return;
                            if (!(__VLS_ctx.attempt))
                                return;
                            if (!!(__VLS_ctx.attempt.cc_status === 'pending'))
                                return;
                            if (!!(__VLS_ctx.attempt.cc_status === 'failed'))
                                return;
                            if (!(__VLS_ctx.ccResult))
                                return;
                            if (!(__VLS_ctx.activeTab === 'segments'))
                                return;
                            __VLS_ctx.activeSegmentIndex = i;
                            // @ts-ignore
                            [activeTab, activeTab, segments, activeSegmentIndex,];
                        } },
                    key: (i),
                    ...{ class: "seg-nav-btn" },
                    ...{ class: ({ active: __VLS_ctx.activeSegmentIndex === i }) },
                });
                /** @type {__VLS_StyleScopedClasses['seg-nav-btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['active']} */ ;
                (i + 1);
                // @ts-ignore
                [activeSegmentIndex,];
            }
            if (__VLS_ctx.activeSegment) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "seg-detail" },
                });
                /** @type {__VLS_StyleScopedClasses['seg-detail']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
                    ...{ class: "seg-section" },
                });
                /** @type {__VLS_StyleScopedClasses['seg-section']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
                    ...{ class: "seg-section-title" },
                });
                /** @type {__VLS_StyleScopedClasses['seg-section-title']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "seg-text seg-text--source" },
                });
                /** @type {__VLS_StyleScopedClasses['seg-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['seg-text--source']} */ ;
                (__VLS_ctx.activeSegment.source_segment_text);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "seg-compare-grid" },
                });
                /** @type {__VLS_StyleScopedClasses['seg-compare-grid']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
                    ...{ class: "seg-section" },
                });
                /** @type {__VLS_StyleScopedClasses['seg-section']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
                    ...{ class: "seg-section-title seg-section-title--mine" },
                });
                /** @type {__VLS_StyleScopedClasses['seg-section-title']} */ ;
                /** @type {__VLS_StyleScopedClasses['seg-section-title--mine']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "seg-text" },
                });
                /** @type {__VLS_StyleScopedClasses['seg-text']} */ ;
                (__VLS_ctx.activeSegment.my_extraction || '（未填写）');
                __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
                    ...{ class: "seg-section" },
                });
                /** @type {__VLS_StyleScopedClasses['seg-section']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
                    ...{ class: "seg-section-title seg-section-title--ref" },
                });
                /** @type {__VLS_StyleScopedClasses['seg-section-title']} */ ;
                /** @type {__VLS_StyleScopedClasses['seg-section-title--ref']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "seg-text" },
                });
                /** @type {__VLS_StyleScopedClasses['seg-text']} */ ;
                (__VLS_ctx.activeSegment.reference_extraction);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "seg-points-grid" },
                });
                /** @type {__VLS_StyleScopedClasses['seg-points-grid']} */ ;
                if (__VLS_ctx.activeSegment.matched_points.length) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "seg-points seg-points--matched" },
                    });
                    /** @type {__VLS_StyleScopedClasses['seg-points']} */ ;
                    /** @type {__VLS_StyleScopedClasses['seg-points--matched']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
                        ...{ class: "seg-points-title" },
                    });
                    /** @type {__VLS_StyleScopedClasses['seg-points-title']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({});
                    for (const [pt, i] of __VLS_vFor((__VLS_ctx.activeSegment.matched_points))) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                            key: (i),
                        });
                        (pt);
                        // @ts-ignore
                        [activeSegment, activeSegment, activeSegment, activeSegment, activeSegment, activeSegment,];
                    }
                }
                if (__VLS_ctx.activeSegment.missed_points.length) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "seg-points seg-points--missed" },
                    });
                    /** @type {__VLS_StyleScopedClasses['seg-points']} */ ;
                    /** @type {__VLS_StyleScopedClasses['seg-points--missed']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
                        ...{ class: "seg-points-title" },
                    });
                    /** @type {__VLS_StyleScopedClasses['seg-points-title']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({});
                    for (const [pt, i] of __VLS_vFor((__VLS_ctx.activeSegment.missed_points))) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                            key: (i),
                        });
                        (pt);
                        // @ts-ignore
                        [activeSegment, activeSegment,];
                    }
                }
                if (__VLS_ctx.activeSegment.wrong_points.length) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "seg-points seg-points--wrong" },
                    });
                    /** @type {__VLS_StyleScopedClasses['seg-points']} */ ;
                    /** @type {__VLS_StyleScopedClasses['seg-points--wrong']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
                        ...{ class: "seg-points-title" },
                    });
                    /** @type {__VLS_StyleScopedClasses['seg-points-title']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({});
                    for (const [pt, i] of __VLS_vFor((__VLS_ctx.activeSegment.wrong_points))) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                            key: (i),
                        });
                        (pt);
                        // @ts-ignore
                        [activeSegment, activeSegment,];
                    }
                }
                if (__VLS_ctx.activeSegment.issue_tags.length) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ class: "seg-tags" },
                    });
                    /** @type {__VLS_StyleScopedClasses['seg-tags']} */ ;
                    for (const [tag] of __VLS_vFor((__VLS_ctx.activeSegment.issue_tags))) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            key: (tag),
                            ...{ class: (__VLS_ctx.tagClass(tag)) },
                        });
                        (tag);
                        // @ts-ignore
                        [activeSegment, activeSegment, tagClass,];
                    }
                }
                if (__VLS_ctx.activeSegment.cc_comment) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
                        ...{ class: "seg-section seg-section--comment" },
                    });
                    /** @type {__VLS_StyleScopedClasses['seg-section']} */ ;
                    /** @type {__VLS_StyleScopedClasses['seg-section--comment']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
                        ...{ class: "seg-section-title" },
                    });
                    /** @type {__VLS_StyleScopedClasses['seg-section-title']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "seg-text seg-text--comment" },
                    });
                    /** @type {__VLS_StyleScopedClasses['seg-text']} */ ;
                    /** @type {__VLS_StyleScopedClasses['seg-text--comment']} */ ;
                    (__VLS_ctx.activeSegment.cc_comment);
                }
            }
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "overall-grid" },
            });
            /** @type {__VLS_StyleScopedClasses['overall-grid']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
                ...{ class: "overall-section" },
            });
            /** @type {__VLS_StyleScopedClasses['overall-section']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
                ...{ class: "overall-title overall-title--mine" },
            });
            /** @type {__VLS_StyleScopedClasses['overall-title']} */ ;
            /** @type {__VLS_StyleScopedClasses['overall-title--mine']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "overall-text" },
            });
            /** @type {__VLS_StyleScopedClasses['overall-text']} */ ;
            (__VLS_ctx.attempt.my_final_summary || '（未填写）');
            __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
                ...{ class: "overall-section" },
            });
            /** @type {__VLS_StyleScopedClasses['overall-section']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
                ...{ class: "overall-title overall-title--ref" },
            });
            /** @type {__VLS_StyleScopedClasses['overall-title']} */ ;
            /** @type {__VLS_StyleScopedClasses['overall-title--ref']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "overall-text" },
            });
            /** @type {__VLS_StyleScopedClasses['overall-text']} */ ;
            (__VLS_ctx.ccResult.reference_final_summary);
            if (__VLS_ctx.ccResult.overall_issue_tags?.length) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "overall-tags" },
                });
                /** @type {__VLS_StyleScopedClasses['overall-tags']} */ ;
                for (const [tag] of __VLS_vFor((__VLS_ctx.ccResult.overall_issue_tags))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        key: (tag),
                        ...{ class: (__VLS_ctx.tagClass(tag)) },
                    });
                    (tag);
                    // @ts-ignore
                    [attempt, ccResult, ccResult, ccResult, activeSegment, activeSegment, tagClass,];
                }
            }
            if (__VLS_ctx.ccResult.overall_comment) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
                    ...{ class: "overall-comment-section" },
                });
                /** @type {__VLS_StyleScopedClasses['overall-comment-section']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
                    ...{ class: "overall-title" },
                });
                /** @type {__VLS_StyleScopedClasses['overall-title']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "overall-text overall-text--comment" },
                });
                /** @type {__VLS_StyleScopedClasses['overall-text']} */ ;
                /** @type {__VLS_StyleScopedClasses['overall-text--comment']} */ ;
                (__VLS_ctx.ccResult.overall_comment);
            }
        }
    }
}
// @ts-ignore
[ccResult, ccResult,];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
