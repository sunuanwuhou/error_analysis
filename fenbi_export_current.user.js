// ==UserScript==
// @name         Fenbi Export Current Question (Simple)
// @namespace    xingce-local
// @version      0.7.0
// @description  Export current Fenbi question as simple JSON with text, answers, duration and images
// @match        *://fenbi.com/*
// @match        *://www.fenbi.com/*
// @match        *://spa.fenbi.com/*
// @match        *://*.fenbi.com/*
// @grant        GM_setClipboard
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const store = {
    questionMap: new Map(),
    lastExportAt: 0,
    // Track the key that was last "navigated to" via URL change
    urlTrackedKey: null,
    mountTimer: 0,
  };

  // Matches strings like "3_1_bb254" or "12_5_abc123"
  const KEY_RE = /^\d+_\d+_[a-z0-9]+$/i;
  const BUTTON_ID = 'fenbi-export-fixed-btn';

  console.log('[FenbiExport] v0.7.0 started:', location.href);

  // Expose debug handle so you can type window.__fb.dump() in console
  window.__fb = {
    dump() {
      console.group('[FenbiExport] store dump');
      console.log('questionMap size:', store.questionMap.size);
      console.log('urlTrackedKey:', store.urlTrackedKey);
      store.questionMap.forEach((v, k) => {
        console.log(' key:', k, '| q:', (v.question || '').slice(0, 60), '| ans:', v.answer);
      });
      console.groupEnd();
    },
    map: store.questionMap,
  };

  // ---------------------------------------------------------------------------
  // Text normalization helpers
  // ---------------------------------------------------------------------------

  function textify(value) {
    if (value == null) return '';
    if (typeof value === 'string') {
      return value
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+\n/g, '\n')
        .replace(/\n\s+/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return value.map(textify).filter(Boolean).join('\n');
    if (typeof value === 'object') {
      for (const key of ['content', 'text', 'value', 'desc', 'description', 'title', 'stem', 'question']) {
        if (value[key] != null) {
          const text = textify(value[key]);
          if (text) return text;
        }
      }
    }
    return '';
  }

  function getFirst(obj, keys) {
    if (!obj || typeof obj !== 'object') return null;
    for (const key of keys) {
      const value = obj[key];
      if (value != null && value !== '' && !(Array.isArray(value) && value.length === 0)) return value;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Question node detection — slightly relaxed from v0.6
  // ---------------------------------------------------------------------------

  function looksLikeQuestionNode(node) {
    if (!node || typeof node !== 'object') return false;
    const maybeKey = getFirst(node, ['key', 'questionKey', 'questionId', 'quizId', 'id']);
    if (maybeKey == null) return false;
    // Accept numeric IDs too (not just string keys matching KEY_RE)
    const hasKey = typeof maybeKey === 'string' ? KEY_RE.test(maybeKey) : (typeof maybeKey === 'number' && maybeKey > 0);
    if (!hasKey) return false;

    const question = getFirst(node, ['stem', 'question', 'questionStem', 'content', 'material', 'title']);
    const answer = getFirst(node, ['answer', 'answers', 'correctAnswer', 'rightAnswer', 'standardAnswer']);
    const options = getFirst(node, ['options', 'optionList', 'choices']);
    return !!textify(question) || !!textify(answer) || Array.isArray(options);
  }

  function normalizeOptions(raw) {
    if (!Array.isArray(raw)) return textify(raw);
    const parts = [];
    for (let i = 0; i < raw.length; i += 1) {
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
    if (typeof raw === 'string') return raw.replace(/\s+/g, '');
    if (Array.isArray(raw)) return raw.map(textify).filter(Boolean).join(',');
    if (typeof raw === 'object') {
      const value = getFirst(raw, ['choice', 'choices', 'answer', 'value']);
      const text = textify(value);
      if (text) return text.replace(/\s+/g, '');
    }
    return textify(raw).replace(/\s+/g, '');
  }

  // ---------------------------------------------------------------------------
  // Walk + ingest — now accepts ALL JSON (URL filter removed)
  // The looksLikeQuestionNode check is the real gate
  // ---------------------------------------------------------------------------

  function walk(node, visit) {
    if (node == null) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, visit);
      return;
    }
    if (typeof node === 'object') {
      visit(node);
      for (const value of Object.values(node)) walk(value, visit);
    }
  }

  function ingest(payload, sourceUrl) {
    const root = payload && typeof payload === 'object' && 'data' in payload ? payload.data : payload;
    let matchedCount = 0;

    walk(root, (node) => {
      if (!looksLikeQuestionNode(node)) return;

      const rawKey = getFirst(node, ['key', 'questionKey', 'questionId', 'quizId', 'id']);
      const qKey = String(rawKey);
      if (!qKey) return;

      const normalized = {
        key: qKey,
        question: textify(getFirst(node, ['stem', 'question', 'questionStem', 'content', 'material', 'title'])),
        options: normalizeOptions(getFirst(node, ['options', 'optionList', 'choices'])),
        answer: normalizeAnswer(getFirst(node, ['answer', 'answers', 'correctAnswer', 'rightAnswer', 'standardAnswer'])),
        raw: node,
        sourceUrl,
      };

      const old = store.questionMap.get(qKey) || {};
      store.questionMap.set(qKey, {
        ...old,
        ...normalized,
        question: normalized.question || old.question || '',
        options: normalized.options || old.options || '',
        answer: normalized.answer || old.answer || '',
      });
      matchedCount += 1;
    });

    if (matchedCount) {
      console.log('[FenbiExport] captured nodes:', matchedCount, '| total cached:', store.questionMap.size);
      updateButtonLabel();
    }
  }

  // ---------------------------------------------------------------------------
  // Network hooks — capture ALL JSON responses (no URL allowlist)
  // ---------------------------------------------------------------------------

  function hookFetch() {
    const rawFetch = window.fetch;
    if (typeof rawFetch !== 'function') return;
    window.fetch = async function (...args) {
      const res = await rawFetch.apply(this, args);
      try {
        const clone = res.clone();
        const contentType = clone.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const url = (args[0] && args[0].url) || String(args[0] || '');
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
      this.__fbUrl = url;
      return open.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      this.addEventListener('load', function () {
        try {
          const contentType = this.getResponseHeader('content-type') || '';
          if (contentType.includes('application/json') && this.responseText) {
            const url = String(this.__fbUrl || '');
            ingest(JSON.parse(this.responseText), url);
          }
        } catch (_) {}
      });
      return send.apply(this, args);
    };
  }

  // ---------------------------------------------------------------------------
  // Current key detection — URL-first, then most recent cached
  // ---------------------------------------------------------------------------

  function getCurrentKey() {
    // 1. Try URL: /solution/3_1_bb254 pattern
    const routeMatch = location.href.match(/[/#](\d+_\d+_[a-z0-9]+)/i);
    if (routeMatch && store.questionMap.has(routeMatch[1])) {
      return routeMatch[1];
    }

    // 2. Try URL params: ?questionId=xxx or ?id=xxx
    try {
      const params = new URLSearchParams(location.search);
      for (const key of ['questionId', 'id', 'questionKey', 'key']) {
        const val = params.get(key);
        if (val && store.questionMap.has(val)) return val;
      }
    } catch (_) {}

    // 3. If URL-tracked key is set and still valid, prefer it
    if (store.urlTrackedKey && store.questionMap.has(store.urlTrackedKey)) {
      return store.urlTrackedKey;
    }

    // 4. If exactly one question cached, use it
    const keys = Array.from(store.questionMap.keys());
    if (keys.length === 1) return keys[0];

    // 5. Multiple: return the most recently added (last key in insertion order)
    return keys.length > 0 ? keys[keys.length - 1] : null;
  }

  // ---------------------------------------------------------------------------
  // DOM helpers — duration, my answer
  // ---------------------------------------------------------------------------

  function parseDurationSeconds() {
    const text = document.body ? document.body.innerText : '';
    const minSecMatch = text.match(/答题用时\s*(\d+)\s*分\s*(\d+)\s*秒/);
    if (minSecMatch) return Number(minSecMatch[1]) * 60 + Number(minSecMatch[2]);
    const secMatch = text.match(/答题用时\s*(\d+)\s*秒/);
    if (secMatch) return Number(secMatch[1]);
    const minOnlyMatch = text.match(/答题用时\s*(\d+)\s*分/);
    if (minOnlyMatch) return Number(minOnlyMatch[1]) * 60;
    return 0;
  }

  function parseMyAnswer() {
    const bodyText = document.body ? document.body.innerText : '';
    // Explicit label
    const explicit = bodyText.match(/我的答案[:：]?\s*([A-D多个正确错误]+)/);
    if (explicit) return explicit[1].replace(/\s/g, '');

    // Scan option elements for selected state
    const optionNodes = Array.from(document.querySelectorAll('div, li, label, span, p')).filter((el) => {
      const text = (el.textContent || '').trim();
      return /^[A-D][.、\s]/.test(text) || /^正确$/.test(text) || /^错误$/.test(text);
    });

    const selected = [];
    for (const el of optionNodes) {
      const text = (el.textContent || '').trim();
      const cls = String(el.className || '');
      const isSelected =
        /selected|active|checked|choose|user-answer|my-answer|wrong|error|right|correct/i.test(cls) ||
        el.getAttribute('aria-checked') === 'true' ||
        el.getAttribute('aria-selected') === 'true';
      if (isSelected) {
        const match = text.match(/^([A-D])/);
        if (match) selected.push(match[1]);
        else if (text === '正确' || text === '错误') selected.push(text);
      }
    }
    return selected.join('');
  }

  // ---------------------------------------------------------------------------
  // Image helpers
  // ---------------------------------------------------------------------------

  function getQuestionImages() {
    return Array.from(document.querySelectorAll('img')).filter((img) => {
      if (!(img instanceof HTMLImageElement)) return false;
      const src = img.currentSrc || img.src || '';
      if (!src) return false;
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
      // Skip oversized images — record URL only
      if (blob.size > 300 * 1024) {
        console.warn('[FenbiExport] image too large, recording URL only:', src);
        return src;
      }
      return await blobToDataUrl(blob);
    } catch (error) {
      console.warn('[FenbiExport] image fetch failed:', error);
      return '';
    }
  }

  async function collectImageData() {
    const images = getQuestionImages();
    if (!images.length) return [];
    const data = [];
    for (const img of images) {
      const item = await imageToDataUrl(img);
      if (item) data.push(item);
    }
    return data;
  }

  // ---------------------------------------------------------------------------
  // Export record builder
  // ---------------------------------------------------------------------------

  function buildExportRecord(question, imageDataList) {
    return {
      fenbiKey: question.key,          // question key from API (e.g. "3_1_bb254")
      question: question.question || '',
      options: question.options || '',
      myAnswer: parseMyAnswer(),
      answer: normalizeAnswer(question.answer),
      actualDurationSec: parseDurationSeconds(),
      sourceUrl: question.sourceUrl || '',
      imgData: imageDataList.length === 1 ? imageDataList[0] : imageDataList,
    };
  }

  // ---------------------------------------------------------------------------
  // Download + clipboard
  // ---------------------------------------------------------------------------

  function downloadJson(name, data) {
    const jsonText = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1500);
  }

  async function copyText(text) {
    try {
      if (typeof GM_setClipboard === 'function') {
        GM_setClipboard(text, 'text');
        return;
      }
    } catch (_) {}
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch (_) {}
  }

  // ---------------------------------------------------------------------------
  // Main export action — with visible button feedback
  // ---------------------------------------------------------------------------

  async function exportCurrent() {
    const now = Date.now();
    if (now - store.lastExportAt < 800) return;
    store.lastExportAt = now;

    const btn = document.getElementById(BUTTON_ID);
    const setStatus = (text, color) => {
      if (!btn) return;
      btn.textContent = text;
      btn.style.borderColor = color;
      btn.style.color = color;
    };

    const key = getCurrentKey();
    if (!key) {
      console.warn('[FenbiExport] no question key found. Cache size:', store.questionMap.size);
      setStatus('未抓到题', '#f5222d');
      setTimeout(() => updateButtonLabel(), 2500);
      return;
    }

    const question = store.questionMap.get(key);
    if (!question) {
      console.warn('[FenbiExport] key found but no data:', key);
      setStatus('数据缺失', '#f5222d');
      setTimeout(() => updateButtonLabel(), 2500);
      return;
    }

    setStatus('导出中…', '#fa8c16');

    try {
      const imageDataList = await collectImageData();
      const data = [buildExportRecord(question, imageDataList)];
      const fileName = `fenbi_${key}.json`;
      const jsonText = JSON.stringify(data, null, 2);
      await copyText(jsonText);
      downloadJson(fileName, data);
      console.log('[FenbiExport] exported:', fileName, data);
      setStatus('✓ 已导出', '#52c41a');
      setTimeout(() => updateButtonLabel(), 2000);
    } catch (err) {
      console.error('[FenbiExport] export failed:', err);
      setStatus('导出失败', '#f5222d');
      setTimeout(() => updateButtonLabel(), 2500);
    }
  }

  // ---------------------------------------------------------------------------
  // Button — shows cached count in label
  // ---------------------------------------------------------------------------

  function updateButtonLabel() {
    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;
    const n = store.questionMap.size;
    btn.textContent = n > 0 ? `导出JSON (${n})` : '导出JSON';
    btn.style.borderColor = '#1677ff';
    btn.style.color = '#1677ff';
  }

  let _btnDebounceTimer = 0;

  function ensureFixedButton() {
    if (!document.body) return;
    let btn = document.getElementById(BUTTON_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = BUTTON_ID;
      btn.type = 'button';
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        exportCurrent().catch((error) => {
          console.error('[FenbiExport] export error:', error);
        });
      });
      document.body.appendChild(btn);
      console.log('[FenbiExport] button mounted');
    }

    Object.assign(btn.style, {
      position: 'fixed',
      right: '20px',
      bottom: '24px',
      zIndex: '2147483647',
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      pointerEvents: 'auto',
      padding: '12px 16px',
      border: '2px solid #1677ff',
      borderRadius: '999px',
      background: '#ffffff',
      color: '#1677ff',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '700',
      lineHeight: '20px',
      boxShadow: '0 6px 18px rgba(22,119,255,0.28)',
    });

    updateButtonLabel();
  }

  // Debounced wrapper — MutationObserver fires very frequently; avoid thrashing
  function debouncedEnsureButton() {
    clearTimeout(_btnDebounceTimer);
    _btnDebounceTimer = setTimeout(ensureFixedButton, 200);
  }

  // ---------------------------------------------------------------------------
  // Button keepalive — DOM ready + MutationObserver + periodic check
  // ---------------------------------------------------------------------------

  function startButtonKeeper() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureFixedButton, { once: true });
    } else {
      ensureFixedButton();
    }

    const observer = new MutationObserver(debouncedEnsureButton);
    const startObserve = () => {
      if (!document.body) return;
      observer.observe(document.body, { childList: true, subtree: true });
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
  // SPA navigation — update urlTrackedKey when route changes
  // ---------------------------------------------------------------------------

  function onRouteChange() {
    setTimeout(() => {
      // Try to extract key from new URL
      const m = location.href.match(/[/#](\d+_\d+_[a-z0-9]+)/i);
      if (m) store.urlTrackedKey = m[1];
      ensureFixedButton();
    }, 300);
  }

  function hookSpaNavigation() {
    const wrap = (name) => {
      const raw = history[name];
      if (typeof raw !== 'function') return;
      history[name] = function (...args) {
        const ret = raw.apply(this, args);
        onRouteChange();
        return ret;
      };
    };
    wrap('pushState');
    wrap('replaceState');
    window.addEventListener('popstate', onRouteChange);
  }

  // ---------------------------------------------------------------------------
  // Keyboard shortcut: Alt+E to export, Alt+D to dump debug info
  // ---------------------------------------------------------------------------

  window.addEventListener('keydown', (event) => {
    if (!event.altKey) return;
    if (event.key.toLowerCase() === 'e') {
      exportCurrent().catch((error) => {
        console.error('[FenbiExport] export failed:', error);
      });
    }
    if (event.key.toLowerCase() === 'd') {
      window.__fb.dump();
    }
  });

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  hookFetch();
  hookXHR();
  startButtonKeeper();
  hookSpaNavigation();
})();
