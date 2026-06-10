/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { suiteBankApi } from '@/api/suiteBank';
import { useXingceStore } from '@/stores/xingceStore';
const emit = defineEmits();
const store = useXingceStore();
const query = ref('');
const scope = ref('all');
const inputRef = ref(null);
const suiteHits = ref([]);
const suitePaperHits = ref([]);
const suiteLoading = ref(false);
let suiteTimer = null;
const terms = computed(() => query.value.trim().toLowerCase().split(/\s+/).filter(Boolean));
const questionHits = computed(() => {
    const ts = terms.value;
    if (!ts.length)
        return [];
    return store.errors.filter(e => store.globalSearchMatchError(e, ts)).slice(0, 120);
});
const noteHits = computed(() => {
    const ts = terms.value;
    if (!ts.length)
        return [];
    return store.knowledgeNodes.filter(n => store.globalSearchMatchKnowledgeNode(n, ts)).slice(0, 120);
});
const visibleQuestions = computed(() => {
    if (scope.value === 'notes' || scope.value === 'suite')
        return [];
    return questionHits.value;
});
const visibleNotes = computed(() => {
    if (scope.value === 'questions' || scope.value === 'suite')
        return [];
    return noteHits.value;
});
const visibleSuite = computed(() => {
    if (scope.value === 'notes')
        return [];
    return suiteHits.value;
});
const visibleSuitePapers = computed(() => {
    if (scope.value === 'notes')
        return [];
    return suitePaperHits.value;
});
function scheduleSuiteFetch() {
    if (suiteTimer)
        clearTimeout(suiteTimer);
    suiteTimer = setTimeout(async () => {
        const ts = terms.value;
        const want = (scope.value === 'all' || scope.value === 'suite' || scope.value === 'questions') && ts.length > 0;
        if (!want) {
            suiteHits.value = [];
            suitePaperHits.value = [];
            suiteLoading.value = false;
            return;
        }
        suiteLoading.value = true;
        try {
            const { items, papers } = await suiteBankApi.search(ts.join(' '), 80);
            suiteHits.value = items;
            suitePaperHits.value = papers;
        }
        catch {
            suiteHits.value = [];
            suitePaperHits.value = [];
        }
        finally {
            suiteLoading.value = false;
        }
    }, 320);
}
watch([query, scope], scheduleSuiteFetch);
onMounted(() => {
    nextTick(() => inputRef.value?.focus());
    scheduleSuiteFetch();
});
function snippet(text, max = 72) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    return s.length <= max ? s : `${s.slice(0, max)}…`;
}
function notePath(n) {
    const p = store.getNodePathText(n.id);
    return p || n.title;
}
function suiteMeta(h) {
    return [h.paper_folder, h.paper_title].filter(Boolean).join(' · ');
}
function suitePaperMeta(h) {
    const bits = [h.folder, `${h.question_count} 题`].filter(Boolean);
    if (String(h.source_rel_path || '').startsWith('word版本/'))
        bits.push('Word');
    return bits.join(' · ');
}
/** 与套卷页一致：仅允许 data:image base64 行内图，其余 HTML 转义 */
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
function stemWithBlankUnderline(raw) {
    let s = escapeHtml(raw);
    s = s.replace(/[_＿]{3,}/g, '<span class="sb-blank"></span>');
    s = s.replace(/(?:[\u00a0\t ]|\u3000){3,}/g, '<span class="sb-blank"></span>');
    return s;
}
function sanitizeInlineImgTag(tag) {
    const m = tag.match(/\bsrc\s*=\s*["'](data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+)["']/i);
    if (!m)
        return '';
    return `<img class="sb-inline-img" alt="" src="${m[1]}" />`;
}
function mergeStemRich(raw) {
    const s = String(raw ?? '');
    if (!/<img\b/i.test(s))
        return stemWithBlankUnderline(s);
    const parts = s.split(/(<img\b[^>]*\/?>)/gi);
    return parts.map(part => (/^<img\b/i.test(part) ? sanitizeInlineImgTag(part) : stemWithBlankUnderline(part))).join('');
}
/** 全局搜索列表：题干可含行内图 */
function suiteStemPreviewHtml(stem) {
    return mergeStemRich(String(stem ?? ''));
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
/** @type {__VLS_StyleScopedClasses['gsm-close']} */ ;
/** @type {__VLS_StyleScopedClasses['gsm-input']} */ ;
/** @type {__VLS_StyleScopedClasses['gsm-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['gsm-row']} */ ;
/** @type {__VLS_StyleScopedClasses['gsm-row-suite']} */ ;
/** @type {__VLS_StyleScopedClasses['gsm-row-suite-paper']} */ ;
/** @type {__VLS_StyleScopedClasses['gsm-row-title-rich']} */ ;
/** @type {__VLS_StyleScopedClasses['gsm-row-title-rich']} */ ;
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
    ...{ class: "gsm-mask" },
});
/** @type {__VLS_StyleScopedClasses['gsm-mask']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onKeydown: (...[$event]) => {
            __VLS_ctx.emit('close');
            // @ts-ignore
            [emit,];
        } },
    ...{ class: "gsm-modal" },
    role: "dialog",
    'aria-modal': "true",
    'aria-labelledby': "gsm-title",
});
/** @type {__VLS_StyleScopedClasses['gsm-modal']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "gsm-head" },
});
/** @type {__VLS_StyleScopedClasses['gsm-head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    id: "gsm-title",
    ...{ class: "gsm-title" },
});
/** @type {__VLS_StyleScopedClasses['gsm-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('close');
            // @ts-ignore
            [emit,];
        } },
    type: "button",
    ...{ class: "gsm-close" },
    title: "关闭 (Esc)",
});
/** @type {__VLS_StyleScopedClasses['gsm-close']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "gsm-hint" },
});
/** @type {__VLS_StyleScopedClasses['gsm-hint']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.input, __VLS_intrinsics.input)({
    ref: "inputRef",
    type: "search",
    ...{ class: "gsm-input" },
    placeholder: "输入关键词…（Ctrl+K）",
    autocomplete: "off",
});
(__VLS_ctx.query);
/** @type {__VLS_StyleScopedClasses['gsm-input']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "gsm-scope" },
});
/** @type {__VLS_StyleScopedClasses['gsm-scope']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.scope = 'all';
            // @ts-ignore
            [query, scope,];
        } },
    type: "button",
    ...{ class: "gsm-chip" },
    ...{ class: ({ active: __VLS_ctx.scope === 'all' }) },
});
/** @type {__VLS_StyleScopedClasses['gsm-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.scope = 'questions';
            // @ts-ignore
            [scope, scope,];
        } },
    type: "button",
    ...{ class: "gsm-chip" },
    ...{ class: ({ active: __VLS_ctx.scope === 'questions' }) },
});
/** @type {__VLS_StyleScopedClasses['gsm-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.scope = 'notes';
            // @ts-ignore
            [scope, scope,];
        } },
    type: "button",
    ...{ class: "gsm-chip" },
    ...{ class: ({ active: __VLS_ctx.scope === 'notes' }) },
});
/** @type {__VLS_StyleScopedClasses['gsm-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.scope = 'suite';
            // @ts-ignore
            [scope, scope,];
        } },
    type: "button",
    ...{ class: "gsm-chip" },
    ...{ class: ({ active: __VLS_ctx.scope === 'suite' }) },
});
/** @type {__VLS_StyleScopedClasses['gsm-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
if (!__VLS_ctx.terms.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "gsm-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['gsm-empty']} */ ;
}
else if (__VLS_ctx.scope === 'suite' && __VLS_ctx.suiteLoading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "gsm-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['gsm-empty']} */ ;
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "gsm-results" },
    });
    /** @type {__VLS_StyleScopedClasses['gsm-results']} */ ;
    if (__VLS_ctx.suiteLoading && (__VLS_ctx.scope === 'all' || __VLS_ctx.scope === 'questions')) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "gsm-inline-loading" },
        });
        /** @type {__VLS_StyleScopedClasses['gsm-inline-loading']} */ ;
    }
    if (__VLS_ctx.visibleQuestions.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ class: "gsm-section" },
        });
        /** @type {__VLS_StyleScopedClasses['gsm-section']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "gsm-sec-title" },
        });
        /** @type {__VLS_StyleScopedClasses['gsm-sec-title']} */ ;
        (__VLS_ctx.visibleQuestions.length);
        for (const [e] of __VLS_vFor((__VLS_ctx.visibleQuestions))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.terms.length))
                            return;
                        if (!!(__VLS_ctx.scope === 'suite' && __VLS_ctx.suiteLoading))
                            return;
                        if (!(__VLS_ctx.visibleQuestions.length))
                            return;
                        __VLS_ctx.emit('pickQuestion', e.id);
                        // @ts-ignore
                        [emit, scope, scope, scope, scope, terms, suiteLoading, suiteLoading, visibleQuestions, visibleQuestions, visibleQuestions,];
                    } },
                key: (e.id),
                type: "button",
                ...{ class: "gsm-row" },
            });
            /** @type {__VLS_StyleScopedClasses['gsm-row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "gsm-row-title" },
            });
            /** @type {__VLS_StyleScopedClasses['gsm-row-title']} */ ;
            (__VLS_ctx.snippet(e.question ?? '', 80));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "gsm-row-meta" },
            });
            /** @type {__VLS_StyleScopedClasses['gsm-row-meta']} */ ;
            (e.type);
            (e.subtype);
            // @ts-ignore
            [snippet,];
        }
    }
    if (__VLS_ctx.visibleNotes.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ class: "gsm-section" },
        });
        /** @type {__VLS_StyleScopedClasses['gsm-section']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "gsm-sec-title" },
        });
        /** @type {__VLS_StyleScopedClasses['gsm-sec-title']} */ ;
        (__VLS_ctx.visibleNotes.length);
        for (const [n] of __VLS_vFor((__VLS_ctx.visibleNotes))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.terms.length))
                            return;
                        if (!!(__VLS_ctx.scope === 'suite' && __VLS_ctx.suiteLoading))
                            return;
                        if (!(__VLS_ctx.visibleNotes.length))
                            return;
                        __VLS_ctx.emit('pickNote', n.id);
                        // @ts-ignore
                        [emit, visibleNotes, visibleNotes, visibleNotes,];
                    } },
                key: (n.id),
                type: "button",
                ...{ class: "gsm-row" },
            });
            /** @type {__VLS_StyleScopedClasses['gsm-row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "gsm-row-title" },
            });
            /** @type {__VLS_StyleScopedClasses['gsm-row-title']} */ ;
            (n.title);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "gsm-row-meta" },
            });
            /** @type {__VLS_StyleScopedClasses['gsm-row-meta']} */ ;
            (__VLS_ctx.notePath(n));
            // @ts-ignore
            [notePath,];
        }
    }
    if (__VLS_ctx.visibleSuitePapers.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ class: "gsm-section" },
        });
        /** @type {__VLS_StyleScopedClasses['gsm-section']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "gsm-sec-title" },
        });
        /** @type {__VLS_StyleScopedClasses['gsm-sec-title']} */ ;
        (__VLS_ctx.visibleSuitePapers.length);
        for (const [h] of __VLS_vFor((__VLS_ctx.visibleSuitePapers))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.terms.length))
                            return;
                        if (!!(__VLS_ctx.scope === 'suite' && __VLS_ctx.suiteLoading))
                            return;
                        if (!(__VLS_ctx.visibleSuitePapers.length))
                            return;
                        __VLS_ctx.emit('pickSuite', h.id, '');
                        // @ts-ignore
                        [emit, visibleSuitePapers, visibleSuitePapers, visibleSuitePapers,];
                    } },
                key: (`p-${h.id}`),
                type: "button",
                ...{ class: "gsm-row gsm-row-suite gsm-row-suite-paper" },
            });
            /** @type {__VLS_StyleScopedClasses['gsm-row']} */ ;
            /** @type {__VLS_StyleScopedClasses['gsm-row-suite']} */ ;
            /** @type {__VLS_StyleScopedClasses['gsm-row-suite-paper']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "gsm-row-title" },
            });
            /** @type {__VLS_StyleScopedClasses['gsm-row-title']} */ ;
            (__VLS_ctx.snippet(h.title ?? '', 96));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "gsm-row-meta" },
            });
            /** @type {__VLS_StyleScopedClasses['gsm-row-meta']} */ ;
            (__VLS_ctx.suitePaperMeta(h));
            // @ts-ignore
            [snippet, suitePaperMeta,];
        }
    }
    if (__VLS_ctx.visibleSuite.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ class: "gsm-section" },
        });
        /** @type {__VLS_StyleScopedClasses['gsm-section']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "gsm-sec-title" },
        });
        /** @type {__VLS_StyleScopedClasses['gsm-sec-title']} */ ;
        (__VLS_ctx.visibleSuite.length);
        for (const [h] of __VLS_vFor((__VLS_ctx.visibleSuite))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(!__VLS_ctx.terms.length))
                            return;
                        if (!!(__VLS_ctx.scope === 'suite' && __VLS_ctx.suiteLoading))
                            return;
                        if (!(__VLS_ctx.visibleSuite.length))
                            return;
                        __VLS_ctx.emit('pickSuite', h.paper_id, h.id);
                        // @ts-ignore
                        [emit, visibleSuite, visibleSuite, visibleSuite,];
                    } },
                key: (h.id),
                type: "button",
                ...{ class: "gsm-row gsm-row-suite" },
            });
            /** @type {__VLS_StyleScopedClasses['gsm-row']} */ ;
            /** @type {__VLS_StyleScopedClasses['gsm-row-suite']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                ...{ class: "gsm-row-title gsm-row-title-rich" },
            });
            __VLS_asFunctionalDirective(__VLS_directives.vHtml, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.suiteStemPreviewHtml(h.stem)) }, null, null);
            /** @type {__VLS_StyleScopedClasses['gsm-row-title']} */ ;
            /** @type {__VLS_StyleScopedClasses['gsm-row-title-rich']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "gsm-row-meta" },
            });
            /** @type {__VLS_StyleScopedClasses['gsm-row-meta']} */ ;
            (__VLS_ctx.suiteMeta(h));
            // @ts-ignore
            [suiteStemPreviewHtml, suiteMeta,];
        }
    }
    if (__VLS_ctx.terms.length && !__VLS_ctx.visibleQuestions.length && !__VLS_ctx.visibleNotes.length && !__VLS_ctx.visibleSuite.length && !__VLS_ctx.visibleSuitePapers.length && !__VLS_ctx.suiteLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "gsm-empty" },
        });
        /** @type {__VLS_StyleScopedClasses['gsm-empty']} */ ;
    }
}
// @ts-ignore
[terms, suiteLoading, visibleQuestions, visibleNotes, visibleSuitePapers, visibleSuite,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
});
export default {};
