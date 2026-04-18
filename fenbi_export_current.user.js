// ==UserScript==
// @name         Fenbi Export Current Question (Simple)
// @namespace    xingce-local
// @version      0.6.0
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
    mountTimer: 0,
  };

  const KEY_RE = /^\d+_\d+_[a-z0-9]+$/i;
  const BUTTON_ID = 'fenbi-export-fixed-btn';

  console.log('[FenbiExport] userscript started:', location.href);

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

  function looksLikeQuestionNode(node) {
    if (!node || typeof node !== 'object') return false;
    const maybeKey = getFirst(node, ['key', 'questionKey', 'questionId', 'quizId', 'id']);
    const hasKey = typeof maybeKey === 'string' ? KEY_RE.test(maybeKey) : !!maybeKey;
    const question = getFirst(node, ['stem', 'question', 'questionStem', 'content', 'material', 'title']);
    const answer = getFirst(node, ['answer', 'answers', 'correctAnswer', 'rightAnswer', 'standardAnswer']);
    const options = getFirst(node, ['options', 'optionList', 'choices']);
    return hasKey && (!!textify(question) || !!textify(answer) || Array.isArray(options));
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

      const qKey = textify(getFirst(node, ['key', 'questionKey', 'questionId', 'quizId', 'id']));
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
      console.log('[FenbiExport] captured nodes:', matchedCount, 'cached:', store.questionMap.size);
    }
  }

  function shouldTrackUrl(url) {
    return /\/(tiku|combine|question|exercise|solution)\//.test(url);
  }

  function hookFetch() {
    const rawFetch = window.fetch;
    if (typeof rawFetch !== 'function') return;
    window.fetch = async function (...args) {
      const res = await rawFetch.apply(this, args);
      try {
        const url = (args[0] && args[0].url) || String(args[0] || '');
        if (!shouldTrackUrl(url)) return res;
        const clone = res.clone();
        const contentType = clone.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
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
          const url = String(this.__fbUrl || '');
          if (!shouldTrackUrl(url)) return;
          const contentType = this.getResponseHeader('content-type') || '';
          if (contentType.includes('application/json') && this.responseText) {
            ingest(JSON.parse(this.responseText), url);
          }
        } catch (_) {}
      });
      return send.apply(this, args);
    };
  }

  function getCurrentKey() {
    const routeMatch = location.href.match(/solution\/(\d+_\d+_[a-z0-9]+)/i);
    if (routeMatch && store.questionMap.has(routeMatch[1])) return routeMatch[1];

    const bodyText = document.body ? document.body.innerText : '';
    const textMatch = bodyText.match(/\b\d+_\d+_[a-z0-9]+\b/i);
    if (textMatch && store.questionMap.has(textMatch[0])) return textMatch[0];

    const keys = Array.from(store.questionMap.keys());
    return keys.length === 1 ? keys[0] : keys[0] || null;
  }

  function parseDurationSeconds() {
    const text = document.body ? document.body.innerText : '';
    const minSecMatch = text.match(/答题用时\s*(\d+)\s*分\s*(\d+)\s*秒/);
    if (minSecMatch) return Number(minSecMatch[1]) * 60 + Number(minSecMatch[2]);
    const secMatch = text.match(/答题用时\s*(\d+)\s*秒/);
    if (secMatch) return Number(secMatch[1]);
    return 0;
  }

  function parseMyAnswer() {
    const bodyText = document.body ? document.body.innerText : '';
    const explicit = bodyText.match(/我的答案[:：]?\s*([A-D]|正确|错误)/);
    if (explicit) return explicit[1];

    const optionNodes = Array.from(document.querySelectorAll('div, li, label, span, p')).filter((el) => {
      const text = (el.textContent || '').trim();
      return /^[A-D][.、\s]/.test(text) || /^正确$/.test(text) || /^错误$/.test(text);
    });

    for (const el of optionNodes) {
      const text = (el.textContent || '').trim();
      const cls = String(el.className || '');
      const selected = /selected|active|checked|choose|user-answer|my-answer|wrong|error|right|correct/i.test(cls);
      const aria = `${el.getAttribute('aria-checked') || ''}${el.getAttribute('aria-selected') || ''}`;
      if (selected || /true/i.test(aria)) {
        const match = text.match(/^([A-D])/);
        if (match) return match[1];
        if (text === '正确' || text === '错误') return text;
      }
    }

    return '';
  }

  function getQuestionImages() {
    const containers = Array.from(document.querySelectorAll('img')).filter((img) => {
      if (!(img instanceof HTMLImageElement)) return false;
      const src = img.currentSrc || img.src || '';
      if (!src) return false;
      const rect = img.getBoundingClientRect();
      if (rect.width < 30 || rect.height < 30) return false;
      if (/avatar|logo|icon|thumb|badge/i.test(src)) return false;
      return true;
    });

    return containers;
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

  function buildExportRecord(question, imageDataList) {
    return {
      question: question.question || '',
      options: question.options || '',
      myAnswer: parseMyAnswer(),
      answer: normalizeAnswer(question.answer),
      actualDurationSec: parseDurationSeconds(),
      imgData: imageDataList.length === 1 ? imageDataList[0] : imageDataList,
    };
  }

  function downloadJson(name, data) {
    const jsonText = JSON.stringify(data, null, 2);
    JSON.parse(jsonText);
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

  async function exportCurrent() {
    const now = Date.now();
    if (now - store.lastExportAt < 800) return;
    store.lastExportAt = now;

    const key = getCurrentKey();
    if (!key) {
      console.warn('[FenbiExport] current question key not found');
      return;
    }

    const question = store.questionMap.get(key);
    if (!question) {
      console.warn('[FenbiExport] current question data not ready:', key);
      return;
    }

    const imageDataList = await collectImageData();
    const data = [buildExportRecord(question, imageDataList)];
    const fileName = `fenbi_${key}.json`;
    const jsonText = JSON.stringify(data, null, 2);
    await copyText(jsonText);
    downloadJson(fileName, data);
    console.log('[FenbiExport] exported:', fileName, data);
  }

  function ensureFixedButton() {
    if (!document.body) return;
    let btn = document.getElementById(BUTTON_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = BUTTON_ID;
      btn.type = 'button';
      btn.textContent = '导出JSON';
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        exportCurrent().catch((error) => {
          console.error('[FenbiExport] export failed:', error);
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
  }

  function startButtonKeeper() {
    const mount = () => {
      ensureFixedButton();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount, { once: true });
    } else {
      mount();
    }

    const observer = new MutationObserver(() => {
      ensureFixedButton();
    });

    const startObserve = () => {
      if (!document.body) return;
      observer.observe(document.body, { childList: true, subtree: true });
      ensureFixedButton();
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startObserve, { once: true });
    } else {
      startObserve();
    }

    if (store.mountTimer) {
      clearInterval(store.mountTimer);
    }
    store.mountTimer = window.setInterval(() => {
      ensureFixedButton();
    }, 1500);
  }

  function hookSpaNavigation() {
    const remount = () => setTimeout(ensureFixedButton, 300);
    const wrap = (name) => {
      const raw = history[name];
      if (typeof raw !== 'function') return;
      history[name] = function (...args) {
        const ret = raw.apply(this, args);
        remount();
        return ret;
      };
    };
    wrap('pushState');
    wrap('replaceState');
    window.addEventListener('popstate', remount);
  }

  window.addEventListener('keydown', (event) => {
    if (event.altKey && event.key.toLowerCase() === 'e') {
      exportCurrent().catch((error) => {
        console.error('[FenbiExport] export failed:', error);
      });
    }
  });

  hookFetch();
  hookXHR();
  startButtonKeeper();
  hookSpaNavigation();
})();
