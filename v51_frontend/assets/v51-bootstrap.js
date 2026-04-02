async function loadText(url) {
  const res = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.text();
}

async function injectPartials() {
  const manifest = await (await fetch('/v51-static/partials-manifest.json', { cache: 'no-store', credentials: 'same-origin' })).json();
  const htmlParts = await Promise.all(manifest.map(name => loadText(`/v51-static/partials/${name}`)));
  const mount = document.createElement('div');
  mount.id = 'v51ShellMount';
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

(async () => {
  try {
    await injectPartials();
    await loadScript('/assets/modules/mathjax-config.js');
    await loadScript('/assets/vendor/mathjax/tex-svg.js', { defer: true });
    await loadScript('/assets/modules/legacy-app.bundle.js');
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `
      <div class="v51-boot v51-boot-error">
        <div class="v51-boot-card">
          <div class="v51-boot-title">Ashore 5.1 加载失败</div>
          <div class="v51-boot-sub">${String(error.message || error)}</div>
          <button class="v51-retry" onclick="location.reload()">重新加载</button>
        </div>
      </div>`;
  }
})();
