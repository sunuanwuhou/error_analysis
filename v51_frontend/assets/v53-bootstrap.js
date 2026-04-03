async function loadText(url) {
  const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.text();
}

async function injectPartials() {
  const manifest = await (await fetch('/v51-static/partials-manifest.json', { cache: 'no-store', credentials: 'same-origin' })).json();
  const htmlParts = await Promise.all(manifest.map(name => loadText(`/v51-static/partials/${name}`)));
  const mount = document.createElement('div');
  mount.id = 'v53ShellMount';
  mount.innerHTML = htmlParts.join('\n');
  document.body.innerHTML = '';
  while (mount.firstChild) {
    document.body.appendChild(mount.firstChild);
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

async function loadLegacyModules() {
  const manifestRes = await fetch('/assets/legacy-app.bundle.manifest.json', { cache: 'no-store', credentials: 'same-origin' });
  if (!manifestRes.ok) throw new Error(`Failed to load legacy manifest: ${manifestRes.status}`);
  const manifest = await manifestRes.json();
  const sources = [...(manifest?.js_bundle?.sources || [])];
  const bootstrapRel = 'modules/main/99-bootstrap.js';
  const filtered = sources.filter((rel) => rel !== bootstrapRel);
  for (const rel of filtered) {
    await loadScript(`/assets/${rel}`);
  }
  await loadScript(`/assets/${bootstrapRel}`);
}

(async () => {
  try {
    await injectPartials();
    await loadScript('/assets/modules/mathjax-config.js');
    await loadScript('/assets/vendor/mathjax/tex-svg.js', { defer: true });
    await loadLegacyModules();
    await loadScript('/v51-static/assets/v53-shell.js');
    await loadScript('/v51-static/assets/final-flow.js');
    const pcCss = document.createElement('link');
    pcCss.rel = 'stylesheet';
    pcCss.href = '/v51-static/assets/process-canvas-ultimate.css';
    document.head.appendChild(pcCss);
    await loadScript('/v51-static/assets/process-canvas-ultimate.js');
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
