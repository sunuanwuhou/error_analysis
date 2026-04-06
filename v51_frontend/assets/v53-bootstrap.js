async function loadText(url) {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.text();
}

let legacyAssetVersion = '';
let legacyManifestPromise = null;

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
  document.body.innerHTML = '';
  while (mount.firstChild) {
    document.body.appendChild(mount.firstChild);
  }
}

const deferredActionCalls = [];

function installDeferredAction(name) {
  if (typeof window[name] === 'function') return;
  window[name] = function deferredBootstrapAction() {
    deferredActionCalls.push({ name, args: Array.from(arguments) });
  };
}

function flushDeferredActions() {
  const queued = deferredActionCalls.splice(0, deferredActionCalls.length);
  queued.forEach(item => {
    const fn = window[item.name];
    if (typeof fn === 'function' && fn !== window.__deferredNoop) {
      try { fn.apply(window, item.args || []); } catch (error) { console.warn(`deferred action failed: ${item.name}`, error); }
    }
  });
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

(async () => {
  try {
    [
      'switchAppView',
      'openWorkspaceView',
      'openWorkspaceTaskView',
      'openWorkspaceQuickAdd',
      'switchTab',
      'openQuickAddModal',
      'startQuiz',
      'startFullPractice'
    ].forEach(installDeferredAction);
    await injectPartials();
    await loadScript(withVersion('/assets/modules/mathjax-config.js'));
    await loadScript(withVersion('/assets/vendor/mathjax/tex-svg.js'), { defer: true });
    await loadLegacyModules();
    await loadScript(withVersion('/v51-static/assets/v53-shell.js'));
    await loadScript(withVersion('/v51-static/assets/final-flow.js'));
    const pcCss = document.createElement('link');
    pcCss.rel = 'stylesheet';
    pcCss.href = withVersion('/v51-static/assets/process-canvas-ultimate.css');
    document.head.appendChild(pcCss);
    await loadScript(withVersion('/v51-static/assets/process-canvas-ultimate.js'));
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
