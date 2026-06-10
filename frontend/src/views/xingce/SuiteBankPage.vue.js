/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/USER/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { suiteBankApi } from '@/api/suiteBank';
import GlobalSearchModal from '@/components/xingce/GlobalSearchModal.vue';
const router = useRouter();
const route = useRoute();
/** Router query 可能是 string | string[]，重复参数时直接 String(query) 会变成 "a,b"，导致误判模式 */
function firstQueryValue(v) {
    if (v == null)
        return '';
    if (Array.isArray(v))
        return String(v[0] ?? '').trim();
    return String(v).trim();
}
const showGlobalSearch = ref(false);
const loading = ref(true);
const loadErr = ref('');
const papers = ref([]);
const filter = ref('');
/** 未选题库类型时为 null，入口先选省考 / 统考 */
const examChoice = ref(null);
const selectedYear = ref('');
const mode = ref('list');
const activePaperTitle = ref('');
const questions = ref([]);
const qIdx = ref(0);
const quizSlots = ref([]);
const sheetExpanded = ref(true);
const booted = ref(false);
/** preview：随时「看答案」；exam：整场不交卷不批改，整体交卷后统一揭晓 */
const sessionPracticeMode = ref('preview');
const examSheetSubmitted = ref(false);
const examRecordSaved = ref(false);
const quizPaperId = ref('');
const quizPaperFolder = ref('');
const showPracticeRecords = ref(false);
const practiceRecords = ref([]);
const practiceRecordsLoading = ref(false);
const draftListRev = ref(0);
/** 做题模式草稿（未交卷），按套卷 id 存 sessionStorage */
const EXAM_DRAFT_KEY_PREFIX = 'xingce_suite_exam_draft_v1:';
/** 有效计时：累计 + 当前运行段 */
const examActiveMsAccum = ref(0);
const examSegmentStartedAt = ref(0);
const examTimerPaused = ref(false);
const examDisplayTick = ref(0);
let examTickTimer = null;
function examDraftStorageKey(paperId) {
    return EXAM_DRAFT_KEY_PREFIX + paperId;
}
function mergeRunningSegmentIntoAccum() {
    let ms = examActiveMsAccum.value;
    if (!examTimerPaused.value && examSegmentStartedAt.value) {
        ms += Date.now() - examSegmentStartedAt.value;
    }
    return ms;
}
function getExamElapsedMs() {
    void examDisplayTick.value;
    if (examTimerPaused.value)
        return examActiveMsAccum.value;
    if (!examSegmentStartedAt.value)
        return examActiveMsAccum.value;
    return examActiveMsAccum.value + (Date.now() - examSegmentStartedAt.value);
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
    if (sessionPracticeMode.value !== 'exam' || examSheetSubmitted.value)
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
function examHasMeaningfulProgress() {
    return (quizSlots.value.some(s => !!(s?.picked?.trim?.() || s?.skipped || s?.blankDone || s?.lockedIn || s?.revealed)) ||
        qIdx.value > 0 ||
        mergeRunningSegmentIntoAccum() > 3000);
}
function saveExamDraftToStorage() {
    if (sessionPracticeMode.value !== 'exam' || !quizPaperId.value || !questions.value.length)
        return;
    if (!examHasMeaningfulProgress()) {
        try {
            sessionStorage.removeItem(examDraftStorageKey(quizPaperId.value));
            draftListRev.value++;
        }
        catch {
            /* ignore */
        }
        return;
    }
    try {
        const activeMsAccum = mergeRunningSegmentIntoAccum();
        const draft = {
            v: 1,
            paperId: quizPaperId.value,
            paperTitle: activePaperTitle.value,
            paperFolder: quizPaperFolder.value,
            qIdx: qIdx.value,
            slots: quizSlots.value.map(s => ({ ...s })),
            activeMsAccum,
            paused: true,
            questionCount: questions.value.length,
        };
        sessionStorage.setItem(examDraftStorageKey(quizPaperId.value), JSON.stringify(draft));
        draftListRev.value++;
    }
    catch {
        /* ignore */
    }
}
function clearExamDraftForPaper(paperId) {
    try {
        sessionStorage.removeItem(examDraftStorageKey(paperId));
        draftListRev.value++;
    }
    catch {
        /* ignore */
    }
}
/** 切换到其它题目前，把当前套卷计时合并进草稿 */
function stashCurrentExamBeforeNavigation() {
    if (sessionPracticeMode.value !== 'exam' || !quizPaperId.value || !questions.value.length)
        return;
    saveExamDraftToStorage();
}
function tryRestoreExamDraft(paperId, focusQid) {
    if (firstQueryValue(route.query.examNew) === '1') {
        clearExamDraftForPaper(paperId);
        return false;
    }
    try {
        const raw = sessionStorage.getItem(examDraftStorageKey(paperId));
        if (!raw)
            return false;
        const draft = JSON.parse(raw);
        if (draft?.v !== 1 || draft.paperId !== paperId || draft.questionCount !== questions.value.length)
            return false;
        quizSlots.value = (draft.slots || []).slice(0, questions.value.length).map(s => ({
            picked: s?.picked ?? null,
            revealed: false,
            skipped: !!s?.skipped,
            blankDone: !!s?.blankDone,
            lockedIn: !!s?.lockedIn,
        }));
        while (quizSlots.value.length < questions.value.length)
            quizSlots.value.push({ picked: null, revealed: false });
        qIdx.value = Math.min(Math.max(0, draft.qIdx || 0), Math.max(0, questions.value.length - 1));
        examActiveMsAccum.value = Math.max(0, draft.activeMsAccum || 0);
        examSegmentStartedAt.value = 0;
        examTimerPaused.value = true;
        if (focusQid) {
            const ix = questions.value.findIndex(x => String(x.id) === String(focusQid));
            if (ix >= 0)
                qIdx.value = ix;
        }
        return true;
    }
    catch {
        return false;
    }
}
const draftSummaries = computed(() => {
    void draftListRev.value;
    const rows = [];
    try {
        const seen = new Set();
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (!key || !key.startsWith(EXAM_DRAFT_KEY_PREFIX))
                continue;
            const raw = sessionStorage.getItem(key);
            if (!raw || seen.has(key))
                continue;
            seen.add(key);
            const draft = JSON.parse(raw);
            if (draft?.v !== 1 || !draft.paperId)
                continue;
            const answered = draft.slots?.filter(s => !!(s?.skipped || s?.blankDone || s?.lockedIn || String(s?.picked || '').trim())).length ?? 0;
            rows.push({
                paperId: draft.paperId,
                title: draft.paperTitle || '未命名',
                folder: draft.paperFolder || '',
                answered,
                total: draft.questionCount || 0,
                updatedHint: '',
            });
        }
    }
    catch {
        /* ignore */
    }
    return rows.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
});
const examClockText = computed(() => {
    void examDisplayTick.value;
    const sec = Math.floor(getExamElapsedMs() / 1000);
    const mm = Math.floor(sec / 60);
    const ss = sec % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
});
function paperHaystack(p) {
    return `${p.folder}\u0000${p.title}\u0000${p.source_rel_path}`;
}
/**
 * 与素材目录一致：顶层文件夹即类型（例：广东省考 → 省考，广东统考 → 统考）。
 * 优先读 folder；文件夹无法识别时再读标题与路径。
 */
function classifyFromPathText(s) {
    const t = String(s || '');
    if (/统考/.test(t))
        return 'unified';
    if (/省考/.test(t))
        return 'province';
    return null;
}
function classifyExam(p) {
    const fromFolder = classifyFromPathText(p.folder);
    if (fromFolder)
        return fromFolder;
    const fromRest = classifyFromPathText(`${p.title}\u0000${p.source_rel_path}`);
    if (fromRest)
        return fromRest;
    return 'other';
}
function paperYear(p) {
    const s = paperHaystack(p).replace(/\s+/g, '');
    const m = s.match(/(?:^|[^\d])(20\d{2}|19\d{2})(?:[^\d]|$)/);
    return m ? m[1] : null;
}
const examLabel = {
    province: '省考',
    unified: '统考',
    other: '其他',
};
const papersForExam = computed(() => {
    if (!examChoice.value)
        return [];
    const k = examChoice.value;
    return papers.value.filter(p => classifyExam(p) === k);
});
const yearOptions = computed(() => {
    const ys = new Set();
    for (const p of papersForExam.value) {
        const y = paperYear(p);
        if (y)
            ys.add(y);
    }
    return [...ys].sort((a, b) => b.localeCompare(a));
});
const otherPaperCount = computed(() => papers.value.filter(p => classifyExam(p) === 'other').length);
const filteredPapers = computed(() => {
    let list = papersForExam.value;
    if (selectedYear.value)
        list = list.filter(p => paperYear(p) === selectedYear.value);
    const q = filter.value.trim().toLowerCase();
    if (q) {
        list = list.filter(p => {
            const b = `${p.title} ${p.folder} ${p.source_rel_path}`.toLowerCase();
            return b.includes(q);
        });
    }
    return [...list].sort((a, b) => {
        const ya = paperYear(a);
        const yb = paperYear(b);
        if (ya !== yb) {
            if (!ya)
                return 1;
            if (!yb)
                return -1;
            return yb.localeCompare(ya);
        }
        return String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN');
    });
});
function syncListQuery() {
    const q = {};
    if (examChoice.value)
        q.exam = examChoice.value;
    if (selectedYear.value)
        q.year = selectedYear.value;
    void router.replace({ name: 'XingceSuiteBank', query: q });
}
function pickExam(kind) {
    examChoice.value = kind;
    selectedYear.value = '';
    filter.value = '';
    syncListQuery();
}
function changeExamType() {
    examChoice.value = null;
    selectedYear.value = '';
    filter.value = '';
    void router.replace({ name: 'XingceSuiteBank', query: {} });
}
function setYear(y) {
    selectedYear.value = y;
    syncListQuery();
}
const currentQ = computed(() => questions.value[qIdx.value] ?? null);
const sectionBanner = computed(() => {
    const m = currentQ.value?.meta;
    const s = m?.section_heading;
    return typeof s === 'string' && s.trim() ? s.trim() : '';
});
/** img_data：导入脚本写入的 data:image/*;base64,... */
const stemImageSrc = computed(() => {
    const raw = String(currentQ.value?.img_data ?? '').trim();
    if (!raw)
        return '';
    if (raw.startsWith('data:'))
        return raw;
    return `data:image/png;base64,${raw}`;
});
const currentPicked = computed(() => quizSlots.value[qIdx.value]?.picked ?? null);
const currentRevealed = computed(() => quizSlots.value[qIdx.value]?.revealed ?? false);
/** 当前题：选项对错色、参考答案、解析（预览=点「看答案」后；做题=整场交卷后） */
const gradingVisibleForCurrent = computed(() => {
    if (sessionPracticeMode.value === 'preview')
        return currentRevealed.value;
    if (sessionPracticeMode.value === 'exam')
        return examSheetSubmitted.value;
    return false;
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
/** Word 行内插图入库为 `<img class="sb-inline-img" src="data:…">`，仅允许 data:image base64 */
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
const stemHtml = computed(() => mergeStemRich(String(currentQ.value?.stem ?? '')));
/** 资料分析等多题共用：上一题答案后与下一题小题头之间的段落（导入写入 meta.shared_material） */
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
    let graded = false;
    const m = sessionPracticeMode.value;
    if (m === 'exam')
        graded = !!(slot?.revealed && examSheetSubmitted.value);
    else if (m === 'preview')
        graded = !!slot?.revealed;
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
function isWordImportPaper(p) {
    return String(p.source_rel_path || '').startsWith('word版本/');
}
const optionLines = computed(() => {
    const raw = String(currentQ.value?.options ?? '').trim();
    if (!raw)
        return [];
    return raw.split(/\n|\|/).map(s => s.trim()).filter(Boolean);
});
/** 本题是否有可选项行（导入失败时可为空——须允许先做不卡「下一题」） */
const currentHasOptions = computed(() => optionLines.value.length > 0);
function letterForLine(line, oi) {
    const plain = stripInlineMarkup(line);
    const m = plain.match(/^([A-Da-d])/);
    if (m)
        return String(m[1]).toUpperCase();
    return String.fromCharCode(65 + oi);
}
/** 参考答案中的选项字母（支持「A,B,D」或连续「ABD」） */
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
    const pickTrim = String(slot.picked || '').trim();
    if (!pickTrim)
        return false;
    return true;
}
const currentExamSlotReady = computed(() => {
    if (sessionPracticeMode.value !== 'exam' || examSheetSubmitted.value)
        return true;
    return slotExamReady(quizSlots.value[qIdx.value], currentQ.value);
});
const examNextLocked = computed(() => sessionPracticeMode.value === 'exam' && !examSheetSubmitted.value && !currentExamSlotReady.value);
const footerNextBlocked = computed(() => {
    if (sessionPracticeMode.value === 'exam' && examSheetSubmitted.value && questions.value.length) {
        return qIdx.value >= questions.value.length - 1;
    }
    return examNextLocked.value;
});
const quizNextFooterLabel = computed(() => {
    if (sessionPracticeMode.value !== 'exam')
        return '下一题';
    if (examSheetSubmitted.value && questions.value.length && qIdx.value >= questions.value.length - 1)
        return '已是最后一题';
    if (questions.value.length && qIdx.value >= questions.value.length - 1)
        return '交卷';
    return '下一题';
});
const analysisExamHtml = computed(() => {
    const s = String(currentQ.value?.analysis || '').trim();
    if (!s)
        return '';
    return escapeHtml(s).replace(/\n/g, '<br/>');
});
function optionButtonClass(line, oi) {
    const letter = letterForLine(line, oi);
    const rev = gradingVisibleForCurrent.value;
    const ansLetters = parseAnswerLetters(String(currentQ.value?.answer || ''));
    const pickedLetters = parseAnswerLetters(currentPicked.value || '');
    const inAns = ansLetters.includes(letter);
    const picked = pickedLetters.includes(letter);
    if (!rev) {
        return { pick: picked };
    }
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
async function boot() {
    loading.value = true;
    loadErr.value = '';
    try {
        papers.value = await suiteBankApi.listPapers();
    }
    catch (e) {
        loadErr.value = String(e.message || e);
    }
    finally {
        loading.value = false;
    }
}
async function persistExamPracticeRecord() {
    if (examRecordSaved.value || sessionPracticeMode.value !== 'exam')
        return;
    if (!quizPaperId.value || !questions.value.length)
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
            paper_id: quizPaperId.value,
            paper_title: activePaperTitle.value || '',
            paper_folder: quizPaperFolder.value || '',
            mode: 'exam',
            duration_sec: durationSec,
            correct_count: correctCount,
            wrong_count: wrongCount,
            unanswered_count: unansweredCount,
            submitted_count: submittedCount,
            items,
        });
        examRecordSaved.value = true;
        clearExamDraftForPaper(quizPaperId.value);
        void refreshPracticeRecords();
    }
    catch {
        /* ignore */
    }
}
async function refreshPracticeRecords() {
    practiceRecordsLoading.value = true;
    try {
        practiceRecords.value = await suiteBankApi.listPracticeRecords(60);
    }
    catch {
        practiceRecords.value = [];
    }
    finally {
        practiceRecordsLoading.value = false;
    }
}
async function openPracticeRecordsModal() {
    draftListRev.value++;
    showPracticeRecords.value = true;
    await refreshPracticeRecords();
}
function discardExamDraft(pid) {
    if (!window.confirm('确定删除这套卷的未交卷草稿？删除后不可恢复。'))
        return;
    clearExamDraftForPaper(pid);
}
async function loadQuiz(paperId, focusQid) {
    stashCurrentExamBeforeNavigation();
    examRecordSaved.value = false;
    examSheetSubmitted.value = false;
    const suiteModeQ = firstQueryValue(route.query.suiteMode).toLowerCase();
    const incomingMode = suiteModeQ === 'exam' ? 'exam' : 'preview';
    sessionPracticeMode.value = incomingMode;
    loadErr.value = '';
    try {
        const d = await suiteBankApi.getPaper(paperId);
        quizPaperId.value = paperId;
        quizPaperFolder.value = d.folder || '';
        activePaperTitle.value = d.title || '套卷';
        questions.value = d.questions ?? [];
        quizSlots.value = (d.questions ?? []).map(() => ({ picked: null, revealed: false }));
        qIdx.value = 0;
        sheetExpanded.value = true;
        if (focusQid) {
            const ix = questions.value.findIndex(x => String(x.id) === String(focusQid));
            if (ix >= 0)
                qIdx.value = ix;
        }
        mode.value = 'quiz';
        if (incomingMode === 'exam') {
            const restored = tryRestoreExamDraft(paperId, focusQid);
            if (!restored) {
                resetExamTimerForNewSession();
            }
            else {
                examSegmentStartedAt.value = Date.now();
                examTimerPaused.value = false;
            }
            startExamTimerDisplay();
        }
        else {
            stopExamTimerDisplay();
            examActiveMsAccum.value = 0;
            examSegmentStartedAt.value = 0;
            examTimerPaused.value = false;
        }
        if (incomingMode === 'exam' && firstQueryValue(route.query.examNew) === '1') {
            const qrest = { ...route.query };
            delete qrest.examNew;
            await router.replace({ name: route.name ?? 'XingceSuiteBank', query: qrest });
        }
    }
    catch (e) {
        loadErr.value = String(e.message || e);
    }
}
function goPaper(paperId, focusQid, suiteModeChoice = 'preview', opts) {
    const q = {};
    if (examChoice.value)
        q.exam = examChoice.value;
    if (selectedYear.value)
        q.year = selectedYear.value;
    q.paper = paperId;
    if (focusQid)
        q.qid = String(focusQid);
    q.suiteMode = suiteModeChoice;
    if (suiteModeChoice === 'exam' && opts?.examNew)
        q.examNew = '1';
    void router.push({ name: 'XingceSuiteBank', query: q });
}
function resumeDraftExam(paperId) {
    showPracticeRecords.value = false;
    goPaper(paperId, null, 'exam');
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
async function confirmSubmitExamSheet() {
    if (sessionPracticeMode.value !== 'exam' || examRecordSaved.value || examSheetSubmitted.value)
        return;
    if (!quizPaperId.value || !questions.value.length)
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
async function backToList() {
    stopExamTimerDisplay();
    const wasExam = sessionPracticeMode.value === 'exam' && !examRecordSaved.value;
    const pid = quizPaperId.value;
    if (wasExam && pid && questions.value.length) {
        saveExamDraftToStorage();
    }
    mode.value = 'list';
    questions.value = [];
    quizSlots.value = [];
    qIdx.value = 0;
    quizPaperId.value = '';
    quizPaperFolder.value = '';
    activePaperTitle.value = '';
    sessionPracticeMode.value = 'preview';
    examActiveMsAccum.value = 0;
    examSegmentStartedAt.value = 0;
    examTimerPaused.value = false;
    examSheetSubmitted.value = false;
    syncListQuery();
}
function pickLetter(L) {
    const slot = quizSlots.value[qIdx.value];
    if (!slot || slot.revealed || examSheetSubmitted.value)
        return;
    const ansRaw = String(currentQ.value?.answer || '');
    if (!isMultiSelectAnswer(ansRaw)) {
        slot.picked = L;
        if (sessionPracticeMode.value === 'exam' &&
            !examSheetSubmitted.value &&
            getOptionLineCount(currentQ.value) > 0) {
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
function showAnswer() {
    if (sessionPracticeMode.value === 'exam')
        return;
    const slot = quizSlots.value[qIdx.value];
    if (slot)
        slot.revealed = true;
}
function submitExamQuestion() {
    if (sessionPracticeMode.value !== 'exam' || examSheetSubmitted.value)
        return;
    const slot = quizSlots.value[qIdx.value];
    if (!slot || slot.revealed)
        return;
    if (currentHasOptions.value)
        return;
    slot.blankDone = true;
}
function skipExamQuestion() {
    if (sessionPracticeMode.value !== 'exam' || examSheetSubmitted.value)
        return;
    const slot = quizSlots.value[qIdx.value];
    if (!slot || slot.revealed)
        return;
    slot.picked = null;
    slot.skipped = true;
    slot.lockedIn = false;
    slot.blankDone = false;
}
function nextQuestion() {
    if (examNextLocked.value)
        return;
    if (qIdx.value + 1 >= questions.value.length) {
        if (sessionPracticeMode.value === 'exam' && !examSheetSubmitted.value)
            void confirmSubmitExamSheet();
        else if (sessionPracticeMode.value !== 'exam') {
            if (window.confirm('已是最后一题，返回套卷列表？'))
                void backToList();
        }
        return;
    }
    qIdx.value += 1;
}
/** 「下一题/交卷」：避免禁用态静默无反馈，并统一入口方便以后埋点 */
function handleFooterNext() {
    if (footerNextBlocked.value) {
        if (examNextLocked.value) {
            window.alert('请先完成本题：有选项时选好选项后点「下一题」即可；亦可点「不会做」。无选项题点「本题无选项，继续」。');
        }
        return;
    }
    nextQuestion();
}
function formatPracticeRecordAt(iso) {
    if (!iso)
        return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return iso;
    return d.toLocaleString('zh-CN', { hour12: false });
}
function formatPracticeDuration(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m >= 60) {
        const h = Math.floor(m / 60);
        const rm = m % 60;
        return `${h}时${rm}分${r}秒`;
    }
    if (m)
        return `${m}分${r}秒`;
    return `${r}秒`;
}
function applyExamYearFromRoute() {
    const pid = String(route.query.paper || '');
    if (pid)
        return;
    const ex = String(route.query.exam || '');
    if (ex === 'province' || ex === 'unified' || ex === 'other')
        examChoice.value = ex;
    else
        examChoice.value = null;
    const yr = String(route.query.year || '');
    selectedYear.value = /^\d{4}$/.test(yr) ? yr : '';
}
onMounted(async () => {
    window.addEventListener('keydown', onGlobalKeydown);
    await boot();
    booted.value = true;
    applyExamYearFromRoute();
    const pid = String(route.query.paper || '');
    if (pid)
        await loadQuiz(pid, route.query.qid ? String(route.query.qid) : undefined);
});
onUnmounted(() => {
    window.removeEventListener('keydown', onGlobalKeydown);
});
onBeforeUnmount(() => {
    if (sessionPracticeMode.value === 'exam' &&
        quizPaperId.value &&
        questions.value.length &&
        !examRecordSaved.value) {
        saveExamDraftToStorage();
    }
});
watch(() => route.query, async () => {
    if (!booted.value || loading.value)
        return;
    const pid = String(route.query.paper || '');
    if (!pid) {
        mode.value = 'list';
        applyExamYearFromRoute();
        return;
    }
    await loadQuiz(pid, route.query.qid ? String(route.query.qid) : undefined);
});
function goWorkspace() {
    void router.push({ name: 'XingceWorkspace' });
}
function goPortal() {
    void router.push({ name: 'ModulePortal', query: { portal: '1' } });
}
function onGlobalKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        showGlobalSearch.value = true;
    }
}
function onGlobalPickSuite(paperId, questionId) {
    showGlobalSearch.value = false;
    goPaper(paperId, questionId || null, 'preview');
}
function onGlobalPickQuestion(id) {
    showGlobalSearch.value = false;
    void router.push({ name: 'XingceWorkspace', query: { gsPickError: id } });
}
function onGlobalPickNote(nodeId) {
    showGlobalSearch.value = false;
    void router.push({ name: 'XingceWorkspace', query: { gsPickNote: nodeId } });
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['sb-pick-card']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-pick-other']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-card']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-stem-rich']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-stem-rich']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-inline-img']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-material-body']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-inline-img']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-opt-inner']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-opt']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-opt']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-opt']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-opt']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-opt']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-sheet-group']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-sheet-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-sheet-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-sheet-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-sheet-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-sheet-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-sheet-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-card-sub']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-mode-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['sb-mode-pill']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "sb-page" },
    ...{ class: ({ 'sb-page--quiz': __VLS_ctx.mode === 'quiz' && __VLS_ctx.questions.length }) },
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
if (__VLS_ctx.mode === 'quiz') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.backToList) },
        type: "button",
        ...{ class: "btn btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
}
if (__VLS_ctx.mode === 'list' && __VLS_ctx.booted && !__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.openPracticeRecordsModal) },
        type: "button",
        ...{ class: "btn btn-secondary" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.showGlobalSearch = true;
            // @ts-ignore
            [mode, mode, mode, questions, backToList, booted, loading, openPracticeRecordsModal, showGlobalSearch,];
        } },
    type: "button",
    ...{ class: "btn btn-secondary" },
    title: "Ctrl+K",
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
__VLS_asFunctionalElement1(__VLS_intrinsics.b, __VLS_intrinsics.b)({});
if (__VLS_ctx.loadErr) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "sb-err" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-err']} */ ;
    (__VLS_ctx.loadErr);
}
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sb-loading" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-loading']} */ ;
}
else if (__VLS_ctx.mode === 'list' && !__VLS_ctx.papers.length) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "sb-empty" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-empty']} */ ;
}
else if (__VLS_ctx.mode === 'list' && __VLS_ctx.examChoice === null) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sb-pick-grid" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-pick-grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.loading))
                    return;
                if (!!(__VLS_ctx.mode === 'list' && !__VLS_ctx.papers.length))
                    return;
                if (!(__VLS_ctx.mode === 'list' && __VLS_ctx.examChoice === null))
                    return;
                __VLS_ctx.pickExam('province');
                // @ts-ignore
                [mode, mode, loading, goWorkspace, goPortal, loadErr, loadErr, papers, examChoice, pickExam,];
            } },
        type: "button",
        ...{ class: "sb-pick-card" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-pick-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "sb-pick-title" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-pick-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "sb-pick-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-pick-sub']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.loading))
                    return;
                if (!!(__VLS_ctx.mode === 'list' && !__VLS_ctx.papers.length))
                    return;
                if (!(__VLS_ctx.mode === 'list' && __VLS_ctx.examChoice === null))
                    return;
                __VLS_ctx.pickExam('unified');
                // @ts-ignore
                [pickExam,];
            } },
        type: "button",
        ...{ class: "sb-pick-card" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-pick-card']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "sb-pick-title" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-pick-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "sb-pick-sub" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-pick-sub']} */ ;
    if (__VLS_ctx.otherPaperCount > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.mode === 'list' && !__VLS_ctx.papers.length))
                        return;
                    if (!(__VLS_ctx.mode === 'list' && __VLS_ctx.examChoice === null))
                        return;
                    if (!(__VLS_ctx.otherPaperCount > 0))
                        return;
                    __VLS_ctx.pickExam('other');
                    // @ts-ignore
                    [pickExam, otherPaperCount,];
                } },
            type: "button",
            ...{ class: "sb-pick-other" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-pick-other']} */ ;
        (__VLS_ctx.otherPaperCount);
    }
}
else if (__VLS_ctx.mode === 'list') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sb-browse-head" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-browse-head']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sb-browse-current" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-browse-current']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    (__VLS_ctx.examChoice ? __VLS_ctx.examLabel[__VLS_ctx.examChoice] : '');
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.changeExamType) },
        type: "button",
        ...{ class: "btn btn-secondary sb-change-type" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    /** @type {__VLS_StyleScopedClasses['sb-change-type']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sb-years" },
        role: "group",
        'aria-label': "按年份筛选",
    });
    /** @type {__VLS_StyleScopedClasses['sb-years']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.loading))
                    return;
                if (!!(__VLS_ctx.mode === 'list' && !__VLS_ctx.papers.length))
                    return;
                if (!!(__VLS_ctx.mode === 'list' && __VLS_ctx.examChoice === null))
                    return;
                if (!(__VLS_ctx.mode === 'list'))
                    return;
                __VLS_ctx.setYear('');
                // @ts-ignore
                [mode, examChoice, examChoice, otherPaperCount, examLabel, changeExamType, setYear,];
            } },
        type: "button",
        ...{ class: "sb-chip" },
        ...{ class: ({ active: !__VLS_ctx.selectedYear }) },
    });
    /** @type {__VLS_StyleScopedClasses['sb-chip']} */ ;
    /** @type {__VLS_StyleScopedClasses['active']} */ ;
    for (const [y] of __VLS_vFor((__VLS_ctx.yearOptions))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.mode === 'list' && !__VLS_ctx.papers.length))
                        return;
                    if (!!(__VLS_ctx.mode === 'list' && __VLS_ctx.examChoice === null))
                        return;
                    if (!(__VLS_ctx.mode === 'list'))
                        return;
                    __VLS_ctx.setYear(y);
                    // @ts-ignore
                    [setYear, selectedYear, yearOptions,];
                } },
            key: (y),
            type: "button",
            ...{ class: "sb-chip" },
            ...{ class: ({ active: __VLS_ctx.selectedYear === y }) },
        });
        /** @type {__VLS_StyleScopedClasses['sb-chip']} */ ;
        /** @type {__VLS_StyleScopedClasses['active']} */ ;
        (y);
        // @ts-ignore
        [selectedYear,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        type: "search",
        ...{ class: "sb-search" },
        placeholder: "筛选套卷标题、文件夹…",
    });
    (__VLS_ctx.filter);
    /** @type {__VLS_StyleScopedClasses['sb-search']} */ ;
    if (__VLS_ctx.filteredPapers.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "sb-list" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-list']} */ ;
        for (const [p] of __VLS_vFor((__VLS_ctx.filteredPapers))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (p.id),
                ...{ class: "sb-card sb-card-split" },
            });
            /** @type {__VLS_StyleScopedClasses['sb-card']} */ ;
            /** @type {__VLS_StyleScopedClasses['sb-card-split']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.mode === 'list' && !__VLS_ctx.papers.length))
                            return;
                        if (!!(__VLS_ctx.mode === 'list' && __VLS_ctx.examChoice === null))
                            return;
                        if (!(__VLS_ctx.mode === 'list'))
                            return;
                        if (!(__VLS_ctx.filteredPapers.length))
                            return;
                        __VLS_ctx.goPaper(p.id, null, 'preview');
                        // @ts-ignore
                        [filter, filteredPapers, filteredPapers, goPaper,];
                    } },
                ...{ onKeydown: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.mode === 'list' && !__VLS_ctx.papers.length))
                            return;
                        if (!!(__VLS_ctx.mode === 'list' && __VLS_ctx.examChoice === null))
                            return;
                        if (!(__VLS_ctx.mode === 'list'))
                            return;
                        if (!(__VLS_ctx.filteredPapers.length))
                            return;
                        __VLS_ctx.goPaper(p.id, null, 'preview');
                        // @ts-ignore
                        [goPaper,];
                    } },
                ...{ class: "sb-card-main" },
                role: "button",
                tabindex: "0",
            });
            /** @type {__VLS_StyleScopedClasses['sb-card-main']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "sb-card-title" },
            });
            /** @type {__VLS_StyleScopedClasses['sb-card-title']} */ ;
            (p.title || '未命名');
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "sb-card-sub hint" },
            });
            /** @type {__VLS_StyleScopedClasses['sb-card-sub']} */ ;
            /** @type {__VLS_StyleScopedClasses['hint']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "sb-card-sub" },
            });
            /** @type {__VLS_StyleScopedClasses['sb-card-sub']} */ ;
            (p.folder || '—');
            (p.question_count);
            if (__VLS_ctx.isWordImportPaper(p)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "sb-src-tag" },
                });
                /** @type {__VLS_StyleScopedClasses['sb-src-tag']} */ ;
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "sb-card-actions" },
            });
            /** @type {__VLS_StyleScopedClasses['sb-card-actions']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.mode === 'list' && !__VLS_ctx.papers.length))
                            return;
                        if (!!(__VLS_ctx.mode === 'list' && __VLS_ctx.examChoice === null))
                            return;
                        if (!(__VLS_ctx.mode === 'list'))
                            return;
                        if (!(__VLS_ctx.filteredPapers.length))
                            return;
                        __VLS_ctx.goPaper(p.id, null, 'exam');
                        // @ts-ignore
                        [goPaper, isWordImportPaper,];
                    } },
                type: "button",
                ...{ class: "btn btn-primary sb-mini" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
            /** @type {__VLS_StyleScopedClasses['sb-mini']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.mode === 'list' && !__VLS_ctx.papers.length))
                            return;
                        if (!!(__VLS_ctx.mode === 'list' && __VLS_ctx.examChoice === null))
                            return;
                        if (!(__VLS_ctx.mode === 'list'))
                            return;
                        if (!(__VLS_ctx.filteredPapers.length))
                            return;
                        __VLS_ctx.goPaper(p.id, null, 'exam', { examNew: true });
                        // @ts-ignore
                        [goPaper,];
                    } },
                type: "button",
                ...{ class: "btn btn-secondary sb-mini" },
                title: "清空本地草稿并从第一题重做",
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
            /** @type {__VLS_StyleScopedClasses['sb-mini']} */ ;
            // @ts-ignore
            [];
        }
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "sb-empty" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-empty']} */ ;
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
    (__VLS_ctx.activePaperTitle);
    if (__VLS_ctx.sessionPracticeMode === 'exam' && !__VLS_ctx.examSheetSubmitted) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-exam-hint" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-exam-hint']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    }
    if (__VLS_ctx.sessionPracticeMode === 'exam' && __VLS_ctx.examSheetSubmitted) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-exam-done-banner" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-exam-done-banner']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.backToList) },
            type: "button",
            ...{ class: "btn btn-secondary sb-exam-done-back" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
        /** @type {__VLS_StyleScopedClasses['sb-exam-done-back']} */ ;
    }
    if (__VLS_ctx.sessionPracticeMode === 'exam' && !__VLS_ctx.examSheetSubmitted) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "sb-exam-toolbar" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-exam-toolbar']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "sb-exam-clock" },
            'aria-live': "polite",
        });
        /** @type {__VLS_StyleScopedClasses['sb-exam-clock']} */ ;
        (__VLS_ctx.examClockText);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.toggleExamPause) },
            type: "button",
            ...{ class: "btn btn-secondary sb-exam-pause" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
        /** @type {__VLS_StyleScopedClasses['sb-exam-pause']} */ ;
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
        if (__VLS_ctx.sessionPracticeMode === 'preview') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "sb-mode-pill preview" },
            });
            /** @type {__VLS_StyleScopedClasses['sb-mode-pill']} */ ;
            /** @type {__VLS_StyleScopedClasses['preview']} */ ;
        }
        else if (__VLS_ctx.sessionPracticeMode === 'exam') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "sb-mode-pill exam" },
            });
            /** @type {__VLS_StyleScopedClasses['sb-mode-pill']} */ ;
            /** @type {__VLS_StyleScopedClasses['exam']} */ ;
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
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.mode === 'list' && !__VLS_ctx.papers.length))
                            return;
                        if (!!(__VLS_ctx.mode === 'list' && __VLS_ctx.examChoice === null))
                            return;
                        if (!!(__VLS_ctx.mode === 'list'))
                            return;
                        if (!(__VLS_ctx.currentQ && __VLS_ctx.optionLines.length))
                            return;
                        __VLS_ctx.pickLetter(__VLS_ctx.letterForLine(line, oi));
                        // @ts-ignore
                        [questions, backToList, activePaperTitle, sessionPracticeMode, sessionPracticeMode, sessionPracticeMode, sessionPracticeMode, sessionPracticeMode, examSheetSubmitted, examSheetSubmitted, examSheetSubmitted, examClockText, toggleExamPause, examTimerPaused, confirmSubmitExamSheet, currentQ, currentQ, currentQ, currentQ, currentQ, currentQ, qIdx, qIdx, currentIsMulti, sectionBanner, sectionBanner, sharedMaterialRaw, sharedMaterialHtml, stemImageSrc, stemImageSrc, stemHtml, optionLines, optionLines, pickLetter, letterForLine,];
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
    if (__VLS_ctx.sessionPracticeMode === 'exam' && !__VLS_ctx.examSheetSubmitted) {
        if (!__VLS_ctx.currentHasOptions) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.submitExamQuestion) },
                type: "button",
                ...{ class: "btn btn-primary" },
                title: "本题未识别选项行时可确认后继续",
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
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.showAnswer) },
            type: "button",
            ...{ class: "btn btn-secondary" },
        });
        /** @type {__VLS_StyleScopedClasses['btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.handleFooterNext) },
        type: "button",
        ...{ class: "btn btn-primary sb-footer-next" },
        ...{ class: ({ 'sb-footer-next--blocked': __VLS_ctx.footerNextBlocked }) },
        title: (__VLS_ctx.footerNextBlocked
            ? __VLS_ctx.examNextLocked
                ? '请先完成本题作答（见上方说明）'
                : ''
            : ''),
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
    /** @type {__VLS_StyleScopedClasses['sb-footer-next']} */ ;
    /** @type {__VLS_StyleScopedClasses['sb-footer-next--blocked']} */ ;
    (__VLS_ctx.quizNextFooterLabel);
    if (__VLS_ctx.mode === 'quiz' && __VLS_ctx.questions.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
            ...{ class: "sb-sheet-dock" },
            'aria-label': "答题卡",
        });
        /** @type {__VLS_StyleScopedClasses['sb-sheet-dock']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.mode === 'list' && !__VLS_ctx.papers.length))
                        return;
                    if (!!(__VLS_ctx.mode === 'list' && __VLS_ctx.examChoice === null))
                        return;
                    if (!!(__VLS_ctx.mode === 'list'))
                        return;
                    if (!(__VLS_ctx.mode === 'quiz' && __VLS_ctx.questions.length))
                        return;
                    __VLS_ctx.sheetExpanded = !__VLS_ctx.sheetExpanded;
                    // @ts-ignore
                    [mode, questions, sessionPracticeMode, examSheetSubmitted, currentQ, currentQ, currentQ, currentQ, gradingVisibleForCurrent, gradingVisibleForCurrent, analysisExamHtml, currentHasOptions, currentHasOptions, submitExamQuestion, skipExamQuestion, showAnswer, handleFooterNext, footerNextBlocked, footerNextBlocked, examNextLocked, quizNextFooterLabel, sheetExpanded, sheetExpanded,];
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
            'aria-hidden': "true",
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
                            if (!!(__VLS_ctx.loading))
                                return;
                            if (!!(__VLS_ctx.mode === 'list' && !__VLS_ctx.papers.length))
                                return;
                            if (!!(__VLS_ctx.mode === 'list' && __VLS_ctx.examChoice === null))
                                return;
                            if (!!(__VLS_ctx.mode === 'list'))
                                return;
                            if (!(__VLS_ctx.mode === 'quiz' && __VLS_ctx.questions.length))
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
if (__VLS_ctx.showGlobalSearch) {
    const __VLS_0 = GlobalSearchModal;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onClose': {} },
        ...{ 'onPickQuestion': {} },
        ...{ 'onPickNote': {} },
        ...{ 'onPickSuite': {} },
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onClose': {} },
        ...{ 'onPickQuestion': {} },
        ...{ 'onPickNote': {} },
        ...{ 'onPickSuite': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ close: {} },
        { onClose: (...[$event]) => {
                if (!(__VLS_ctx.showGlobalSearch))
                    return;
                __VLS_ctx.showGlobalSearch = false;
                // @ts-ignore
                [showGlobalSearch, showGlobalSearch,];
            } });
    const __VLS_7 = ({ pickQuestion: {} },
        { onPickQuestion: (__VLS_ctx.onGlobalPickQuestion) });
    const __VLS_8 = ({ pickNote: {} },
        { onPickNote: (__VLS_ctx.onGlobalPickNote) });
    const __VLS_9 = ({ pickSuite: {} },
        { onPickSuite: (__VLS_ctx.onGlobalPickSuite) });
    var __VLS_3;
    var __VLS_4;
}
let __VLS_10;
/** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    to: "body",
}));
const __VLS_12 = __VLS_11({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
const { default: __VLS_15 } = __VLS_13.slots;
if (__VLS_ctx.showPracticeRecords) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sb-pr-modal-overlay" },
        role: "dialog",
        'aria-modal': "true",
        'aria-labelledby': "sb-pr-title",
    });
    /** @type {__VLS_StyleScopedClasses['sb-pr-modal-overlay']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showPracticeRecords))
                    return;
                __VLS_ctx.showPracticeRecords = false;
                // @ts-ignore
                [onGlobalPickQuestion, onGlobalPickNote, onGlobalPickSuite, showPracticeRecords, showPracticeRecords,];
            } },
        ...{ class: "sb-pr-backdrop" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-pr-backdrop']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sb-pr-panel" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-pr-panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sb-pr-head" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-pr-head']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        id: "sb-pr-title",
        ...{ class: "sb-pr-title" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-pr-title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showPracticeRecords))
                    return;
                __VLS_ctx.showPracticeRecords = false;
                // @ts-ignore
                [showPracticeRecords,];
            } },
        type: "button",
        ...{ class: "btn btn-ghost sb-pr-close" },
    });
    /** @type {__VLS_StyleScopedClasses['btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['btn-ghost']} */ ;
    /** @type {__VLS_StyleScopedClasses['sb-pr-close']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "sb-pr-body" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-pr-body']} */ ;
    if (__VLS_ctx.draftSummaries.length) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ class: "sb-pr-drafts" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-pr-drafts']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
            ...{ class: "sb-pr-section-head" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-pr-section-head']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "sb-pr-section-hint" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-pr-section-hint']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "sb-pr-draft-list" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-pr-draft-list']} */ ;
        for (const [d] of __VLS_vFor((__VLS_ctx.draftSummaries))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                key: (d.paperId),
                ...{ class: "sb-pr-draft-row" },
            });
            /** @type {__VLS_StyleScopedClasses['sb-pr-draft-row']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "sb-pr-draft-meta" },
            });
            /** @type {__VLS_StyleScopedClasses['sb-pr-draft-meta']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "sb-pr-paper" },
            });
            /** @type {__VLS_StyleScopedClasses['sb-pr-paper']} */ ;
            (d.title);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "sb-pr-folder" },
            });
            /** @type {__VLS_StyleScopedClasses['sb-pr-folder']} */ ;
            (d.folder || '—');
            (d.answered);
            (d.total);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "sb-pr-draft-actions" },
            });
            /** @type {__VLS_StyleScopedClasses['sb-pr-draft-actions']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showPracticeRecords))
                            return;
                        if (!(__VLS_ctx.draftSummaries.length))
                            return;
                        __VLS_ctx.resumeDraftExam(d.paperId);
                        // @ts-ignore
                        [draftSummaries, draftSummaries, resumeDraftExam,];
                    } },
                type: "button",
                ...{ class: "btn btn-primary sb-mini" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-primary']} */ ;
            /** @type {__VLS_StyleScopedClasses['sb-mini']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showPracticeRecords))
                            return;
                        if (!(__VLS_ctx.draftSummaries.length))
                            return;
                        __VLS_ctx.discardExamDraft(d.paperId);
                        // @ts-ignore
                        [discardExamDraft,];
                    } },
                type: "button",
                ...{ class: "btn btn-secondary sb-mini" },
            });
            /** @type {__VLS_StyleScopedClasses['btn']} */ ;
            /** @type {__VLS_StyleScopedClasses['btn-secondary']} */ ;
            /** @type {__VLS_StyleScopedClasses['sb-mini']} */ ;
            // @ts-ignore
            [];
        }
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "sb-pr-history" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-pr-history']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "sb-pr-section-head" },
    });
    /** @type {__VLS_StyleScopedClasses['sb-pr-section-head']} */ ;
    if (__VLS_ctx.practiceRecordsLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "sb-pr-muted" },
        });
        /** @type {__VLS_StyleScopedClasses['sb-pr-muted']} */ ;
    }
    else {
        if (__VLS_ctx.practiceRecords.length) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "sb-pr-table-wrap" },
            });
            /** @type {__VLS_StyleScopedClasses['sb-pr-table-wrap']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
                ...{ class: "sb-pr-table" },
            });
            /** @type {__VLS_StyleScopedClasses['sb-pr-table']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
            for (const [rec] of __VLS_vFor((__VLS_ctx.practiceRecords))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                    key: (rec.id),
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                (__VLS_ctx.formatPracticeRecordAt(rec.created_at));
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "sb-pr-paper" },
                });
                /** @type {__VLS_StyleScopedClasses['sb-pr-paper']} */ ;
                (rec.paper_title || rec.paper_id);
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "sb-pr-folder" },
                });
                /** @type {__VLS_StyleScopedClasses['sb-pr-folder']} */ ;
                (rec.paper_folder);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                (rec.correct_count);
                (rec.wrong_count);
                (rec.unanswered_count);
                __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({});
                (__VLS_ctx.formatPracticeDuration(rec.duration_sec));
                // @ts-ignore
                [practiceRecordsLoading, practiceRecords, practiceRecords, formatPracticeRecordAt, formatPracticeDuration,];
            }
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "sb-pr-muted" },
            });
            /** @type {__VLS_StyleScopedClasses['sb-pr-muted']} */ ;
        }
    }
}
// @ts-ignore
[];
var __VLS_13;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
