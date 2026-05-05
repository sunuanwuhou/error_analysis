// ==UserScript==
// @name         Fenbi Export Current Question (Simple)
// @namespace    xingce-local
// @version      0.9.1
// @description  Export Fenbi questions as error records; shows a selection popup when multiple questions are captured
// @match        *://fenbi.com/*
// @match        *://www.fenbi.com/*
// @match        *://spa.fenbi.com/*
// @match        *://*.fenbi.com/*
// @grant        GM_setClipboard
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // Matches strings like "3_1_bb254"
  const KEY_RE = /^\d+_\d+_[a-z0-9]+$/i;
  const BUTTON_ID     = 'fenbi-export-fixed-btn';
  const DEBUG_BTN_ID  = 'fenbi-export-debug-btn';
  const POPUP_ID      = 'fenbi-export-popup';

  const store = {
    questionMap: new Map(),   // storeKey -> normalized question record
    lastExportAt: 0,
    urlTrackedKey: null,
    mountTimer: 0,
    recentUrls: [],           // [{url, passed}] last 30
  };

  console.log('[FenbiExport] v0.9.1 started:', location.href);

  // ---------------------------------------------------------------------------
  // Standard 行测 type taxonomy (three levels)
  // Mirrors the app's expTypes / expMain / expMainSub structure.
  // User can always type a custom value manually.
  // ---------------------------------------------------------------------------

  const XINGCE_TAXONOMY = {
    '判断推理': {
      '图形推理':   ['空间折叠', '规律推理', '图形类比', '平面拼合', '图形分类'],
      '逻辑判断':   ['条件推理', '论证推理', '原因推理', '假设推理', '解释推理', '结论推理', '加强支持', '削弱质疑'],
      '定义判断':   ['单定义', '多定义'],
      '类比推理':   ['语义关系', '逻辑关系', '语法关系', '常识关系'],
    },
    '言语理解与表达': {
      '阅读理解':   ['主旨观点', '细节判断', '词句理解', '态度意图', '标题填入', '推断下文'],
      '逻辑填空':   ['语境分析', '近义词辨析', '成语辨析', '关联词'],
      '语句表达':   ['语句排序', '语句填充', '语句衔接', '下文续写'],
    },
    '数量关系': {
      '数学运算':   ['行程问题', '工程问题', '概率问题', '排列组合', '集合问题', '数论', '比例问题', '利润问题', '数学综合'],
      '数字推理':   ['等差数列', '等比数列', '递推数列', '图形数字推理'],
    },
    '资料分析': {
      '综合分析':   [],
      '增长率分析': [],
      '比重分析':   [],
      '倍数分析':   [],
      '平均数分析': [],
    },
    '常识判断': {
      '政治':   [],
      '法律':   ['宪法', '民法', '刑法', '行政法', '诉讼法'],
      '经济':   [],
      '历史':   [],
      '文化':   [],
      '科技':   [],
      '地理':   [],
      '生活常识': [],
    },
    '申论': {
      '归纳概括':   [],
      '综合分析':   [],
      '提出对策':   [],
      '文章写作':   [],
      '应用文写作': [],
    },
  };

  // Fenbi module prefix → 行测 type name
  // Inferred from observed question keys: 3_1_bb254=判断推理, 4_1_76l3i=资料分析
  const FENBI_MODULE_MAP = {
    '1': '常识判断',
    '2': '言语理解与表达',
    '3': '判断推理',
    '4': '资料分析',
    '5': '数量关系',
    '6': '申论',
  };

  window.__fb = {
    dump() {
      console.group('[FenbiExport] v0.9.1 dump');
      console.log('questionMap size:', store.questionMap.size);
      store.questionMap.forEach((v, k) => {
        const ti = v.typeInfo || {};
        console.log(' key:', k, '| type:', ti.type || '-', '| q:', (v.question || '').slice(0, 50), '| ans:', v.answer);
      });
      console.groupEnd();
      console.group('[FenbiExport] recent URLs');
      store.recentUrls.forEach(({ url, passed }) =>
        console.log(passed ? '%c PASS ' : '%c BLOCK', passed ? 'background:#52c41a;color:#fff' : 'background:#f5222d;color:#fff', url)
      );
      console.groupEnd();
    },
    // Dump the COMPLETE raw API node for a captured question.
    // Prints as pretty JSON AND copies to clipboard.
    // Usage: window.__fb.dumpRaw(0)  — index 0 = first question
    dumpRaw(index = 0) {
      const entries = Array.from(store.questionMap.values());
      const q = entries[index];
      if (!q) {
        console.warn('[FenbiExport] no question at index', index,
          '| total captured:', store.questionMap.size);
        return;
      }
      const raw = q.raw || {};
      const json = JSON.stringify(raw, null, 2);
      console.group(`[FenbiExport] FULL raw node — key=${q.key} (index ${index}/${entries.length - 1})`);
      console.log(json);
      console.groupEnd();
      // Copy to clipboard so it can be pasted anywhere
      try {
        if (typeof GM_setClipboard === 'function') {
          GM_setClipboard(json, 'text');
          console.log('[FenbiExport] ✓ raw JSON copied to clipboard via GM_setClipboard');
        } else if (navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(json).then(() =>
            console.log('[FenbiExport] ✓ raw JSON copied to clipboard')
          );
        }
      } catch (_) {}
      return raw; // Also return the object so you can inspect it interactively
    },
    map: store.questionMap,
  };

  // ---------------------------------------------------------------------------
  // Text helpers
  // ---------------------------------------------------------------------------

  function textify(value) {
    if (value == null) return '';
    if (typeof value === 'string') {
      return value
        .replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ')
        .replace(/\u00a0/g, ' ').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n')
        .replace(/[ \t]{2,}/g, ' ').trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map(textify).filter(Boolean).join('\n');
    if (typeof value === 'object') {
      for (const k of ['content', 'text', 'value', 'desc', 'description', 'title', 'stem', 'question']) {
        if (value[k] != null) { const t = textify(value[k]); if (t) return t; }
      }
    }
    return '';
  }

  function getFirst(obj, keys) {
    if (!obj || typeof obj !== 'object') return null;
    for (const key of keys) {
      const v = obj[key];
      if (v != null && v !== '' && !(Array.isArray(v) && v.length === 0)) return v;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Key detection — three tiers
  //   1. Known field names with KEY_RE string (e.g. "3_1_bb254")
  //   2. Scan all top-level string values for KEY_RE pattern
  //   3. Any numeric ID > 0 (fallback, prefixed with page path for uniqueness)
  // ---------------------------------------------------------------------------

  function resolveQuestionKey(node) {
    // Tier 1: known field names, string matching KEY_RE
    const knownFields = ['key', 'questionKey', 'questionId', 'quizId', 'qKey', 'code', 'hash', 'questionCode'];
    for (const field of knownFields) {
      const v = node[field];
      if (typeof v === 'string' && KEY_RE.test(v)) return { key: v, tier: 1 };
    }

    // Tier 2: any string value in the top-level node that matches KEY_RE
    for (const [, v] of Object.entries(node)) {
      if (typeof v === 'string' && KEY_RE.test(v)) return { key: v, tier: 2 };
    }

    // Tier 3: any positive numeric id — prefix with URL path segment for uniqueness
    const numericFields = ['id', 'qid', 'questionId', 'no', 'index', 'seq'];
    for (const field of numericFields) {
      const v = node[field];
      if (typeof v === 'number' && v > 0) {
        // Use exam key from URL if available to make it unique
        const urlMatch = location.pathname.match(/\/(\d+_\d+_[a-z0-9]+)/i);
        const prefix = urlMatch ? urlMatch[1] : location.pathname.replace(/\W+/g, '_').slice(-20);
        return { key: `${prefix}_q${v}`, tier: 3 };
      }
    }

    return null;
  }

  // ---------------------------------------------------------------------------
  // Question node detection
  // ---------------------------------------------------------------------------

  function looksLikeQuestionNode(node) {
    if (!node || typeof node !== 'object') return false;
    const keyResult = resolveQuestionKey(node);
    if (!keyResult) return false;

    const question = getFirst(node, ['stem', 'question', 'questionStem', 'content', 'material']);
    const answer = getFirst(node, ['answer', 'answers', 'correctAnswer', 'rightAnswer', 'standardAnswer']);
    const options = getFirst(node, ['options', 'optionList', 'choices']);
    const questionText = textify(question);
    return questionText.length >= 8 || !!textify(answer) || (Array.isArray(options) && options.length >= 2);
  }

  function normalizeOptions(raw) {
    if (!Array.isArray(raw)) return textify(raw);
    const parts = [];
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      if (item && typeof item === 'object') {
        const label = textify(getFirst(item, ['name', 'label', 'key', 'index'])) || String.fromCharCode(65 + i);
        const content = textify(getFirst(item, ['content', 'text', 'value', 'desc', 'optionContent']));
        if (content) parts.push(`${label}. ${content}`.trim());
      } else {
        const content = textify(item);
        if (content) parts.push(content);
      }
    }
    return parts.join('|');
  }

  function normalizeAnswer(raw) {
    if (raw == null) return '';
    // Boolean answers → 判断题 "正确"/"错误"
    if (raw === true  || raw === 1)  return '正确';
    if (raw === false || raw === 0)  return '错误';
    if (typeof raw === 'string') {
      const s = raw.replace(/\s+/g, '');
      // Fenbi sometimes returns "true"/"false" as strings
      if (s === 'true'  || s === '1') return '正确';
      if (s === 'false' || s === '0') return '错误';
      return s;
    }
    if (Array.isArray(raw)) return raw.map(normalizeAnswer).filter(Boolean).join(',');
    if (typeof raw === 'object') {
      // Try nested answer objects
      for (const key of ['choice', 'choices', 'answer', 'value', 'correct', 'result', 'rightAnswer', 'correctAnswer']) {
        const v = raw[key];
        if (v != null) {
          const t = normalizeAnswer(v);
          if (t) return t;
        }
      }
    }
    return textify(raw).replace(/\s+/g, '');
  }

  // ---------------------------------------------------------------------------
  // Type / meta extraction
  // ---------------------------------------------------------------------------

  function extractTypeInfo(node, resolvedKey) {
    // --- Level 1: main type ---
    // Try every plausible field name fenbi might use
    const TYPE_FIELDS = [
      'typeName', 'type', 'categoryName', 'category',
      'mainType', 'mainTypeName', 'moduleType', 'moduleName',
      'subjectName', 'subject', 'sectionType', 'sectionName',
      'questionType', 'questionTypeName', 'questionModule',
      'chapter', 'chapterName', 'unit', 'unitName',
      'module', 'moduleTitle', 'domain', 'domainName',
    ];
    let type = textify(getFirst(node, TYPE_FIELDS)) || '';

    // --- Level 2: subtype ---
    const SUBTYPE_FIELDS = [
      'subTypeName', 'subType', 'secondTypeName', 'secondType',
      'subCategoryName', 'subCategory', 'tagName',
      'knowledgeType', 'knowledgeTypeName',
      'subjectDetail', 'sectionDetail',
      'questionSubType', 'questionSubTypeName',
      'section', 'topic', 'topicName',
      // Fenbi 常识判断 specific
      'catalogName', 'catalog', 'pointName', 'point',
      'knowledgePointName', 'knowledgePoint',
      'subjectModule', 'subjectModuleName',
      'abilityName', 'ability',
      'skillName', 'skill',
    ];
    let subtype = textify(getFirst(node, SUBTYPE_FIELDS)) || '';

    // If subtype still empty, try extracting from nested knowledge objects
    if (!subtype) {
      for (const field of ['knowledge', 'knowledgeInfo', 'catalog', 'catalogInfo', 'point', 'pointInfo', 'tag', 'tagInfo']) {
        const obj = node[field];
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          const name = textify(getFirst(obj, ['name', 'title', 'label', 'text', 'value']));
          if (name) { subtype = name; break; }
        }
      }
    }

    // --- Level 3: sub-subtype (knowledge point) ---
    let subSubtype = '';
    const tags = node.tags || node.tagList || node.labels || node.knowledgePoints || [];
    if (Array.isArray(tags) && tags.length >= 3) {
      subSubtype = textify(getFirst(tags[2], ['name', 'tagName', 'label', 'value', 'title']) || tags[2]);
    }
    if (!subSubtype) {
      subSubtype = textify(getFirst(node, [
        'thirdTypeName', 'thirdType', 'knowledgeName', 'knowledge',
        'pointName', 'knowledgePoint', 'skillName', 'abilityName',
      ])) || '';
    }

    // Also try extracting type/subtype from tags array (tags[0] = type, tags[1] = subtype)
    if (!type && Array.isArray(tags) && tags.length >= 1) {
      type = textify(getFirst(tags[0], ['name', 'tagName', 'label', 'value', 'title']) || tags[0]);
    }
    if (!subtype && Array.isArray(tags) && tags.length >= 2) {
      subtype = textify(getFirst(tags[1], ['name', 'tagName', 'label', 'value', 'title']) || tags[1]);
    }

    // --- Fallback: infer type from question key prefix (e.g. "4_1_76l3i" → "资料分析") ---
    if (!type && resolvedKey) {
      const keyStr = String(resolvedKey);
      const prefix = keyStr.match(/^(\d+)_/)?.[1];
      if (prefix && FENBI_MODULE_MAP[prefix]) {
        type = FENBI_MODULE_MAP[prefix];
        console.log(`[FenbiExport] type inferred from key prefix "${prefix}": ${type}`);
      }
    }

    return { type, subtype, subSubtype };
  }

  function extractMeta(node, qKey) {
    const rawId = getFirst(node, ['id', 'questionId', 'quizId']);
    const fenbiQuestionId = typeof rawId === 'number' ? rawId : (parseInt(rawId, 10) || null);
    const difficulty = (() => {
      const raw = getFirst(node, ['difficulty', 'difficultyLevel', 'difficultyScore', 'hardLevel']);
      if (raw == null) return 0;
      const n = parseFloat(raw);
      if (isNaN(n)) return 0;
      return n <= 1 ? Math.round(n * 5) : Math.round(n);
    })();
    const correctRatio = (() => {
      const raw = getFirst(node, ['correctRatio', 'correctRate', 'accuracyRate', 'accuracy', 'rightRate']);
      if (raw == null) return null;
      const n = parseFloat(raw);
      if (isNaN(n)) return null;
      return n <= 1 ? parseFloat((n * 100).toFixed(2)) : parseFloat(n.toFixed(2));
    })();
    return {
      fenbiQuestionKey: qKey,
      fenbiQuestionId,
      difficulty,
      fenbiCorrectRatio: correctRatio,
      fenbiScoreRate: parseFloat(getFirst(node, ['scoreRate', 'score', 'myScore'])) || null,
      fenbiMostWrongChoice: textify(getFirst(node, ['mostWrongChoice', 'mostErrorChoice', 'wrongChoice'])) || null,
      fenbiStatus: getFirst(node, ['status', 'questionStatus', 'exerciseStatus']),
    };
  }

  // ---------------------------------------------------------------------------
  // Walk + ingest
  // ---------------------------------------------------------------------------

  function walk(node, visit) {
    if (node == null) return;
    if (Array.isArray(node)) { for (const item of node) walk(item, visit); return; }
    if (typeof node === 'object') { visit(node); for (const v of Object.values(node)) walk(v, visit); }
  }

  function ingest(payload, sourceUrl) {
    const root = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
    let matched = 0;

    walk(root, (node) => {
      if (!looksLikeQuestionNode(node)) return;
      const keyResult = resolveQuestionKey(node);
      if (!keyResult) return;
      const { key: qKey } = keyResult;

      const normalized = {
        key: qKey,
        question: textify(getFirst(node, ['stem', 'question', 'questionStem', 'content', 'material'])),
        options: normalizeOptions(getFirst(node, ['options', 'optionList', 'choices'])),
        answer: normalizeAnswer(getFirst(node, ['answer', 'answers', 'correctAnswer', 'rightAnswer', 'standardAnswer'])),
        typeInfo: extractTypeInfo(node, qKey),
        meta: extractMeta(node, qKey),
        sourceUrl,
      };

      const old = store.questionMap.get(qKey) || {};
      // Only update raw if the new node has richer question content than what's stored
      const oldRaw = old.raw;
      const newRawHasQuestion = !!(normalized.question);
      const oldRawHasQuestion = !!(old.question);
      const keepRaw = (newRawHasQuestion || !oldRawHasQuestion)
        ? normalized.raw
        : (oldRaw || normalized.raw);

      store.questionMap.set(qKey, {
        ...old, ...normalized,
        question: normalized.question || old.question || '',
        options: normalized.options || old.options || '',
        answer: normalized.answer || old.answer || '',
        typeInfo: {
          type: normalized.typeInfo.type || old.typeInfo?.type || '',
          subtype: normalized.typeInfo.subtype || old.typeInfo?.subtype || '',
          subSubtype: normalized.typeInfo.subSubtype || old.typeInfo?.subSubtype || '',
        },
        meta: { ...(old.meta || {}), ...normalized.meta },
        raw: keepRaw,
      });
      matched++;
    });

    if (matched) {
      console.log('[FenbiExport] captured:', matched, '| total:', store.questionMap.size);
      updateButtonLabel();
    }
  }

  // ---------------------------------------------------------------------------
  // URL filter
  // ---------------------------------------------------------------------------

  const URL_BLOCK_RE = /\/(user_member|user_info|user_profile|user_course|logout|notification|banner|recommend|course_intro|subject_intro)(\b|\/)/i;

  function shouldTrackUrl(url) {
    if (!url || !/fenbi\.com/i.test(url)) return false;
    return !URL_BLOCK_RE.test(url);
  }

  function recordUrl(url, passed) {
    store.recentUrls.push({ url, passed });
    if (store.recentUrls.length > 30) store.recentUrls.shift();
  }

  // ---------------------------------------------------------------------------
  // Network hooks
  // ---------------------------------------------------------------------------

  function hookFetch() {
    const rawFetch = window.fetch;
    if (typeof rawFetch !== 'function') return;
    window.fetch = async function (...args) {
      const res = await rawFetch.apply(this, args);
      try {
        const url = (args[0] && args[0].url) || String(args[0] || '');
        const passed = shouldTrackUrl(url);
        if (/fenbi\.com/i.test(url)) recordUrl(url, passed);
        if (!passed) return res;
        const clone = res.clone();
        if ((clone.headers.get('content-type') || '').includes('application/json')) {
          clone.json().then((json) => ingest(json, url)).catch(() => {});
        }
      } catch (_) {}
      return res;
    };
  }

  function hookXHR() {
    const open = XMLHttpRequest.prototype.open;
    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this.__fbUrl = url; return open.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function (...args) {
      this.addEventListener('load', function () {
        try {
          const url = String(this.__fbUrl || '');
          const passed = shouldTrackUrl(url);
          if (/fenbi\.com/i.test(url)) recordUrl(url, passed);
          if (!passed) return;
          if ((this.getResponseHeader('content-type') || '').includes('application/json') && this.responseText) {
            ingest(JSON.parse(this.responseText), url);
          }
        } catch (_) {}
      });
      return send.apply(this, args);
    };
  }

  // ---------------------------------------------------------------------------
  // DOM helpers — duration, my answer
  // ---------------------------------------------------------------------------

  function parseDurationSeconds() {
    const text = document.body ? document.body.innerText : '';
    const ms = text.match(/答题用时\s*(\d+)\s*分\s*(\d+)\s*秒/);
    if (ms) return Number(ms[1]) * 60 + Number(ms[2]);
    const ss = text.match(/答题用时\s*(\d+)\s*秒/);
    if (ss) return Number(ss[1]);
    const mm = text.match(/答题用时\s*(\d+)\s*分/);
    if (mm) return Number(mm[1]) * 60;
    // Fallback: just look for a "Ns" or "Nm Ns" pattern near 答题用时 label
    const alt = text.match(/(\d+)\s*秒/);
    if (alt) return Number(alt[1]);
    return 0;
  }

  function parseMyAnswer() {
    const bodyText = document.body ? document.body.innerText : '';
    // Explicit "我的答案" label
    const explicit = bodyText.match(/你的答案[:：]?\s*([A-D正确错误]+)|我的答案[:：]?\s*([A-D正确错误]+)/);
    if (explicit) return (explicit[1] || explicit[2] || '').replace(/\s/g, '');
    // DOM scan for selected option elements
    const selected = [];
    const candidates = Array.from(document.querySelectorAll('div, li, label, span, p')).filter((el) => {
      const t = (el.textContent || '').trim();
      return /^[A-D][.、\s]/.test(t) || /^(正确|错误)$/.test(t);
    });
    for (const el of candidates) {
      const text = (el.textContent || '').trim();
      const cls = String(el.className || '');
      const isSelected =
        /selected|active|checked|choose|user-answer|my-answer|wrong|error|right|correct/i.test(cls) ||
        el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-selected') === 'true';
      if (isSelected) {
        const m = text.match(/^([A-D])/);
        if (m) selected.push(m[1]);
        else if (/^(正确|错误)$/.test(text)) selected.push(text);
      }
    }
    return selected.join('');
  }

  // ---------------------------------------------------------------------------
  // Image helpers
  // ---------------------------------------------------------------------------

  function getQuestionImages() {
    return Array.from(document.querySelectorAll('img')).filter((img) => {
      const src = img.currentSrc || img.src || '';
      if (!src) return false;
      // Skip external CDN/formula images that will fail CORS (e.g. fb.fbstatic.cn LaTeX)
      if (!/fenbi\.com/i.test(src) && !src.startsWith('data:')) return false;
      const rect = img.getBoundingClientRect();
      if (rect.width < 30 || rect.height < 30) return false;
      if (/avatar|logo|icon|thumb|badge|btn|button/i.test(src)) return false;
      return true;
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function imageToDataUrl(img) {
    try {
      const src = img.currentSrc || img.src;
      if (!src) return '';
      const res = await fetch(src, { credentials: 'include' });
      const blob = await res.blob();
      if (blob.size > 300 * 1024) return src;
      return await blobToDataUrl(blob);
    } catch { return ''; }
  }

  async function collectImageData() {
    const imgs = getQuestionImages();
    const results = [];
    for (const img of imgs) { const d = await imageToDataUrl(img); if (d) results.push(d); }
    return results;
  }

  // ---------------------------------------------------------------------------
  // Export record builder
  // ---------------------------------------------------------------------------

  function buildExportRecord(question, myAnswer, actualDurationSec, imgData) {
    const ti = question.typeInfo || {};
    const meta = question.meta || {};
    const answer = normalizeAnswer(question.answer);
    return {
      type: ti.type || '',
      subtype: ti.subtype || '',
      subSubtype: ti.subSubtype || '',
      question: question.question || '',
      options: question.options || '',
      answer,
      myAnswer,
      actualDurationSec,
      targetDurationSec: null,
      confidence: null,
      problemType: null,
      rootReason: '',
      errorReason: '',
      analysis: '',
      tip: '',
      difficulty: meta.difficulty || 0,
      status: 'focus',
      imgData: imgData.length === 1 ? imgData[0] : (imgData.length > 1 ? imgData : null),
      analysisImgData: null,
      srcOrigin: `fenbi::userscript::${question.key}`,
      srcYear: '',
      srcProvince: '',
      meta: {
        fenbiQuestionKey: meta.fenbiQuestionKey || question.key,
        fenbiQuestionId: meta.fenbiQuestionId || null,
        fenbiCorrectRatio: meta.fenbiCorrectRatio || null,
        fenbiScoreRate: meta.fenbiScoreRate || null,
        fenbiMostWrongChoice: meta.fenbiMostWrongChoice || null,
        fenbiStatus: meta.fenbiStatus != null ? meta.fenbiStatus : null,
        capturedAt: new Date().toISOString(),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Download + clipboard
  // ---------------------------------------------------------------------------

  function downloadJson(name, data) {
    const text = JSON.stringify(data, null, 2);
    const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1500);
  }

  async function copyText(text) {
    try { if (typeof GM_setClipboard === 'function') { GM_setClipboard(text, 'text'); return; } } catch (_) {}
    try { if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text); } catch (_) {}
  }

  // ---------------------------------------------------------------------------
  // Export selected questions
  // ---------------------------------------------------------------------------

  async function exportKeys(keys) {
    const myAnswer = parseMyAnswer();
    const actualDurationSec = parseDurationSeconds();
    const imgData = keys.length === 1 ? await collectImageData() : [];
    const records = keys.map((k) => {
      const q = store.questionMap.get(k);
      return buildExportRecord(q, myAnswer, actualDurationSec, imgData);
    });
    const fileName = keys.length === 1
      ? `fenbi_${keys[0]}_${Date.now()}.json`
      : `fenbi_batch_${Date.now()}.json`;
    const jsonText = JSON.stringify(records, null, 2);
    await copyText(jsonText);
    downloadJson(fileName, records);
    console.log('[FenbiExport] exported', records.length, 'question(s):', keys);
  }

  // ---------------------------------------------------------------------------
  // Selection popup
  // ---------------------------------------------------------------------------

  const LS_TYPE_KEY = 'fenbi_export_last_type';

  function closePopup() {
    document.getElementById(POPUP_ID)?.remove();
  }

  /** Build cascading <select> elements for type / subtype / subSubtype */
  function buildTypeSelectors(container, initialType, initialSubtype, initialSubSubtype) {
    const css = (el, styles) => Object.assign(el.style, styles);
    const selectBase = {
      padding: '5px 8px', border: '1px solid #d9d9d9', borderRadius: '6px',
      fontSize: '13px', color: '#333', background: '#fff', flex: '1',
      outline: 'none', cursor: 'pointer', minWidth: '0',
    };

    const row = document.createElement('div');
    css(row, { display: 'flex', gap: '8px', flexWrap: 'wrap' });

    const makeSelect = (placeholder) => {
      const sel = document.createElement('select');
      css(sel, selectBase);
      const blank = document.createElement('option');
      blank.value = ''; blank.textContent = placeholder;
      sel.appendChild(blank);
      return sel;
    };

    const typeEl    = makeSelect('题型');
    const subtypeEl = makeSelect('子类型');
    const sub2El    = makeSelect('知识点');

    // Populate typeEl
    Object.keys(XINGCE_TAXONOMY).forEach((t) => {
      const o = document.createElement('option'); o.value = t; o.textContent = t;
      typeEl.appendChild(o);
    });

    const repopulateSubtype = (type) => {
      subtypeEl.innerHTML = '<option value="">子类型</option>';
      sub2El.innerHTML    = '<option value="">知识点</option>';
      const subs = XINGCE_TAXONOMY[type] || {};
      Object.keys(subs).forEach((s) => {
        const o = document.createElement('option'); o.value = s; o.textContent = s;
        subtypeEl.appendChild(o);
      });
    };

    const repopulateSub2 = (type, subtype) => {
      sub2El.innerHTML = '<option value="">知识点</option>';
      const items = (XINGCE_TAXONOMY[type] || {})[subtype] || [];
      items.forEach((s) => {
        const o = document.createElement('option'); o.value = s; o.textContent = s;
        sub2El.appendChild(o);
      });
    };

    typeEl.addEventListener('change', () => {
      repopulateSubtype(typeEl.value);
      repopulateSub2(typeEl.value, '');
    });
    subtypeEl.addEventListener('change', () => repopulateSub2(typeEl.value, subtypeEl.value));

    // Set initial values
    if (initialType) {
      typeEl.value = initialType;
      repopulateSubtype(initialType);
    }
    if (initialSubtype) {
      subtypeEl.value = initialSubtype;
      repopulateSub2(initialType, initialSubtype);
    }
    if (initialSubSubtype) sub2El.value = initialSubSubtype;

    row.appendChild(typeEl);
    row.appendChild(subtypeEl);
    row.appendChild(sub2El);
    container.appendChild(row);

    return {
      getType:    () => typeEl.value,
      getSubtype: () => subtypeEl.value,
      getSub2:    () => sub2El.value,
    };
  }

  function showSelectionPopup() {
    closePopup();

    const questions = Array.from(store.questionMap.entries());

    // Restore last used type from localStorage
    let lastType = {};
    try { lastType = JSON.parse(localStorage.getItem(LS_TYPE_KEY) || '{}'); } catch (_) {}

    // Detect most common type in captured questions
    const firstQ = questions[0]?.[1];
    const autoType    = firstQ?.typeInfo?.type    || lastType.type    || '';
    const autoSubtype = firstQ?.typeInfo?.subtype || lastType.subtype || '';
    const autoSub2    = firstQ?.typeInfo?.subSubtype || lastType.sub2 || '';

    const $ = (tag, styles = {}, text = '') => {
      const el = document.createElement(tag);
      Object.assign(el.style, styles);
      if (text) el.textContent = text;
      return el;
    };

    const overlay = $('div', {
      position: 'fixed', inset: '0', zIndex: '2147483646',
      background: 'rgba(0,0,0,0.45)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    });
    overlay.id = POPUP_ID;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closePopup(); });

    const panel = $('div', {
      background: '#fff', borderRadius: '12px',
      width: '580px', maxWidth: '92vw', maxHeight: '82vh',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 12px 40px rgba(0,0,0,0.25)', overflow: 'hidden',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    });

    // ── Header ──────────────────────────────────────────────────────────────
    const header = $('div', {
      padding: '14px 20px', borderBottom: '1px solid #f0f0f0',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    });
    header.appendChild($('span', { fontSize: '15px', fontWeight: '700', color: '#1a1a1a' },
      `导出错题（共 ${questions.length} 题）`));
    const xBtn = $('button', {
      border: 'none', background: 'none', cursor: 'pointer',
      fontSize: '18px', color: '#aaa', lineHeight: '1',
    }, '✕');
    xBtn.addEventListener('click', closePopup);
    header.appendChild(xBtn);

    // ── Type selector section ────────────────────────────────────────────────
    const typeSection = $('div', {
      padding: '10px 20px', borderBottom: '1px solid #f0f0f0', background: '#fafafa',
    });
    typeSection.appendChild($('div', {
      fontSize: '12px', color: '#888', marginBottom: '6px',
    }, '题型分类（API 自动识别，可手动修改）'));
    const typeSelectors = buildTypeSelectors(typeSection, autoType, autoSubtype, autoSub2);

    // ── Toolbar ──────────────────────────────────────────────────────────────
    const toolbar = $('div', {
      padding: '8px 20px', borderBottom: '1px solid #f0f0f0',
      display: 'flex', gap: '16px', alignItems: 'center',
    });
    const checkboxes = [];
    const makeLink = (text, onClick) => {
      const b = $('button', {
        border: 'none', background: 'none', color: '#1677ff',
        fontSize: '13px', cursor: 'pointer', padding: '0',
      }, text);
      b.addEventListener('click', onClick);
      return b;
    };
    toolbar.appendChild(makeLink('全选', () => checkboxes.forEach((c) => (c.checked = true))));
    toolbar.appendChild(makeLink('取消全选', () => checkboxes.forEach((c) => (c.checked = false))));

    // ── Question list ────────────────────────────────────────────────────────
    const list = $('div', { overflowY: 'auto', flex: '1' });

    questions.forEach(([key, q], idx) => {
      const ti = q.typeInfo || {};
      const preview = (q.question || '').replace(/\s+/g, ' ').slice(0, 65);
      const answer = normalizeAnswer(q.answer);

      const row = $('label', {
        display: 'flex', alignItems: 'flex-start', gap: '12px',
        padding: '10px 20px', cursor: 'pointer',
        borderBottom: '1px solid #f5f5f5',
      });
      row.addEventListener('mouseenter', () => (row.style.background = '#f0f5ff'));
      row.addEventListener('mouseleave', () => (row.style.background = ''));

      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = true;
      Object.assign(cb.style, { marginTop: '4px', flexShrink: '0', accentColor: '#1677ff' });
      checkboxes.push(cb);

      const body = $('div', { flex: '1', minWidth: '0' });

      const meta = $('div', { display: 'flex', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' });

      const badge = (text, fg, bg) => {
        const s = $('span', {
          fontSize: '11px', color: fg, background: bg,
          borderRadius: '4px', padding: '1px 6px',
        }, text);
        return s;
      };

      meta.appendChild(badge(`#${idx + 1}`, '#888', '#f0f0f0'));
      if (ti.type) meta.appendChild(badge(ti.type, '#1677ff', '#e6f4ff'));
      if (ti.subtype) meta.appendChild(badge(ti.subtype, '#389e0d', '#f6ffed'));
      if (answer) meta.appendChild(badge(`答案: ${answer}`, '#d46b08', '#fff7e6'));

      const previewEl = $('div', {
        fontSize: '13px', color: '#333', lineHeight: '1.5',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }, preview || '（题干未抓取到）');

      body.appendChild(meta);
      body.appendChild(previewEl);
      row.appendChild(cb);
      row.appendChild(body);
      list.appendChild(row);
    });

    // ── Footer — two export buttons ──────────────────────────────────────────
    const footer = $('div', {
      padding: '12px 20px', borderTop: '1px solid #f0f0f0',
      display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap',
    });

    const cancelBtn = $('button', {
      padding: '8px 18px', border: '1px solid #d9d9d9', borderRadius: '6px',
      background: '#fff', cursor: 'pointer', fontSize: '14px', color: '#555',
    }, '取消');
    cancelBtn.addEventListener('click', closePopup);

    const makeExportBtn = (label, mode) => {
      const isPrimary = mode === 'download';
      const btn = $('button', {
        padding: '8px 18px', border: isPrimary ? 'none' : '1px solid #1677ff',
        borderRadius: '6px',
        background: isPrimary ? '#1677ff' : '#fff',
        color: isPrimary ? '#fff' : '#1677ff',
        cursor: 'pointer', fontSize: '14px', fontWeight: '700',
      }, label);

      btn.addEventListener('click', async () => {
        const selectedKeys = questions.filter((_, i) => checkboxes[i].checked).map(([k]) => k);
        if (!selectedKeys.length) { alert('请至少选择一道题'); return; }

        // Apply type override from selectors
        const typeOverride    = typeSelectors.getType();
        const subtypeOverride = typeSelectors.getSubtype();
        const sub2Override    = typeSelectors.getSub2();

        // Save to localStorage for next time
        try {
          localStorage.setItem(LS_TYPE_KEY, JSON.stringify({
            type: typeOverride, subtype: subtypeOverride, sub2: sub2Override,
          }));
        } catch (_) {}

        btn.textContent = '处理中…'; btn.disabled = true;

        try {
          const myAnswer = parseMyAnswer();
          const actualDurationSec = parseDurationSeconds();
          const imgData = selectedKeys.length === 1 ? await collectImageData() : [];

          const records = selectedKeys.map((k) => {
            const q = store.questionMap.get(k);
            const rec = buildExportRecord(q, myAnswer, actualDurationSec, imgData);
            // Selector value always wins — user had a chance to see and correct auto-detected type
            if (typeOverride)    rec.type       = typeOverride;
            if (subtypeOverride) rec.subtype    = subtypeOverride;
            if (sub2Override)    rec.subSubtype = sub2Override;
            return rec;
          });

          const jsonText = JSON.stringify(records, null, 2);

          if (mode === 'copy') {
            await copyText(jsonText);
            btn.textContent = '✓ 已复制';
            // Don't close — user might also want to download
            setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 1800);
          } else {
            const fileName = selectedKeys.length === 1
              ? `fenbi_${selectedKeys[0]}_${Date.now()}.json`
              : `fenbi_batch_${Date.now()}.json`;
            downloadJson(fileName, records);
            btn.textContent = '✓ 已下载';
            setTimeout(closePopup, 1000);
          }
          console.log('[FenbiExport] exported', records.length, 'records via', mode);
        } catch (err) {
          console.error('[FenbiExport]', err);
          btn.textContent = '失败'; btn.disabled = false;
        }
      });

      return btn;
    };

    footer.appendChild(cancelBtn);
    footer.appendChild(makeExportBtn('复制 JSON', 'copy'));
    footer.appendChild(makeExportBtn('下载文件', 'download'));

    panel.appendChild(header);
    panel.appendChild(typeSection);
    panel.appendChild(toolbar);
    panel.appendChild(list);
    panel.appendChild(footer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  // ---------------------------------------------------------------------------
  // Button click handler
  // ---------------------------------------------------------------------------

  async function onButtonClick() {
    const now = Date.now();
    if (now - store.lastExportAt < 400) return;
    store.lastExportAt = now;

    const btn = document.getElementById(BUTTON_ID);
    const setStatus = (text, color) => {
      if (!btn) return;
      btn.textContent = text;
      btn.style.borderColor = color;
      btn.style.color = color;
    };

    const size = store.questionMap.size;

    if (size === 0) {
      setStatus('未抓到题', '#f5222d');
      setTimeout(updateButtonLabel, 2500);
      return;
    }

    // 1 or more questions → always show popup (type selector + two export buttons)
    showSelectionPopup();
  }

  // ---------------------------------------------------------------------------
  // Button keepalive
  // ---------------------------------------------------------------------------

  function updateButtonLabel() {
    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;
    const n = store.questionMap.size;
    btn.textContent = n > 0 ? `导出错题 (${n})` : '导出错题';
    btn.style.borderColor = '#1677ff';
    btn.style.color = '#1677ff';
  }

  let _debounceTimer = 0;

  function ensureFixedButton() {
    if (!document.body) return;

    // Main export button
    let btn = document.getElementById(BUTTON_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = BUTTON_ID;
      btn.type = 'button';
      btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        onButtonClick().catch(console.error);
      });
      document.body.appendChild(btn);
    }
    Object.assign(btn.style, {
      position: 'fixed', right: '20px', bottom: '24px', zIndex: '2147483647',
      display: 'block', visibility: 'visible', opacity: '1', pointerEvents: 'auto',
      padding: '12px 18px', border: '2px solid #1677ff', borderRadius: '999px',
      background: '#ffffff', color: '#1677ff', cursor: 'pointer',
      fontSize: '14px', fontWeight: '700', lineHeight: '20px',
      boxShadow: '0 6px 18px rgba(22,119,255,0.28)',
    });
    updateButtonLabel();

    // Debug button — opens raw data viewer
    let dbg = document.getElementById(DEBUG_BTN_ID);
    if (!dbg) {
      dbg = document.createElement('button');
      dbg.id = DEBUG_BTN_ID;
      dbg.type = 'button';
      dbg.title = '查看原始 API 数据（调试用）';
      dbg.textContent = '🔍';
      dbg.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        showRawDataPopup();
      });
      document.body.appendChild(dbg);
    }
    Object.assign(dbg.style, {
      position: 'fixed', right: '20px', bottom: '68px', zIndex: '2147483647',
      display: 'block', visibility: 'visible', opacity: '0.7', pointerEvents: 'auto',
      width: '32px', height: '32px', border: '1px solid #d9d9d9', borderRadius: '50%',
      background: '#fff', cursor: 'pointer', fontSize: '16px', lineHeight: '30px',
      textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    });
    dbg.addEventListener('mouseenter', () => (dbg.style.opacity = '1'));
    dbg.addEventListener('mouseleave', () => (dbg.style.opacity = '0.7'));
  }

  function startButtonKeeper() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureFixedButton, { once: true });
    } else {
      ensureFixedButton();
    }
    const observer = new MutationObserver(() => {
      clearTimeout(_debounceTimer);
      _debounceTimer = setTimeout(ensureFixedButton, 200);
    });
    const startObserve = () => {
      if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startObserve, { once: true });
    } else {
      startObserve();
    }
    if (store.mountTimer) clearInterval(store.mountTimer);
    store.mountTimer = window.setInterval(ensureFixedButton, 3000);
  }

  // ---------------------------------------------------------------------------
  // SPA navigation
  // ---------------------------------------------------------------------------

  function onRouteChange() {
    setTimeout(() => {
      const m = location.href.match(/[/#](\d+_\d+_[a-z0-9]+)/i);
      if (m) store.urlTrackedKey = m[1];
      ensureFixedButton();
    }, 300);
  }

  function hookSpaNavigation() {
    const wrap = (name) => {
      const raw = history[name];
      if (typeof raw !== 'function') return;
      history[name] = function (...args) { const r = raw.apply(this, args); onRouteChange(); return r; };
    };
    wrap('pushState');
    wrap('replaceState');
    window.addEventListener('popstate', onRouteChange);
  }

  // Keyboard: Alt+E export/popup, Alt+D debug dump, Alt+R raw dump, Escape close popup
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closePopup(); return; }
    if (!e.altKey) return;
    if (e.key.toLowerCase() === 'e') onButtonClick().catch(console.error);
    if (e.key.toLowerCase() === 'd') window.__fb.dump();
    if (e.key.toLowerCase() === 'r') showRawDataPopup();
  });

  // ---------------------------------------------------------------------------
  // Raw data viewer popup — shows full API response, no console needed
  // ---------------------------------------------------------------------------

  function showRawDataPopup() {
    const entries = Array.from(store.questionMap.entries());
    if (!entries.length) {
      alert('[FenbiExport] 还没有捕获到任何题目');
      return;
    }

    const existing = document.getElementById('fenbi-raw-popup');
    if (existing) { existing.remove(); return; }

    const $ = (tag, styles = {}, text = '') => {
      const el = document.createElement(tag);
      Object.assign(el.style, styles);
      if (text) el.textContent = text;
      return el;
    };

    const overlay = $('div', {
      position: 'fixed', inset: '0', zIndex: '2147483645',
      background: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    });
    overlay.id = 'fenbi-raw-popup';
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const panel = $('div', {
      background: '#1e1e1e', borderRadius: '10px',
      width: '720px', maxWidth: '94vw', maxHeight: '85vh',
      display: 'flex', flexDirection: 'column',
      boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
      fontFamily: 'monospace',
    });

    // Header with question selector
    const header = $('div', {
      padding: '10px 16px', borderBottom: '1px solid #333',
      display: 'flex', alignItems: 'center', gap: '10px',
    });
    header.appendChild($('span', { color: '#ccc', fontSize: '13px', flexShrink: '0' }, '原始数据'));

    const sel = document.createElement('select');
    Object.assign(sel.style, {
      flex: '1', background: '#2d2d2d', color: '#ccc', border: '1px solid #444',
      borderRadius: '4px', padding: '4px 8px', fontSize: '12px',
    });
    entries.forEach(([k, q], i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = `[${i}] ${k} — ${(q.question || '').slice(0, 40)}`;
      sel.appendChild(o);
    });
    header.appendChild(sel);

    const copyBtn = $('button', {
      padding: '4px 12px', border: '1px solid #555', borderRadius: '4px',
      background: '#2d2d2d', color: '#7ec8e3', cursor: 'pointer',
      fontSize: '12px', flexShrink: '0',
    }, '复制');

    const closeBtn = $('button', {
      padding: '4px 10px', border: 'none', background: 'none',
      color: '#888', cursor: 'pointer', fontSize: '16px', flexShrink: '0',
    }, '✕');
    closeBtn.addEventListener('click', () => overlay.remove());

    header.appendChild(copyBtn);
    header.appendChild(closeBtn);

    // Code area
    const pre = $('pre', {
      flex: '1', overflowY: 'auto', margin: '0',
      padding: '14px 16px', color: '#d4d4d4',
      fontSize: '12px', lineHeight: '1.6',
      whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    });

    const renderRaw = (idx) => {
      const q = entries[idx]?.[1];
      if (!q) return;
      const raw = q.raw || {};
      const rawKeys = Object.keys(raw).length;
      // Show extracted fields first, then the raw API node
      const display = {
        '=== 已提取字段 ===': null,
        key: q.key,
        question: (q.question || '').slice(0, 100) + (q.question?.length > 100 ? '…' : ''),
        options: q.options,
        answer: q.answer,
        typeInfo: q.typeInfo,
        meta: q.meta,
        '=== 原始 API 节点 ===' : `(${rawKeys} 个字段)`,
        ...raw,
      };
      try {
        pre.textContent = JSON.stringify(display, null, 2);
      } catch (e) {
        // Circular reference fallback
        pre.textContent = `提取字段:\n${JSON.stringify({
          key: q.key, question: (q.question||'').slice(0,80),
          answer: q.answer, options: q.options, typeInfo: q.typeInfo, meta: q.meta,
        }, null, 2)}\n\n原始节点字段数: ${rawKeys}\n字段名: ${Object.keys(raw).join(', ')}`;
      }
    };

    sel.addEventListener('change', () => renderRaw(Number(sel.value)));
    copyBtn.addEventListener('click', () => {
      const text = pre.textContent;
      try {
        if (typeof GM_setClipboard === 'function') GM_setClipboard(text, 'text');
        else navigator.clipboard?.writeText(text);
        copyBtn.textContent = '✓ 已复制';
        setTimeout(() => (copyBtn.textContent = '复制'), 1500);
      } catch (_) {}
    });

    renderRaw(0);

    panel.appendChild(header);
    panel.appendChild(pre);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  hookFetch();
  hookXHR();
  startButtonKeeper();
  hookSpaNavigation();
})();
