// ============================================================
// 常量 & 全局状态
// ============================================================
const KEY_ERRORS    = 'xc_errors';
const KEY_REVEALED  = 'xc_revealed';
const KEY_EXP_TYPES = 'xc_exp_types';
const KEY_EXP_MAIN  = 'xc_exp_main';
const KEY_EXP_SUB2  = 'xc_exp_sub2';   // 三级展开状态
const KEY_GLOBAL_NOTE = 'xc_global_note';
const KEY_TODAY_DATE  = 'xc_today_date';
const KEY_TODAY_DONE  = 'xc_today_done';
const KEY_HISTORY   = 'xc_history';
const KEY_TYPE_RULES = 'xc_type_rules';
const KEY_CLOUD_META = 'xc_cloud_meta';
const KEY_KNOWLEDGE_EXPANDED = 'xc_knowledge_expanded';
const KEY_NOTE_REVIEW_TRACKING = 'xc_note_review_tracking';
const KEY_STARTUP_SUMMARY = 'xc_startup_summary';

// 默认题型识别规则（按优先级排序）
const DEFAULT_TYPE_RULES = [
  {keywords:['图形推理','图推','下列图形'],type:'判断推理',subtype:'图形推理'},
  {keywords:['类比推理','类比','对于'],type:'判断推理',subtype:'类比推理'},
  {keywords:['定义判断','的定义是','是指'],type:'判断推理',subtype:'定义判断'},
  {keywords:['逻辑判断','能推出','可以推出','所有','有些','能够推断'],type:'判断推理',subtype:'逻辑判断'},
  {keywords:['逻辑填空','空格处','横线处','填入横线','填在横线','最恰当的一项是','最合适的一项'],type:'言语理解与表达',subtype:'逻辑填空'},
  {keywords:['片段阅读','意在说明','作者认为','下列说法正确','主旨','主要观点','这段话','最恰当地概括'],type:'言语理解与表达',subtype:'片段阅读'},
  {keywords:['语句排序','语句填空','排序','语段','下列语句'],type:'言语理解与表达',subtype:'语句排序'},
  {keywords:['数字推理','数列','下一项'],type:'数量关系',subtype:'数字推理'},
  {keywords:['数学运算','工程量','速度','浓度','利润','概率','排列组合'],type:'数量关系',subtype:'数学运算'},
  {keywords:['资料分析','根据图','根据表','增长率','增速'],type:'资料分析',subtype:''},
  {keywords:['常识判断'],type:'常识判断',subtype:''},
];

let errors    = [];
let fullDataLoaded = false;
let fullDataLoading = false;
let startupSummaryCache = null;
let revealed  = new Set();
let expTypes  = new Set();
let moduleReasonOpen = new Set(); // 错因树展开状态，仅内存，不持久化
let expMain   = new Set();
let expMainSub = new Set();
let expMainSub2 = new Set();  // 三级展开
// 笔记数据
const KEY_NOTES_BY_TYPE = 'xc_notes_by_type';
const KEY_NOTE_IMAGES   = 'xc_note_images';   // 笔记图片独立存储 { id: base64 }
const KEY_KNOWLEDGE_TREE = 'xc_knowledge_tree';
const KEY_KNOWLEDGE_NOTES = 'xc_knowledge_notes';
let notesByType = {}; // { type: {title,content,children:{subtype:{title,content,children:{sub2:{title,content,children:{}}}}}}}
let notesPanelOpen = true;
let globalNoteEditing = false; // 笔记编辑模式状态
let noteEditing = false;    // 笔记是否处于编辑模式（默认预览）
let knowledgeTree = null;
let knowledgeNotes = {};
let selectedKnowledgeNodeId = null;
let knowledgeErrorCountCacheVersion = 0;
let knowledgeErrorCountCache = { version: -1, direct: new Map(), aggregate: new Map() };
const knowledgeNoteRenderCache = new Map();
let knowledgeNodeFilter = null;
let pendingKnowledgeMoveErrorId = null;
let pendingKnowledgeMoveErrorIds = [];
let pendingKnowledgeMoveTargetId = null;
let draggingKnowledgeNodeId = null;
let draggingErrorId = null;
let knowledgeExpanded = new Set();
let knowledgeExpandedLoaded = false;
let noteReviewTracking = {};
let knowledgeNodeModalState = { mode: '', nodeId: null, parentId: null, targetId: null, fallbackTitle: '' };
let knowledgeRelatedMode = 'direct';
const UI_KEY_ERRORS_TOP_COLLAPSED = 'xc_ui_errors_top_collapsed';
const UI_KEY_KNOWLEDGE_TREE_FOCUS = 'xc_ui_knowledge_tree_focus';
let errorsTopCollapsed = false;
let knowledgeTreeFocusMode = false;
let knowledgeTreeSearchQuery = '';
let appView = 'home';

// 错因分组定义（每个 reason 含简介 desc）
const REASON_GROUPS = [
  {label:'审题', color:'#e67e22', desc:'答题时审题不仔细', reasons:[
    {v:'粗心看错题目',   d:'看错了题目关键数字或词语'},
    {v:'题目没读完',     d:'未读完整道题就急于作答'},
    {v:'选项没看全',     d:'未逐一核对全部选项即判断'},
    {v:'关键词漏看',     d:'忽略"不正确""除了"等限定词'},
  ]},
  {label:'知识', color:'#e74c3c', desc:'知识点不熟或记忆有误', reasons:[
    {v:'公式/方法不会',  d:'完全不知道该用哪种方法'},
    {v:'知识点遗忘',     d:'曾经学过但当时想不起来'},
    {v:'概念理解错误',   d:'对概念本身的理解存在偏差'},
    {v:'概念混淆',       d:'两个相近概念或公式搞混'},
    {v:'常识知识空白',   d:'该知识点从未掌握过'},
  ]},
  {label:'言语', color:'#1abc9c', desc:'言语理解与表达题失误', reasons:[
    {v:'词义/语义理解偏差', d:'对词语或句子的含义理解有误'},
    {v:'主旨提炼失误',   d:'未能准确找到文段的中心思想'},
    {v:'过度推断/绝对化',d:'选了比原文说法更绝对的选项'},
    {v:'语境分析错误',   d:'未结合上下文判断词义或语义'},
    {v:'近义词辨析失误', d:'近义词或成语间的细微差别没掌握'},
  ]},
  {label:'推理', color:'#3498db', desc:'逻辑推理或图形推理出错', reasons:[
    {v:'逻辑推理出错',       d:'推理链条中某个步骤出现错误'},
    {v:'充分必要条件混淆',   d:'把充分条件和必要条件搞反'},
    {v:'矛盾/反对关系混淆',  d:'不清楚矛盾关系与反对关系区别'},
    {v:'论证结构误判',       d:'没有准确识别论点与论据关系'},
    {v:'加强/削弱方向判反',  d:'把加强项选成了削弱项或反之'},
    {v:'图形规律识别失误',   d:'漏看或误判图形中的变化规律'},
    {v:'类比关系判断错误',   d:'没有准确判断词语间的逻辑关系'},
    {v:'定义关键要素未抓住', d:'忽略了定义中的核心限定条件'},
  ]},
  {label:'资料分析', color:'#9b59b6', desc:'资料分析读数或计算出错', reasons:[
    {v:'读数/找数出错',       d:'从表格或图表中取到了错误数据'},
    {v:'增长率与增长量混淆',  d:'把增长率和增长量的概念搞混'},
    {v:'倍数与百分比混淆',    d:'"增长了X倍"和"增长了X%"搞混'},
    {v:'计算量大估算偏差',    d:'估算时精度不够导致选错选项'},
  ]},
  {label:'计算', color:'#c0392b', desc:'数量关系或运算计算出错', reasons:[
    {v:'粗心计算错误', d:'算术过程中出现低级运算错误'},
    {v:'方程列错',     d:'建立方程时逻辑或变量设置有误'},
  ]},
  {label:'方法', color:'#2ecc71', desc:'解题方法或策略选择不当', reasons:[
    {v:'方法不熟练',     d:'知道正确方法但操作还不够熟练'},
    {v:'解题思路错误',   d:'方向选错导致越做越复杂'},
    {v:'题型识别错误',   d:'没有正确识别题目的题型'},
    {v:'代入排除法未用', d:'应用特值法/排除法却选择硬算'},
  ]},
  {label:'状态', color:'#95a5a6', desc:'考试状态或时间分配问题', reasons:[
    {v:'没时间/蒙的', d:'时间不够直接蒙选了答案'},
    {v:'会做但慌了',  d:'会做的题因紧张或分心做错'},
  ]},
];
function getReasonGroup(reason){
  return REASON_GROUPS.find(g=>g.reasons.some(r=>r.v===reason))||null;
}
function getReasonDesc(reason){
  for(const g of REASON_GROUPS){ const r=g.reasons.find(r=>r.v===reason); if(r) return r.d; }
  return '';
}
function escapeAttrStr(s){ return s.replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }

const ERROR_STATUS_OPTIONS = [
  { value:'focus', label:'重点复习', color:'#e74c3c' },
  { value:'review', label:'待复习', color:'#fa8c16' },
  { value:'mastered', label:'已掌握', color:'#52c41a' },
];
const ERROR_STATUS_LABEL_MAP = Object.fromEntries(ERROR_STATUS_OPTIONS.map(item => [item.value, item.label]));
const ERROR_WORKFLOW_STAGE_META = {
  new: { label:'待补全', shortLabel:'待补全', color:'#8c8c8c', bg:'#fafafa', border:'#d9d9d9' },
  captured: { label:'已入库', shortLabel:'已入库', color:'#1677ff', bg:'#f0f5ff', border:'#adc6ff' },
  review_ready: { label:'待复盘', shortLabel:'待复盘', color:'#722ed1', bg:'#f9f0ff', border:'#d3adf7' },
  pending_retry: { label:'待复训', shortLabel:'待复训', color:'#d46b08', bg:'#fff7e6', border:'#ffd591' },
  mastered: { label:'已掌握', shortLabel:'已掌握', color:'#389e0d', bg:'#f6ffed', border:'#b7eb8f' },
};

function normalizeErrorStatusValue(raw){
  const value = String(raw || '').trim();
  if(value === 'mastered') return 'mastered';
  if(value === 'review') return 'review';
  return 'focus';
}
function normalizeMasteryLevelValue(raw){
  const value = String(raw || '').trim();
  if(value === 'mastered') return 'mastered';
  if(value === 'fuzzy') return 'fuzzy';
  return 'not_mastered';
}
function getPracticeSummarySnapshotForError(errorLike){
  const normalizedId = normalizeErrorId(errorLike && errorLike.id);
  if(normalizedId && practiceAttemptSummaryByErrorId && Object.prototype.hasOwnProperty.call(practiceAttemptSummaryByErrorId, normalizedId)) return practiceAttemptSummaryByErrorId[normalizedId];
  const questionId = String((errorLike && errorLike.id) || '').trim();
  if(questionId && practiceAttemptSummaryByErrorId && Object.prototype.hasOwnProperty.call(practiceAttemptSummaryByErrorId, questionId)) return practiceAttemptSummaryByErrorId[questionId];
  return null;
}
function getErrorStatusLabel(status){
  return ERROR_STATUS_LABEL_MAP[normalizeErrorStatusValue(status)] || '重点复习';
}
function getErrorWorkflowStage(errorLike){
  const error = errorLike || {};
  const status = normalizeErrorStatusValue(error.status);
  const masteryLevel = normalizeMasteryLevelValue(error.masteryLevel);
  const summary = getPracticeSummarySnapshotForError(error);
  const hasAttemptSummary = !!(summary && (summary.lastTime || summary.lastResult || summary.lastConfidence || summary.lastDuration));
  const hasReason = !!String(error.rootReason || error.errorReason || error.mistakeType || error.triggerPoint || '').trim();
  const hasModel = !!String(error.analysis || error.correctModel || '').trim();
  const processImage = typeof getProcessImageUrl === 'function' ? getProcessImageUrl(error) : '';
  const hasReviewArtifact = !!String(error.note || error.nextAction || error.processCanvasData || processImage || '').trim();
  if(masteryLevel === 'mastered' || status === 'mastered') return 'mastered';
  if(hasAttemptSummary) return 'pending_retry';
  if(hasReviewArtifact || status === 'review') return 'review_ready';
  if(hasReason || hasModel || status === 'focus') return 'captured';
  return 'new';
}
function getErrorWorkflowStageMeta(errorLike){
  const key = getErrorWorkflowStage(errorLike);
  return { key, ...(ERROR_WORKFLOW_STAGE_META[key] || ERROR_WORKFLOW_STAGE_META.new) };
}
function normalizeErrorForWorkflow(errorLike){
  const error = errorLike || {};
  error.status = normalizeErrorStatusValue(error.status);
  error.masteryLevel = normalizeMasteryLevelValue(error.masteryLevel);
  return error;
}
function touchErrorUpdatedAt(errorLike){
  if(errorLike && typeof errorLike === 'object') errorLike.updatedAt = new Date().toISOString();
}
function refreshWorkspaceAfterErrorMutation(options){
  const cfg = Object.assign({ save:true, reveal:false, syncNotes:false, saveKnowledge:false, renderNotes:false }, options || {});
  if(cfg.save && typeof saveData === 'function') saveData();
  if(cfg.reveal && typeof saveReveal === 'function') saveReveal();
  if(cfg.syncNotes && typeof syncNotesWithErrors === 'function') syncNotesWithErrors();
  if(cfg.saveKnowledge && typeof saveKnowledgeState === 'function') saveKnowledgeState();
  if(typeof renderSidebar === 'function') renderSidebar();
  if(typeof renderAll === 'function') renderAll();
  if(cfg.renderNotes && typeof renderNotesByType === 'function') renderNotesByType();
}

window.normalizeErrorStatusValue = normalizeErrorStatusValue;
window.normalizeMasteryLevelValue = normalizeMasteryLevelValue;
window.getErrorWorkflowStage = getErrorWorkflowStage;
window.getErrorWorkflowStageMeta = getErrorWorkflowStageMeta;
window.getErrorStatusLabel = getErrorStatusLabel;
window.normalizeErrorForWorkflow = normalizeErrorForWorkflow;
window.touchErrorUpdatedAt = touchErrorUpdatedAt;
window.refreshWorkspaceAfterErrorMutation = refreshWorkspaceAfterErrorMutation;
window.hasFullWorkspaceDataLoaded = hasFullWorkspaceDataLoaded;
window.getStartupSummaryCache = getStartupSummaryCache;

let statusFilter = 'all';
let taskFilter = 'all';
let typeFilter   = null;   // {level:'type'|'subtype'|'sub2', value, type?, subtype?}
let searchKw     = '';
let quizSessionMode = 'daily';
let reasonFilter = null;   // 错因筛选，null 表示不筛选
let editingId    = null;
let importMode   = 'merge';
let practiceAttemptSummaryByErrorId = {};
let practiceAttemptSummaryRequestKey = '';
let practiceAttemptSummaryLoading = false;
let importKnowledgeNodeId = null;
let modalKnowledgeNodeId = null;
let saveErrorBusy = false;

let todayDate = '';
let todayDone = 0;

function setSaveErrorBusyState(next) {
  saveErrorBusy = !!next;
  const saveBtn = document.getElementById('saveErrorBtn');
  const cancelBtn = document.getElementById('cancelSaveErrorBtn');
  const closeBtn = document.getElementById('addModalCloseBtn');
  const loadingText = editingId ? '保存修改中...' : '保存中...';
  if (saveBtn) {
    saveBtn.disabled = saveErrorBusy;
    saveBtn.textContent = saveErrorBusy ? loadingText : '保存这道题';
  }
  if (cancelBtn) cancelBtn.disabled = saveErrorBusy;
  if (closeBtn) closeBtn.disabled = saveErrorBusy;
}

function readUiBool(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(raw === null) return !!fallback;
    return raw === 'true' || raw === '1';
  }catch(e){
    return !!fallback;
  }
}
function writeUiBool(key, value){
  try{ localStorage.setItem(key, value ? '1' : '0'); }catch(e){}
}
function hasKnowledgeTreeSearch(){
  return !!String(knowledgeTreeSearchQuery || '').trim();
}
function getKnowledgeTreeSearchTerms(){
  return String(knowledgeTreeSearchQuery || '').toLowerCase().split(/\s+/).filter(Boolean);
}
function getKnowledgeTreeNodeSearchText(node){
  if(!node) return '';
  const path = collapseKnowledgePathTitles(getKnowledgePathTitles(node.id)).join(' ');
  return `${node.title||''} ${path}`.toLowerCase();
}
function isKnowledgeNodeSearchMatch(node){
  const terms = getKnowledgeTreeSearchTerms();
  if(!terms.length || !node) return false;
  const text = getKnowledgeTreeNodeSearchText(node);
  return terms.every(term => text.includes(term));
}
function isKnowledgeNodeVisibleBySearch(node){
  if(!node) return false;
  if(!hasKnowledgeTreeSearch()) return true;
  if(isKnowledgeNodeSearchMatch(node)) return true;
  return (node.children || []).some(child => isKnowledgeNodeVisibleBySearch(child));
}
function countVisibleKnowledgeNodes(nodes){
  return (nodes || []).reduce((sum, node) => {
    if(!isKnowledgeNodeVisibleBySearch(node)) return sum;
    return sum + 1 + countVisibleKnowledgeNodes(node.children || []);
  }, 0);
}
function syncKnowledgeTreeSearchUi(){
  const input = document.getElementById('knowledgeTreeSearchInput');
  const clearBtn = document.getElementById('knowledgeTreeSearchClear');
  const meta = document.getElementById('knowledgeTreeSearchMeta');
  if(input && input.value !== knowledgeTreeSearchQuery) input.value = knowledgeTreeSearchQuery;
  if(clearBtn) clearBtn.style.display = hasKnowledgeTreeSearch() ? 'block' : 'none';
  if(meta){
    if(hasKnowledgeTreeSearch()){
      const visibleCount = countVisibleKnowledgeNodes(getKnowledgeRootNodes());
      meta.textContent = visibleCount ? '\u547D\u4E2D ' + visibleCount + ' \u4E2A\u8282\u70B9' : '\u672A\u627E\u5230\u5339\u914D\u8282\u70B9';
    }else{
      meta.textContent = '\u652F\u6301\u6309\u8282\u70B9\u540D\u548C\u8DEF\u5F84\u641C\u7D22';
    }
  }
}
function onKnowledgeTreeSearchInput(){
  const input = document.getElementById('knowledgeTreeSearchInput');
  knowledgeTreeSearchQuery = input ? input.value.trim() : '';
  renderSidebar();
}
function clearKnowledgeTreeSearch(){
  knowledgeTreeSearchQuery = '';
  const input = document.getElementById('knowledgeTreeSearchInput');
  if(input) input.value = '';
  renderSidebar();
  if(input) input.focus();
}
function applyErrorsTopCollapsedState(){
  document.body.classList.toggle('errors-top-collapsed', errorsTopCollapsed);
  const btn = document.getElementById('errorsTopToggleBtn');
  if(btn) btn.textContent = errorsTopCollapsed ? '\u5C55\u5F00\u5934\u90E8' : '\u6536\u8D77\u5934\u90E8';
}
function toggleErrorsTopCollapsed(){
  errorsTopCollapsed = !errorsTopCollapsed;
  writeUiBool(UI_KEY_ERRORS_TOP_COLLAPSED, errorsTopCollapsed);
  applyErrorsTopCollapsedState();
}
function applyKnowledgeTreeFocusMode(){
  document.body.classList.toggle('sidebar-tree-focus', knowledgeTreeFocusMode);
  const btn = document.getElementById('knowledgeTreeFocusBtn');
  if(btn) btn.textContent = knowledgeTreeFocusMode ? '\u9000\u51FA\u4E13\u6CE8' : '\u4E13\u6CE8\u6811';
}
function toggleKnowledgeTreeFocusMode(){
  knowledgeTreeFocusMode = !knowledgeTreeFocusMode;
  writeUiBool(UI_KEY_KNOWLEDGE_TREE_FOCUS, knowledgeTreeFocusMode);
  applyKnowledgeTreeFocusMode();
}
function initUiChromePrefs(){
  errorsTopCollapsed = readUiBool(UI_KEY_ERRORS_TOP_COLLAPSED, false);
  knowledgeTreeFocusMode = readUiBool(UI_KEY_KNOWLEDGE_TREE_FOCUS, false);
  applyErrorsTopCollapsedState();
  applyKnowledgeTreeFocusMode();
  syncKnowledgeTreeSearchUi();
}

// 答题状态
let quizQueue    = [];
let quizIdx      = 0;
let quizAnswers  = []; // [{id, userAnswer, correct, skipped}]
let quizSkipped  = new Set(); // 跳过的题目 index

const INTERVALS = [1, 3, 7, 15, 30, 60];

// 编辑弹窗临时图片
let editImgBase64   = null;  // 当前编辑的图片 base64
let editImgDeleted  = false; // 用户主动点了删除按钮

// 解析图片
let editAnalysisImgBase64  = null;
let editAnalysisImgDeleted = false;
let aiAnalyzeBusy = false;
let aiAnalyzeResult = null;
let questionOCRBusy = false;
let questionOCRResult = null;

function normalizeEntryKind(value, fallback) {
  if (value === 'claude_bank') return 'claude_bank';
  if (value === 'error') return 'error';
  return fallback === 'claude_bank' ? 'claude_bank' : 'error';
}
function isClaudeBankEntry(item) {
  return !!item && normalizeEntryKind(item.entryKind, 'error') === 'claude_bank';
}
function isErrorEntry(item) {
  return !!item && normalizeEntryKind(item.entryKind, 'error') === 'error';
}
function normalizeEntryRecord(item, fallbackKind) {
  const record = item && typeof item === 'object' ? { ...item } : {};
  record.entryKind = normalizeEntryKind(record.entryKind, fallbackKind);
  const addDate = String(record.addDate || '').trim();
  const updatedAt = String(record.updatedAt || record.modifiedAt || record.lastModifiedAt || '').trim();
  const masteryUpdatedAt = String(record.masteryUpdatedAt || record.masteredAt || '').trim();
  const createdAt = String(record.createdAt || record.sentAt || record.sharedAt || record.ccSentAt || record.claudeSentAt || record.codexSentAt || '').trim();
  if (addDate) record.addDate = addDate;
  if (updatedAt) record.updatedAt = updatedAt;
  if (masteryUpdatedAt) record.masteryUpdatedAt = masteryUpdatedAt;
  if (createdAt) {
    record.createdAt = createdAt;
    if (!record.sentAt) record.sentAt = createdAt;
  }
  return record;
}
function getErrorEntries() {
  return errors.filter(isErrorEntry);
}
function getClaudeBankEntries() {
  return errors.filter(isClaudeBankEntry);
}
function hasFullWorkspaceDataLoaded() {
  return !!fullDataLoaded;
}
function getStartupSummaryCache() {
  return startupSummaryCache || null;
}

// 日期筛选
let dateFrom = '';
let dateTo   = '';

// 内联做题状态：id → {answered:bool, userAnswer:str, correct:bool}
const inlineQuizState = {};
let batchMode = false;
let batchSelected = new Set();
let _modalDiff = 0; // 弹窗中当前选中的难度

// （图片直接以 base64 存在 e.imgData 里）
