// ============================================================
// Portable backup payload helpers
// ============================================================
function isPortableImageApiRef(value) {
  return typeof value === 'string' && /^\/api\/images\/[a-f0-9]{32,64}$/i.test(value.trim());
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('read blob failed'));
    reader.readAsDataURL(blob);
  });
}

const portableImageCache = new Map();

async function materializePortableImageValue(value) {
  if (!value || typeof value !== 'string') return value || '';
  const trimmed = value.trim();
  if (!isPortableImageApiRef(trimmed)) return trimmed;
  if (portableImageCache.has(trimmed)) return portableImageCache.get(trimmed);
  try {
    const res = await fetch(trimmed, { credentials: 'include' });
    if (!res.ok) throw new Error(`image fetch failed: ${res.status}`);
    const dataUrl = await blobToDataUrl(await res.blob());
    const portable = dataUrl || trimmed;
    portableImageCache.set(trimmed, portable);
    return portable;
  } catch (err) {
    console.warn('[materializePortableImageValue] fallback to original ref', trimmed, err);
    return trimmed;
  }
}

async function buildPortableErrorExport(errorLike) {
  const item = cloneJson(errorLike || {});
  item.imgData = await materializePortableImageValue(item.imgData || '');
  item.analysisImgData = await materializePortableImageValue(item.analysisImgData || '');
  if (item && item.noteNodeId && typeof getKnowledgePathTitles === 'function' && typeof collapseKnowledgePathTitles === 'function') {
    const titles = collapseKnowledgePathTitles(getKnowledgePathTitles(item.noteNodeId));
    if (titles && titles.length) {
      item.knowledgePathTitles = titles.slice();
      item.knowledgePath = titles.join(' > ');
      item.knowledgeNodePath = titles.join(' > ');
      item.notePath = titles.join(' > ');
    }
  }
  return item;
}

async function buildPortableBackupPayload(payload) {
  if (Array.isArray(payload)) {
    return Promise.all((payload || []).map(buildPortableErrorExport));
  }
  const backup = cloneJson(payload || {});
  backup.errors = await Promise.all(((backup.errors || [])).map(buildPortableErrorExport));
  return backup;
}

window.buildPortableBackupPayload = buildPortableBackupPayload;
