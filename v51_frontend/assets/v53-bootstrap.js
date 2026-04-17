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
  await loadLegacyManifest();
  const html = await loadText(withVersion('/v51-static/partials.bundle.html'));
  const mount = document.createElement('div');
  mount.id = 'v53ShellMount';
  mount.innerHTML = html;
  const nextChildren = Array.from(mount.childNodes);
  document.body.replaceChildren(...nextChildren);
}

async function ensureDeferredPartialsLoaded() {
  if (deferredPartialsPromise) return deferredPartialsPromise;
  deferredPartialsPromise = (async () => {
    await loadLegacyManifest();
    const html = await loadText(withVersion('/v51-static/deferred-partials.bundle.html'));
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
  return normalized.startsWith('xingce_v3/') ? normalized.slice('xingce_v3/'.length) : normalized;
}

function withVersion(url, explicitVersion) {
  const version = String(explicitVersion || legacyAssetVersion || '').trim();
  if (!version) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
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

(async () => {
  try {
    await loadScript(withVersion('/v51-static/assets/module-registry.js'));
    const registry = window.V53ModuleRegistry || {};
    (registry.deferredActions || []).forEach(installDeferredAction);
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
