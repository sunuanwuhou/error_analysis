// ============================================================
// Image value and editor preview helpers
// ============================================================
function setEditImgPreview(b64) {
  editImgBase64 = b64;
  document.getElementById('imgPreview').src = b64;
  document.getElementById('imgFormGroup').style.display = 'block';
  const currentBtn = document.getElementById('ocrCurrentImgBtn');
  if (currentBtn) currentBtn.style.display = '';
}

function clearEditImg(isUserAction) {
  editImgBase64 = null;
  if(isUserAction) editImgDeleted = true;
  document.getElementById('imgFormGroup').style.display = 'none';
  document.getElementById('imgPreview').src = '';
  const currentBtn = document.getElementById('ocrCurrentImgBtn');
  if (currentBtn) currentBtn.style.display = 'none';
}

function readFileAsBase64(file) {
  return new Promise(res=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.readAsDataURL(file);});
}

function isRemoteImageRef(value) {
  return typeof value === 'string' && value.startsWith('/api/images/');
}

function dataUrlToBytes(dataUrl) {
  const parts = String(dataUrl || '').split(',');
  if (parts.length < 2) throw new Error('invalid data url');
  const mimeMatch = parts[0].match(/^data:([^;]+);base64$/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { mime, bytes };
}

async function uploadImageValue(value) {
  if (!value || !String(value).startsWith('data:')) return value;
  try {
    const { mime, bytes } = dataUrlToBytes(value);
    const res = await fetch('/api/images', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': mime },
      body: bytes
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.error || 'image upload failed');
    return data.url || value;
  } catch (e) {
    console.warn('[uploadImageValue] fallback to inline image', e);
    return value;
  }
}

async function imageValueToBytes(value) {
  if (!value) throw new Error('image is empty');
  if (String(value).startsWith('data:')) {
    const { mime, bytes } = dataUrlToBytes(value);
    return { mime, bytes };
  }
  if (isRemoteImageRef(value)) {
    const res = await fetch(value, { credentials: 'include' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || data.error || 'image fetch failed');
    }
    const mime = res.headers.get('content-type') || 'image/jpeg';
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { mime, bytes };
  }
  throw new Error('unsupported image reference');
}
