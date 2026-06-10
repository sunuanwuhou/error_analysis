/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
/**
 * 广东套卷全库 · 按五大模块随机练习（省考/统考 + 自然年多选，默认近 5 年）
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { suiteBankApi } from '@/api/suiteBank';
import { BANK_DRILL_PAPER_ID, bankDrillApi, } from '@/api/bankDrill';
const router = useRouter();
const TRACK_LABEL = {
    provincial: '省考',
    unified: '统考',
};
function calendarYearsDefault() {
    const y = new Date().getFullYear();
    return [y - 4, y - 3, y - 2, y - 1, y];
}
const phase = ref('setup');
const loadErr = ref('');
const metaLoading = ref(false);
const meta = ref(null);
const examTrack = ref('provincial');
const selectedYears = ref([...calendarYearsDefault()]);
const drillCount = ref(10);
const sessionId = ref('');
const sessionTrack = ref('provincial');
const sessionYears = ref([]);
const sessionModuleId = ref('');
const sessionModuleLabel = ref('');
const requestedCount = ref(10);
const questions = ref([]);
const quizSlots = ref([]);
const qIdx = ref(0);
const sheetExpanded = ref(true);
const examSheetSubmitted = ref(false);
const examRecordSaved = ref(false);
const examActiveMsAccum = ref(0);
const examSegmentStartedAt = ref(0);
const examTimerPaused = ref(false);
const examDisplayTick = ref(0);
let examTickTimer = null;
const currentQ = computed(() => questions.value[qIdx.value] ?? null);
const sectionBanner = computed(() => {
    const m = currentQ.value?.meta;
    const s = m?.section_heading;
    return typeof s === 'string' && s.trim() ? s.trim() : '';
});
const stemImageSrc = computed(() => {
    const raw = String(currentQ.value?.img_data ?? '').trim();
    if (!raw)
        return '';
    if (raw.startsWith('data:'))
        return raw;
    return `data:image/png;base64,${raw}`;
});
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
    return parts
        .map(part => (/^<img\b/i.test(part) ? sanitizeInlineImgTag(part) : stemWithBlankUnderline(part)))
        .join('');
}
const stemHtml = computed(() => mergeStemRich(String(currentQ.value?.stem ?? '')));
const sharedMaterialRaw = computed(() => {
    const m = currentQ.value?.meta;
    const s = m?.shared_material;
    return typeof s === 'string' ? s.trim() : '';
});
const sharedMaterialHtml = computed(() => mergeStemRich(sharedMaterialRaw.value));
function richOptionHtml(line) {
    const s = String(line ?? '');
    if (!/<img\b/i.test(s))
        return escapeHtml(s);
    const parts = s.split(/(<img\b[^>]*\/?>)/gi);
    return parts.map(part => (/^<img\b/i.test(part) ? sanitizeInlineImgTag(part) : escapeHtml(part))).join('');
}
function optionLineHasImg(line) {
    return /<img\b/i.test(line);
}
function stripInlineMarkup(line) {
    return line.replace(/<[^>]+>/g, '').trim();
}
const optionLines = computed(() => {
    const raw = String(currentQ.value?.options ?? '').trim();
    if (!raw)
        return [];
    return raw.split(/\n|\|/).map(s => s.trim()).filter(Boolean);
});
const currentHasOptions = computed(() => optionLines.value.length > 0);
function letterForLine(line, oi) {
    const plain = stripInlineMarkup(line);
    const m = plain.match(/^([A-Da-d])/);
    if (m)
        return String(m[1]).toUpperCase();
    return String.fromCharCode(65 + oi);
}
function parseAnswerLetters(raw) {
    const s = String(raw || '')
        .toUpperCase()
        .trim();
    if (!s)
        return [];
    const seen = new Set();
    const letters = [];
    if (/[,，]/.test(s)) {
        for (const part of s.split(/[,，]/)) {
            const ch = part.trim().charAt(0);
            if (/^[A-D]$/.test(ch) && !seen.has(ch)) {
                seen.add(ch);
                letters.push(ch);
            }
        }
        return letters.sort();
    }
    for (const ch of s.replace(/\s+/g, '')) {
        if (/^[A-D]$/.test(ch) && !seen.has(ch)) {
            seen.add(ch);
            letters.push(ch);
        }
    }
    return letters.sort();
}
function canonicalPickKey(picked) {
    return parseAnswerLetters(picked || '').join(',');
}
function canonicalAnswerKey(answerRaw) {
    return parseAnswerLetters(answerRaw).join(',');
}
function isMultiSelectAnswer(answerRaw) {
    return parseAnswerLetters(answerRaw).length > 1;
}
const currentIsMulti = computed(() => isMultiSelectAnswer(String(currentQ.value?.answer ?? '')));
function getOptionLineCount(q) {
    const raw = String(q?.options ?? '').trim();
    if (!raw)
        return 0;
    return raw.split(/\n|\|/).map(s => s.trim()).filter(Boolean).length;
}
function slotExamReady(slot, q) {
    if (!slot)
        return false;
    if (slot.skipped || slot.blankDone)
        return true;
    const oc = getOptionLineCount(q);
    if (oc === 0)
        return !!slot.blankDone;
    return !!String(slot.picked || '').trim();
}
const gradingVisibleForCurrent = computed(() => examSheetSubmitted.value);
function optionButtonClass(line, oi) {
    const letter = letterForLine(line, oi);
    const rev = gradingVisibleForCurrent.value;
    const ansLetters = parseAnswerLetters(String(currentQ.value?.answer || ''));
    const pickedLetters = parseAnswerLetters(String(quizSlots.value[qIdx.value]?.picked ?? ''));
    const inAns = ansLetters.includes(letter);
    const picked = pickedLetters.includes(letter);
    if (!rev)
        return { pick: picked };
    const single = ansLetters.length <= 1;
    const ansOnly = ansLetters[0];
    if (single) {
        return {
            ok: !!ansOnly && letter === ansOnly,
            bad: picked && !!ansOnly && letter !== ansOnly,
        };
    }
    return {
        ok: inAns && picked,
        'ok-miss': inAns && !picked,
        bad: picked && !inAns,
    };
}
const analysisExamHtml = computed(() => {
    const s = String(currentQ.value?.analysis || '').trim();
    if (!s)
        return '';
    return escapeHtml(s).replace(/\n/g, '<br/>');
});
function mergeRunningSegmentIntoAccum() {
    let ms = examActiveMsAccum.value;
    if (!examTimerPaused.value && examSegmentStartedAt.value) {
        ms += Date.now() - examSegmentStartedAt.value;
    }
    return ms;
}
function resetExamTimerForNewSession() {
    examActiveMsAccum.value = 0;
    examSegmentStartedAt.value = Date.now();
    examTimerPaused.value = false;
}
function stopExamTimerDisplay() {
    if (examTickTimer)
        clearInterval(examTickTimer);
    examTickTimer = null;
}
function startExamTimerDisplay() {
    stopExamTimerDisplay();
    examTickTimer = setInterval(() => {
        examDisplayTick.value++;
    }, 800);
}
function toggleExamPause() {
    if (examSheetSubmitted.value)
        return;
    if (examTimerPaused.value) {
        examTimerPaused.value = false;
        examSegmentStartedAt.value = Date.now();
    }
    else {
        examActiveMsAccum.value = mergeRunningSegmentIntoAccum();
        examSegmentStartedAt.value = 0;
        examTimerPaused.value = true;
    }
}
const examClockText = computed(() => {
    void examDisplayTick.value;
    const sec = Math.floor(mergeRunningSegmentIntoAccum() / 1000);
    const mm = Math.floor(sec / 60);
    const ss = sec % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
});
const currentExamSlotReady = computed(() => {
    if (examSheetSubmitted.value)
        return true;
    return slotExamReady(quizSlots.value[qIdx.value], currentQ.value);
});
const examNextLocked = computed(() => !examSheetSubmitted.value && !currentExamSlotReady.value);
const footerNextBlocked = computed(() => {
    if (examSheetSubmitted.value && questions.value.length && qIdx.value >= questions.value.length - 1)
        return true;
    return examNextLocked.value;
});
const quizTitle = computed(() => {
    const mod = sessionModuleLabel.value || '模块练习';
    return `广东套卷题库 · ${TRACK_LABEL[sessionTrack.value]} · ${mod}`;
});
const sheetGroups = computed(() => {
    const qs = questions.value;
    if (!qs.length)
        return [];
    const groups = [];
    for (let i = 0; i < qs.length; i++) {
        const m = qs[i]?.meta;
        const title = typeof m?.section_heading === 'string' && m.section_heading.trim()
            ? String(m.section_heading).trim()
            : '题目';
        const last = groups[groups.length - 1];
        if (last && last.title === title)
            last.indices.push(i);
        else
            groups.push({ title, indices: [i] });
    }
    return groups;
});
function displayQuestionNo(i) {
    const q = questions.value[i];
    return String(q?.question_no || i + 1);
}
function jumpQuestion(i) {
    if (i < 0 || i >= questions.value.length)
        return;
    qIdx.value = i;
}
function sheetCellClass(i) {
    const slot = quizSlots.value[i];
    const q = questions.value[i];
    const ansKey = canonicalAnswerKey(String(q?.answer || ''));
    const pickKey = canonicalPickKey(slot?.picked ?? null);
    const cur = i === qIdx.value;
    const graded = !!(slot?.revealed && examSheetSubmitted.value);
    const hasPick = !!pickKey;
    const correct = ansKey !== '' && ansKey === pickKey;
    const wrong = hasPick && ansKey !== pickKey;
    return {
        'is-current': cur,
        'is-touched': !graded && hasPick,
        'is-right': graded && correct && hasPick,
        'is-wrong': graded && wrong,
        'is-skip': graded && !hasPick,
    };
}
async function refreshMeta() {
    metaLoading.value = true;
    loadErr.value = '';
    try {
        const ys = [...selectedYears.value].sort((a, b) => a - b);
        const m = await bankDrillApi.meta(examTrack.value, ys);
        meta.value = m;
        if (!ys.length && m.default_years?.length) {
            selectedYears.value = m.default_years.filter(y => m.year_catalog.includes(y));
        }
    }
    catch (e) {
        loadErr.value = String(e.message || e);
        meta.value = null;
    }
    finally {
        metaLoading.value = false;
    }
}
function toggleYear(y) {
    const set = new Set(selectedYears.value);
    if (set.has(y)) {
        if (set.size <= 1)
            return;
        set.delete(y);
    }
    else {
        set.add(y);
    }
    selectedYears.value = [...set].sort((a, b) => b - a);
}
function restoreDefaultYears() {
    const m = meta.value;
    const cy = new Date().getFullYear();
    const fallback = [cy - 4, cy - 3, cy - 2, cy - 1, cy];
    const src = m?.default_years?.length ? m.default_years : fallback;
    const cat = new Set(m?.year_catalog ?? []);
    selectedYears.value = src.filter(y => cat.has(y)).sort((a, b) => b - a);
    if (!selectedYears.value.length && m?.year_catalog?.length) {
        selectedYears.value = [...m.year_catalog].slice(0, Math.min(5, m.year_catalog.length));
    }
}
watch([examTrack, selectedYears], () => {
    void refreshMeta();
}, { deep: true, immediate: true });
async function startModule(mid) {
    loadErr.value = '';
    try {
        const res = await bankDrillApi.start({
            exam_track: examTrack.value,
            major_module: mid,
            count: Math.min(80, Math.max(1, drillCount.value)),
            years: selectedYears.value,
        });
        if (!res.questions?.length) {
            window.alert('当前筛选条件下本题池为空，请扩大年份范围或检查题库是否已导入。');
            return;
        }
        sessionId.value = res.session_id;
        sessionTrack.value = examTrack.value;
        sessionYears.value = [...res.years];
        sessionModuleId.value = res.major_module;
        sessionModuleLabel.value = res.major_module_label;
        requestedCount.value = res.requested_count;
        questions.value = res.questions;
        quizSlots.value = res.questions.map(() => ({ picked: null, revealed: false }));
        qIdx.value = 0;
        sheetExpanded.value = true;
        examSheetSubmitted.value = false;
        examRecordSaved.value = false;
        resetExamTimerForNewSession();
        startExamTimerDisplay();
        phase.value = 'quiz';
    }
    catch (e) {
        loadErr.value = String(e.message || e);
    }
}
function revealAllExamSlots() {
    quizSlots.value.forEach(s => {
        if (s)
            s.revealed = true;
    });
}
function countExamUnanswered() {
    let n = 0;
    for (let i = 0; i < questions.value.length; i++) {
        if (!slotExamReady(quizSlots.value[i], questions.value[i]))
            n++;
    }
    return n;
}
async function persistExamPracticeRecord() {
    if (examRecordSaved.value || !questions.value.length)
        return;
    try {
        const items = [];
        let correctCount = 0;
        let wrongCount = 0;
        let unansweredCount = 0;
        const submittedCount = questions.value.length;
        for (let i = 0; i < questions.value.length; i++) {
            const slot = quizSlots.value[i];
            const qrow = questions.value[i];
            const oc = getOptionLineCount(qrow);
            const pickTrim = String(slot?.picked || '').trim();
            const explicitSkip = !!slot?.skipped;
            const blankAck = !!slot?.blankDone;
            const unansweredRow = !explicitSkip && (oc > 0 ? !pickTrim : !blankAck);
            const skippedForApi = explicitSkip || unansweredRow;
            const ak = canonicalAnswerKey(String(qrow?.answer || ''));
            let rowCorrect = false;
            if (!skippedForApi && pickTrim) {
                const pk = canonicalPickKey(slot.picked);
                rowCorrect = ak !== '' && ak === pk;
            }
            if (skippedForApi)
                unansweredCount += 1;
            else if (rowCorrect)
                correctCount += 1;
            else
                wrongCount += 1;
            items.push({
                question_id: String(qrow.id),
                question_no: String(qrow.question_no || ''),
                picked: skippedForApi ? null : slot?.picked ?? null,
                answer: String(qrow.answer || ''),
                correct: rowCorrect && !skippedForApi && !!pickTrim,
                skipped: skippedForApi,
            });
        }
        const durationSec = Math.max(0, Math.floor(mergeRunningSegmentIntoAccum() / 1000));
        await suiteBankApi.appendPracticeRecord({
            paper_id: BANK_DRILL_PAPER_ID,
            paper_title: quizTitle.value,
            paper_folder: `广东 · ${TRACK_LABEL[sessionTrack.value]} · ${sessionYears.value.join(',')}年`,
            mode: 'exam',
            duration_sec: durationSec,
            correct_count: correctCount,
            wrong_count: wrongCount,
            unanswered_count: unansweredCount,
            submitted_count: submittedCount,
            items,
            practice_subtype: 'bank_module_drill',
            bank_drill_session_id: sessionId.value,
            bank_drill_exam_track: sessionTrack.value,
            bank_drill_years: [...sessionYears.value],
            bank_drill_major_module: sessionModuleId.value,
            bank_drill_requested_count: requestedCount.value,
        });
        examRecordSaved.value = true;
    }
    catch {
        /* ignore */
    }
}
async function confirmSubmitExamSheet() {
    if (examRecordSaved.value || examSheetSubmitted.value)
        return;
    if (!questions.value.length)
        return;
    const touched = quizSlots.value.some(s => !!(s.skipped || s.blankDone || String(s.picked || '').trim()));
    if (!touched) {
        window.alert('尚未作答任何题目，无法交卷。');
        return;
    }
    const remain = countExamUnanswered();
    if (remain && !window.confirm(`还有 ${remain} 题未完成，将以未作答记入记录。确定交卷？`))
        return;
    if (!remain && !window.confirm('确定交卷？交卷后可查看参考答案与解析。'))
        return;
    examActiveMsAccum.value = mergeRunningSegmentIntoAccum();
    examSegmentStartedAt.value = Date.now();
    examTimerPaused.value = true;
    examSheetSubmitted.value = true;
    revealAllExamSlots();
    await persistExamPracticeRecord();
}
function pickLetter(L) {
    const slot = quizSlots.value[qIdx.value];
    if (!slot || slot.revealed || examSheetSubmitted.value)
        return;
    const ansRaw = String(currentQ.value?.answer || '');
    if (!isMultiSelectAnswer(ansRaw)) {
        slot.picked = L;
        if (!examSheetSubmitted.value && getOptionLineCount(currentQ.value) > 0) {
            nextTick(() => nextQuestion());
        }
        return;
    }
    const cur = parseAnswerLetters(slot.picked || '');
    const set = new Set(cur);
    if (set.has(L))
        set.delete(L);
    else
        set.add(L);
    const next = [...set].sort();
    slot.picked = next.length ? next.join(',') : null;
}
function submitExamQuestion() {
    if (examSheetSubmitted.value)
        return;
    const slot = quizSlots.value[qIdx.value];
    if (!slot || slot.revealed)
        return;
    if (currentHasOptions.value)
        return;
    slot.blankDone = true;
}
function skipExamQuestion() {
    if (examSheetSubmitted.value)
        return;
    const slot = quizSlots.value[qIdx.value];
    if (!slot || slot.revealed)
        return;
    slot.picked = null;
    slot.skipped = true;
    slot.blankDone = false;
}
function nextQuestion() {
    if (examNextLocked.value)
        return;
    if (qIdx.value + 1 >= questions.value.length) {
        if (!examSheetSubmitted.value)
            void confirmSubmitExamSheet();
        return;
    }
    qIdx.value += 1;
}
function handleFooterNext() {
    if (footerNextBlocked.value) {
        if (examNextLocked.value) {
            window.alert('请先完成本题：有选项时选好选项后点「下一题」即可；亦可点「不会做」。无选项题点「本题无选项，继续」。');
        }
        return;
    }
    nextQuestion();
}
function backToSetup() {
    stopExamTimerDisplay();
    phase.value = 'setup';
    questions.value = [];
    quizSlots.value = [];
    qIdx.value = 0;
    examSheetSubmitted.value = false;
    examRecordSaved.value = false;
    void refreshMeta();
}
function goWorkspace() {
    void router.push({ name: 'XingceWorkspace' });
}
function goSuiteBank() {
    void router.push({ name: 'XingceSuiteBank' });
}
function goPortal() {
    void router.push({ name: 'ModulePortal', query: { portal: '1' } });
}
onBeforeUnmount(() => {
    stopExamTimerDisplay();
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['bd-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['active']} */ ;
/** @type {__VLS_StyleScopedClasses['bd-mod-card']} */ ;
/** @type {__VLS_StyleScopedClasses['bd-mod-card']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-opt']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-opt']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-opt']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-opt']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-sheet-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-sheet-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-sheet-cell']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sb-page" },
    ...{ class: ({ 'sb-page--quiz': __VLS_ctx.phase === 'quiz' && __VLS_ctx.questions.length }) },
});
/** @type {__VLS_StyleScopedClasses['sb-page']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-page--quiz']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "sb-head" },
});
/** @type {__VLS_StyleScopedClasses['sb-head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sb-head-row" },
});
/** @type {__VLS_StyleScopedClasses['sb-head-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({
    ...{ class: "sb-title" },
});
/** @type {__VLS_StyleScopedClasses['sb-title']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sb-actions" },
});
/** @type {__VLS_StyleScopedClasses['sb-actions']} */ ;
if (__VLS_ctx.phase === 'quiz') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.backToSetup) },
        type: "button",
        ...{ class: "btn btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.goSuiteBank) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.goWorkspace) },
    type: "button",
    ...{ class: "btn btn-secondary" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.goPortal) },
    type: "button",
    ...{ class: "btn btn-ghost" },
});
/** @type {__VLS_StyleScopedClasses['btn']} */ ;
/** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "sb-meta" },
});
/** @type {__VLS_StyleScopedClasses['sb-meta']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
if (__VLS_ctx.loadErr) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "sb-err" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-err']} */ ;
    (__VLS_ctx.loadErr);
}
if (__VLS_ctx.phase === 'setup') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "bd-setup" },
    });
    /** @type {__VLS_StyleScopedClasses['bd-setup']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "bd-row" },
    });
    /** @type {__VLS_StyleScopedClasses['bd-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "bd-label" },
    });
    /** @type {__VLS_StyleScopedClasses['bd-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "bd-tabs" },
    });
    /** @type {__VLS_StyleScopedClasses['bd-tabs']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.phase === 'setup'))
                    return;
                __VLS_ctx.examTrack = 'provincial';
                // @ts-ignore
                [phase, phase, phase, questions, backToSetup, goSuiteBank, goWorkspace, goPortal, loadErr, loadErr, examTrack,];
            } },
        type: "button",
        ...{ class: "bd-tab" },
        ...{ class: ({ active: __VLS_ctx.examTrack === 'provincial' }) },
    });
    /** @type {__VLS_StyleScopedClasses['bd-tab']} */ ;
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.phase === 'setup'))
                    return;
                __VLS_ctx.examTrack = 'unified';
                // @ts-ignore
                [examTrack, examTrack,];
            } },
        type: "button",
        ...{ class: "bd-tab" },
        ...{ class: ({ active: __VLS_ctx.examTrack === 'unified' }) },
    });
    /** @type {__VLS_StyleScopedClasses['bd-tab']} */ ;
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "bd-row bd-years-row" },
    });
    /** @type {__VLS_StyleScopedClasses['bd-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['bd-years-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "bd-label" },
    });
    /** @type {__VLS_StyleScopedClasses['bd-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sb-years" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-years']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.restoreDefaultYears) },
        type: "button",
        ...{ class: "sb-chip" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-chip']} */ ;
    for (const [y] of __VLS_vFor((__VLS_ctx.meta?.year_catalog ?? []))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.phase === 'setup'))
                        return;
                    __VLS_ctx.toggleYear(y);
                    // @ts-ignore
                    [examTrack, restoreDefaultYears, meta, toggleYear,];
                } },
            key: (y),
            type: "button",
            ...{ class: "sb-chip" },
            ...{ class: ({ active: __VLS_ctx.selectedYears.includes(y) }) },
        });
        /** @type {__VLS_StyleScopedClasses['sb-chip']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        (y);
        // @ts-ignore
        [selectedYears,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "bd-row bd-count-row" },
    });
    /** @type {__VLS_StyleScopedClasses['bd-row']} */ ;
    /** @type {__VLS_StyleScopedClasses['bd-count-row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "bd-label" },
    });
    /** @type {__VLS_StyleScopedClasses['bd-label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ class: "bd-count-input" },
        type: "number",
        min: "1",
        max: "80",
    });
    (__VLS_ctx.drillCount);
    /** @type {__VLS_StyleScopedClasses['bd-count-input']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "bd-hint" },
    });
    /** @type {__VLS_StyleScopedClasses['bd-hint']} */ ;
    if (__VLS_ctx.metaLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "sb-loading" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-loading']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "bd-modules" },
        });
        /** @type {__VLS_StyleScopedClasses['bd-modules']} */ ;
        for (const [m] of __VLS_vFor((__VLS_ctx.meta?.modules ?? []))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.phase === 'setup'))
                            return;
                        if (!!(__VLS_ctx.metaLoading))
                            return;
                        __VLS_ctx.startModule(m.id);
                        // @ts-ignore
                        [meta, drillCount, metaLoading, startModule,];
                    } },
                key: (m.id),
                type: "button",
                ...{ class: "bd-mod-card" },
                disabled: (m.count <= 0),
            });
            /** @type {__VLS_StyleScopedClasses['bd-mod-card']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "bd-mod-title" },
            });
            /** @type {__VLS_StyleScopedClasses['bd-mod-title']} */ ;
            (m.label);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "bd-mod-sub" },
            });
            /** @type {__VLS_StyleScopedClasses['bd-mod-sub']} */ ;
            (m.count);
            // @ts-ignore
            [];
        }
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sb-quiz" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-quiz']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "sb-quiz-title" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-quiz-title']} */ ;
    (__VLS_ctx.quizTitle);
    if (__VLS_ctx.currentQ?.paper_title) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-src-line" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-src-line']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (__VLS_ctx.currentQ.paper_title);
    }
    if (!__VLS_ctx.examSheetSubmitted) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-exam-hint" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-exam-hint']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (__VLS_ctx.questions.length);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-exam-done-banner" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-exam-done-banner']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.backToSetup) },
            type: "button",
            ...{ class: "btn btn-secondary sb-exam-done-back" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
        /** @type {__VLS_StyleScopedClasses['sb-exam-done-back']} */ ;
    }
    if (!__VLS_ctx.examSheetSubmitted) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-exam-toolbar" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-exam-toolbar']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "sb-exam-clock" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-exam-clock']} */ ;
        (__VLS_ctx.examClockText);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.toggleExamPause) },
            type: "button",
            ...{ class: "btn btn-secondary" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
        (__VLS_ctx.examTimerPaused ? '继续计时' : '暂停');
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.confirmSubmitExamSheet) },
            type: "button",
            ...{ class: "btn btn-secondary" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    }
    if (__VLS_ctx.currentQ) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-quiz-meta" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-quiz-meta']} */ ;
        (__VLS_ctx.qIdx + 1);
        (__VLS_ctx.questions.length);
        (__VLS_ctx.currentQ.question_no || __VLS_ctx.qIdx + 1);
        if (__VLS_ctx.currentIsMulti) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "sb-multi-tag" },
            });
            /** @type {__VLS_StyleScopedClasses['sb-multi-tag']} */ ;
        }
    }
    if (__VLS_ctx.currentQ && __VLS_ctx.sectionBanner) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-section" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-section']} */ ;
        (__VLS_ctx.sectionBanner);
    }
    if (__VLS_ctx.currentQ && __VLS_ctx.sharedMaterialRaw) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-material-card" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-material-card']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-material-label" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-material-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-stem-rich sb-material-body" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vHtml, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.sharedMaterialHtml) }, null, null);
        /** @type {__VLS_StyleScopedClasses['sb-stem-rich']} */ ;
        /** @type {__VLS_StyleScopedClasses['sb-material-body']} */ ;
    }
    if (__VLS_ctx.stemImageSrc) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
            ...{ class: "sb-stem-img" },
            src: (__VLS_ctx.stemImageSrc),
            alt: "题干插图",
        });
        /** @type {__VLS_StyleScopedClasses['sb-stem-img']} */ ;
    }
    if (__VLS_ctx.currentQ) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-stem sb-stem-rich" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vHtml, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.stemHtml) }, null, null);
        /** @type {__VLS_StyleScopedClasses['sb-stem']} */ ;
        /** @type {__VLS_StyleScopedClasses['sb-stem-rich']} */ ;
    }
    if (__VLS_ctx.currentQ && __VLS_ctx.optionLines.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-opts" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-opts']} */ ;
        for (const [line, oi] of __VLS_vFor((__VLS_ctx.optionLines))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.phase === 'setup'))
                            return;
                        if (!(__VLS_ctx.currentQ && __VLS_ctx.optionLines.length))
                            return;
                        __VLS_ctx.pickLetter(__VLS_ctx.letterForLine(line, oi));
                        // @ts-ignore
                        [questions, questions, backToSetup, quizTitle, currentQ, currentQ, currentQ, currentQ, currentQ, currentQ, currentQ, currentQ, examSheetSubmitted, examSheetSubmitted, examClockText, toggleExamPause, examTimerPaused, confirmSubmitExamSheet, qIdx, qIdx, currentIsMulti, sectionBanner, sectionBanner, sharedMaterialRaw, sharedMaterialHtml, stemImageSrc, stemImageSrc, stemHtml, optionLines, optionLines, pickLetter, letterForLine,];
                    } },
                key: (oi),
                type: "button",
                ...{ class: "sb-opt" },
                ...{ class: (__VLS_ctx.optionButtonClass(line, oi)) },
            });
            /** @type {__VLS_StyleScopedClasses['sb-opt']} */ ;
            if (__VLS_ctx.optionLineHasImg(line)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                    ...{ class: "sb-opt-inner" },
                });
                __VLS_asFunctionalDirective(__VLS_directives.vHtml, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.richOptionHtml(line)) }, null, null);
                /** @type {__VLS_StyleScopedClasses['sb-opt-inner']} */ ;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "sb-opt-inner" },
                });
                /** @type {__VLS_StyleScopedClasses['sb-opt-inner']} */ ;
                (line);
            }
            // @ts-ignore
            [optionButtonClass, optionLineHasImg, richOptionHtml,];
        }
    }
    else if (__VLS_ctx.currentQ) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-no-opt" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-no-opt']} */ ;
    }
    if (__VLS_ctx.gradingVisibleForCurrent && __VLS_ctx.currentQ?.answer) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-answer" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-answer']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (__VLS_ctx.currentQ.answer);
    }
    if (__VLS_ctx.gradingVisibleForCurrent && __VLS_ctx.currentQ?.analysis) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-analysis-wrap" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-analysis-wrap']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-analysis-label" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-analysis-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-analysis-body" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vHtml, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.analysisExamHtml) }, null, null);
        /** @type {__VLS_StyleScopedClasses['sb-analysis-body']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sb-bar" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-bar']} */ ;
    if (!__VLS_ctx.examSheetSubmitted) {
        if (!__VLS_ctx.currentHasOptions) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.submitExamQuestion) },
                type: "button",
                ...{ class: "btn btn-primary" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
        }
        if (__VLS_ctx.currentHasOptions) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.skipExamQuestion) },
                type: "button",
                ...{ class: "btn btn-secondary" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.handleFooterNext) },
        type: "button",
        ...{ class: "btn btn-primary sb-footer-next" },
        ...{ class: ({ 'sb-footer-next--blocked': __VLS_ctx.footerNextBlocked }) },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    /** @type {__VLS_StyleScopedClasses['sb-footer-next']} */ ;
    /** @type {__VLS_StyleScopedClasses['sb-footer-next--blocked']} */ ;
    (__VLS_ctx.examSheetSubmitted && __VLS_ctx.qIdx >= __VLS_ctx.questions.length - 1 ? '已是最后一题' : '下一题');
    if (__VLS_ctx.questions.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
            ...{ class: "sb-sheet-dock" },
            'aria-label': "答题卡",
        });
        /** @type {__VLS_StyleScopedClasses['sb-sheet-dock']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.phase === 'setup'))
                        return;
                    if (!(__VLS_ctx.questions.length))
                        return;
                    __VLS_ctx.sheetExpanded = !__VLS_ctx.sheetExpanded;
                    // @ts-ignore
                    [questions, questions, currentQ, currentQ, currentQ, currentQ, examSheetSubmitted, examSheetSubmitted, qIdx, gradingVisibleForCurrent, gradingVisibleForCurrent, analysisExamHtml, currentHasOptions, currentHasOptions, submitExamQuestion, skipExamQuestion, handleFooterNext, footerNextBlocked, sheetExpanded, sheetExpanded,];
                } },
            type: "button",
            ...{ class: "sb-sheet-tab" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-sheet-tab']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "sb-sheet-tab-label" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-sheet-tab-label']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "sb-sheet-caret" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-sheet-caret']} */ ;
        (__VLS_ctx.sheetExpanded ? '▼' : '▲');
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-sheet-panel" },
        });
        __VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.sheetExpanded) }, null, null);
        /** @type {__VLS_StyleScopedClasses['sb-sheet-panel']} */ ;
        for (const [g, gi] of __VLS_vFor((__VLS_ctx.sheetGroups))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                key: (gi),
                ...{ class: "sb-sheet-group" },
            });
            /** @type {__VLS_StyleScopedClasses['sb-sheet-group']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "sb-sheet-group-title" },
            });
            /** @type {__VLS_StyleScopedClasses['sb-sheet-group-title']} */ ;
            (g.title);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "sb-sheet-grid" },
            });
            /** @type {__VLS_StyleScopedClasses['sb-sheet-grid']} */ ;
            for (const [idx] of __VLS_vFor((g.indices))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.phase === 'setup'))
                                return;
                            if (!(__VLS_ctx.questions.length))
                                return;
                            __VLS_ctx.jumpQuestion(idx);
                            // @ts-ignore
                            [sheetExpanded, sheetExpanded, sheetGroups, jumpQuestion,];
                        } },
                    key: (idx),
                    type: "button",
                    ...{ class: "sb-sheet-cell" },
                    ...{ class: (__VLS_ctx.sheetCellClass(idx)) },
                });
                /** @type {__VLS_StyleScopedClasses['sb-sheet-cell']} */ ;
                (__VLS_ctx.displayQuestionNo(idx));
                // @ts-ignore
                [sheetCellClass, displayQuestionNo,];
            }
            // @ts-ignore
            [];
        }
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
