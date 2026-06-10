async function loadText(url) {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.text();
}

let legacyAssetVersion = '';
let legacyManifestPromise = null;
let deferredPartialsPromise = null;
let legacyModalBundlePromise = null;

async function loadLegacyManifest() {
  if (!legacyManifestPromise) {
    legacyManifestPromise = (async () => {
      const manifestRes = await fetch('/assets/legacy-app.bundle.manifest.json', { cache: 'no-store', credentials: 'same-origin' });
      if (!manifestRes.ok) throw new Error(`Failed to load legacy manifest: ${manifestRes.status}`);
      const manifest = await manifestRes.json();
      legacyAssetVersion = String(manifest?.built_at || manifest?.js_bundle?.sha256 || Date.now());
      return manifest;
    })();
  }
  return legacyManifestPromise;
}

async function injectPartials() {
  const manifest = await loadLegacyManifest();
  const partialsVersion = String(
    manifest?.v51_partials?.core?.sha256
    || manifest?.v51_partials?.deferred?.sha256
    || legacyAssetVersion
    || manifest?.built_at
    || Date.now()
  );
  const html = await loadText(withVersion('/v51-static/partials.bundle.html', partialsVersion));
  const mount = document.createElement('div');
  mount.id = 'v53ShellMount';
  mount.innerHTML = html;
  const nextChildren = Array.from(mount.childNodes);
  document.body.replaceChildren(...nextChildren);
  ensureRandomNoteEntryPresence();
}

function ensureRandomNoteEntryPresence() {
  const quizBlock = document.querySelector('.quiz-block');
  if (quizBlock && !document.getElementById('randomNoteBtn')) {
    const fullPracticeBtn = document.getElementById('fullPracticeBtn');
    const randomBtn = document.createElement('button');
    randomBtn.className = 'quiz-btn';
    randomBtn.id = 'randomNoteBtn';
    randomBtn.style.marginTop = '6px';
    randomBtn.style.background = 'linear-gradient(135deg,#16a34a,#15803d)';
    randomBtn.setAttribute('data-onclick', 'startRandomNoteReview()');
    randomBtn.innerHTML = '<span>随机笔记</span>';
    if (fullPracticeBtn && fullPracticeBtn.parentNode === quizBlock) {
      fullPracticeBtn.insertAdjacentElement('afterend', randomBtn);
    } else {
      quizBlock.appendChild(randomBtn);
    }
  }
  const moreMenu = document.getElementById('moreMenuPanel');
  if (moreMenu && !moreMenu.querySelector('[data-onclick*="startRandomNoteReview"]')) {
    const importBtn = moreMenu.querySelector('[data-onclick*="openQuickImportModal"]');
    const moreRandomBtn = document.createElement('button');
    moreRandomBtn.className = 'btn btn-secondary';
    moreRandomBtn.setAttribute('data-onclick', 'closeMoreMenu();startRandomNoteReview()');
    moreRandomBtn.textContent = '随机笔记';
    if (importBtn && importBtn.nextSibling) {
      importBtn.insertAdjacentElement('afterend', moreRandomBtn);
    } else {
      moreMenu.appendChild(moreRandomBtn);
    }
  }
}

async function ensureDeferredPartialsLoaded() {
  if (deferredPartialsPromise) return deferredPartialsPromise;
  deferredPartialsPromise = (async () => {
    const manifest = await loadLegacyManifest();
    const partialsVersion = String(
      manifest?.v51_partials?.deferred?.sha256
      || manifest?.v51_partials?.core?.sha256
      || legacyAssetVersion
      || manifest?.built_at
      || Date.now()
    );
    const html = await loadText(withVersion('/v51-static/deferred-partials.bundle.html', partialsVersion));
    const mount = document.createElement('div');
    mount.innerHTML = html;
    while (mount.firstChild) {
      document.body.appendChild(mount.firstChild);
    }
  })().catch((error) => {
    deferredPartialsPromise = null;
    console.warn('deferred partial load failed', error);
  });
  return deferredPartialsPromise;
}
window.ensureDeferredPartialsLoaded = ensureDeferredPartialsLoaded;

function scheduleDeferredPartialsLoad() {
  const run = () => { ensureDeferredPartialsLoaded(); };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 1500 });
  } else {
    setTimeout(run, 350);
  }
  const eager = () => {
    ensureDeferredPartialsLoaded();
  };
  window.addEventListener('pointerdown', eager, { capture: true, once: true, passive: true });
  window.addEventListener('keydown', eager, { capture: true, once: true });
}

const deferredActionCalls = [];
const DEFERRED_MODAL_ACTIONS = new Set([
  'openQuickAddModal',
  'startQuiz',
  'startFullPractice',
]);

function installDeferredAction(name) {
  if (typeof window[name] === 'function' && !window[name].__isDeferredActionStub) return;
  const deferredStub = function deferredBootstrapAction() {
    if (DEFERRED_MODAL_ACTIONS.has(name)) {
      ensureLegacyModalBundleLoaded();
    }
    deferredActionCalls.push({ name, args: Array.from(arguments) });
  };
  deferredStub.__isDeferredActionStub = true;
  window[name] = deferredStub;
}

function flushDeferredActions() {
  if (!deferredActionCalls.length) return;
  const queued = deferredActionCalls.splice(0, deferredActionCalls.length);
  const pending = [];
  queued.forEach(item => {
    const fn = window[item.name];
    if (typeof fn === 'function' && !fn.__isDeferredActionStub && fn !== window.__deferredNoop) {
      try { fn.apply(window, item.args || []); } catch (error) { console.warn(`deferred action failed: ${item.name}`, error); }
    } else {
      pending.push(item);
    }
  });
  if (pending.length) {
    deferredActionCalls.unshift.apply(deferredActionCalls, pending);
  }
}

function loadScript(src, { defer = false } = {}) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    if (defer) script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

function toPublicAssetPath(rel) {
  const normalized = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.startsWith('legacy/xingce_v3/')) {
    return normalized.slice('legacy/xingce_v3/'.length);
  }
  if (normalized.startsWith('xingce_v3/')) {
    return normalized.slice('xingce_v3/'.length);
  }
  return normalized;
}

function withVersion(url, explicitVersion) {
  const version = String(explicitVersion || legacyAssetVersion || '').trim();
  if (!version) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
}

function legacySplitBundleScriptPresent(filenameFragment) {
  return Array.from(document.getElementsByTagName('script')).some((el) => {
    const src = el.getAttribute('src') || '';
    return src.includes(filenameFragment);
  });
}

async function loadLegacyModules() {
  const manifest = await loadLegacyManifest();
  const version = String(legacyAssetVersion || manifest?.built_at || manifest?.js_bundle?.sha256 || Date.now());
  const viewBundles = manifest?.js_view_bundles || {};
  const homeBundlePath = toPublicAssetPath(viewBundles?.home?.path || '');
  const workspaceBundlePath = toPublicAssetPath(viewBundles?.workspace?.path || '');
  const bootstrapBundlePath = toPublicAssetPath(viewBundles?.bootstrap?.path || '');
  if (homeBundlePath && workspaceBundlePath && bootstrapBundlePath) {
    await loadScript(withVersion(`/assets/${homeBundlePath}`, version));
    await loadScript(withVersion(`/assets/${workspaceBundlePath}`, version));
    await loadScript(withVersion(`/assets/${bootstrapBundlePath}`, version));
    scheduleDeferredLegacyModalLoad();
    // Workspace bundle is now fully executed; ensure workspace view is active.
    if (typeof window.switchAppView === 'function') window.switchAppView('workspace');
    return;
  }
  const bundlePath = toPublicAssetPath(manifest?.js_bundle?.path || '');
  if (bundlePath) {
    await loadScript(withVersion(`/assets/${bundlePath}`, version));
    return;
  }
  const sources = [...(manifest?.js_bundle?.sources || [])];
  const bootstrapRel = 'modules/main/99-bootstrap.js';
  const filtered = sources.filter((rel) => rel !== bootstrapRel);
  for (const rel of filtered) {
    await loadScript(withVersion(`/assets/${rel}`, version));
  }
  await loadScript(withVersion(`/assets/${bootstrapRel}`, version));
}

async function ensureLegacyModalBundleLoaded() {
  const manifest = await loadLegacyManifest();
  const version = String(legacyAssetVersion || manifest?.built_at || manifest?.js_bundle?.sha256 || Date.now());
  const modalBundlePath = toPublicAssetPath(manifest?.js_view_bundles?.modal?.path || '');
  if (!modalBundlePath) return;
  if (legacySplitBundleScriptPresent('legacy-app.modal.bundle.js')) {
    flushDeferredActions();
    return;
  }
  if (!legacyModalBundlePromise) {
    legacyModalBundlePromise = loadScript(withVersion(`/assets/${modalBundlePath}`, version)).then(() => {
      flushDeferredActions();
    }).catch((error) => {
      legacyModalBundlePromise = null;
      throw error;
    });
  }
  return legacyModalBundlePromise;
}

function scheduleDeferredLegacyModalLoad() {
  const run = () => {
    ensureLegacyModalBundleLoaded().catch((error) => {
      console.warn('legacy modal bundle load failed', error);
    });
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(run, { timeout: 2200 });
  } else {
    setTimeout(run, 650);
  }
}

async function loadV53FeatureModules() {
  const registry = window.V53ModuleRegistry || {};
  const modules = [
    ...(registry.shellModules || []),
    ...(registry.viewModules || []),
    ...(registry.rendererModules || []),
    ...(registry.featureModules || []),
  ];
  for (const src of modules) {
    await loadScript(withVersion(src));
  }
}

window.__v53EnsureLegacyModalBundleLoaded = ensureLegacyModalBundleLoaded;

/** 申论与套卷/模块练一致，走 `/new/...` Vue 子应用（与 `portalPrefs` 一致） */
const PORTAL_SHENLUN_TARGET = '/new/shenlun';
const PORTAL_XINGCE_SUITE_TARGET = '/new/xingce/suite';
const PORTAL_XINGCE_BANK_DRILL_TARGET = '/new/xingce/bank-drill';
const PORTAL_ADMIN_TARGET = '/new/admin';
/** 与 `frontend/src/lib/portalPrefs.ts` 保持一致 */
const PORTAL_LAST_MODULE_KEY = 'v53.portal.lastModule';

async function fetchPortalMe() {
  try {
    const res = await fetch('/api/me', { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.authenticated || !data.user) return null;
    return data.user;
  } catch (_) {
    return null;
  }
}

function portalUserHasModule(user, key) {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return Array.isArray(user.modules) && user.modules.includes(key);
}

function readLastPortalModule() {
  try {
    const v = localStorage.getItem(PORTAL_LAST_MODULE_KEY);
    if (v === 'xingce' || v === 'xingce_suite' || v === 'xingce_bank_drill' || v === 'shenlun') return v;
  } catch (_) { /* ignore */ }
  return null;
}

function saveLastPortalModule(choice) {
  try {
    localStorage.setItem(PORTAL_LAST_MODULE_KEY, choice);
  } catch (_) { /* ignore */ }
}

/** `/?portal=1`：始终展示模块选择页（与侧栏「模块首页」一致），避免无法切换模块 */
function shouldForcePortal() {
  try {
    const p = (new URLSearchParams(window.location.search || '').get('portal') || '').toLowerCase();
    if (p === '1' || p === 'true' || p === 'yes') return true;
  } catch (_) { /* ignore */ }
  return false;
}

function showXingceLoadingPlaceholder() {
  const bootRoot = document.getElementById('v53Boot');
  if (!bootRoot) return;
  bootRoot.innerHTML = `
    <div class="v53-boot-card">
      <div class="v53-boot-title">行测工作台</div>
      <div class="v53-boot-sub">正在加载工作台…</div>
    </div>`;
}

/**
 * 主入口 `/`：先展示模块门户，再加载行测壳；申论直接离开本页。
 */
function renderPortalButtons(user) {
  const parts = [];
  if (portalUserHasModule(user, 'xingce')) {
    parts.push('<button type="button" class="v53-portal-btn v53-portal-btn--xingce" data-portal-choice="xingce">行测</button>');
  }
  if (portalUserHasModule(user, 'xingce_suite')) {
    parts.push('<button type="button" class="v53-portal-btn v53-portal-btn--suite" data-portal-choice="xingce_suite">套卷练习</button>');
  }
  if (portalUserHasModule(user, 'xingce_bank_drill')) {
    parts.push('<button type="button" class="v53-portal-btn v53-portal-btn--bank-drill" data-portal-choice="xingce_bank_drill">套卷模块练</button>');
  }
  if (portalUserHasModule(user, 'shenlun')) {
    parts.push('<button type="button" class="v53-portal-btn v53-portal-btn--shenlun" data-portal-choice="shenlun">申论</button>');
  }
  if (user && user.is_super_admin) {
    parts.push('<button type="button" class="v53-portal-btn v53-portal-btn--admin" data-portal-choice="admin">系统管理</button>');
  }
  return parts.join('');
}

async function gateModulePortal() {
  const bootRoot = document.getElementById('v53Boot');
  if (!bootRoot) {
    return;
  }
  const me = await fetchPortalMe();
  if (!me) {
    window.location.replace('/login.html');
    return new Promise(() => {});
  }
  if (!shouldForcePortal()) {
    const last = readLastPortalModule();
    if (last && portalUserHasModule(me, last) && last === 'shenlun') {
      window.location.replace(PORTAL_SHENLUN_TARGET);
      return new Promise(() => {});
    }
    if (last && portalUserHasModule(me, last) && last === 'xingce_suite') {
      window.location.replace(PORTAL_XINGCE_SUITE_TARGET);
      return new Promise(() => {});
    }
    if (last && portalUserHasModule(me, last) && last === 'xingce_bank_drill') {
      window.location.replace(PORTAL_XINGCE_BANK_DRILL_TARGET);
      return new Promise(() => {});
    }
    if (last && portalUserHasModule(me, last) && last === 'xingce') {
      showXingceLoadingPlaceholder();
      return;
    }
  }
  bootRoot.innerHTML = `
    <div class="v53-boot-card v53-portal-card">
      <div class="v53-boot-title">Ashore</div>
      <div class="v53-boot-sub">请选择要进入的模块</div>
      <div class="v53-portal-actions">${renderPortalButtons(me)}</div>
      ${!me.is_super_admin && (!me.modules || !me.modules.length)
    ? '<p class="v53-portal-hint v53-portal-hint--warn">当前账号尚未分配模块权限，请联系管理员。</p>'
    : '<p class="v53-portal-hint">会记住你上次选择的模块；刷新后直接进入。需要手动切换时点侧栏「模块首页」。</p>'}
    </div>`;
  return new Promise((resolve) => {
    const onPick = (ev) => {
      const btn = ev.target && ev.target.closest && ev.target.closest('[data-portal-choice]');
      if (!btn) return;
      const choice = btn.getAttribute('data-portal-choice');
      if (choice === 'admin') {
        window.location.href = PORTAL_ADMIN_TARGET;
        return;
      }
      if (!portalUserHasModule(me, choice)) return;
      saveLastPortalModule(choice);
      if (choice === 'shenlun') {
        window.location.href = PORTAL_SHENLUN_TARGET;
        return;
      }
      if (choice === 'xingce_suite') {
        window.location.href = PORTAL_XINGCE_SUITE_TARGET;
        return;
      }
      if (choice === 'xingce_bank_drill') {
        window.location.href = PORTAL_XINGCE_BANK_DRILL_TARGET;
        return;
      }
      bootRoot.removeEventListener('click', onPick);
      showXingceLoadingPlaceholder();
      resolve();
    };
    bootRoot.addEventListener('click', onPick);
  });
}

(async () => {
  try {
    await loadScript(withVersion('/v51-static/assets/module-registry.js'));
    const registry = window.V53ModuleRegistry || {};
    (registry.deferredActions || []).forEach(installDeferredAction);
    await gateModulePortal();
    await injectPartials();
    scheduleDeferredPartialsLoad();
    await loadScript(withVersion((registry.bootScripts || [])[0] || '/assets/modules/mathjax-config.js'));
    await loadScript(withVersion((registry.bootScripts || [])[1] || '/assets/vendor/mathjax/tex-svg.js'), { defer: true });
    await loadLegacyModules();
    await loadV53FeatureModules();
    await loadScript(withVersion((registry.appEntryModules || [])[0] || '/v51-static/assets/v53-shell.js'));
    await loadScript(withVersion((registry.appEntryModules || [])[1] || '/v51-static/assets/final-flow.js'));
    const pcCss = document.createElement('link');
    pcCss.rel = 'stylesheet';
    pcCss.href = withVersion('/v51-static/assets/process-canvas-ultimate.css');
    document.head.appendChild(pcCss);
    await loadScript(withVersion((registry.appEntryModules || [])[2] || '/v51-static/assets/process-canvas-ultimate.js'));
    flushDeferredActions();
    document.body.classList.remove('v51-shell-loading');
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `
      <div class="v53-boot v53-boot-error">
        <div class="v53-boot-card">
          <div class="v53-boot-title">Ashore 5.3 加载失败</div>
          <div class="v53-boot-sub">${String(error.message || error)}</div>
          <button class="v53-retry" onclick="location.reload()">重新加载</button>
        </div>
      </div>`;
  }
})();
