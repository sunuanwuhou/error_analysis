// ============================================================
// Global search modal and filter helpers
// ============================================================
function ensureGlobalSearchModal() {
  let mask = document.getElementById('globalSearchModal');
  if (mask) return mask;
  mask = document.createElement('div');
  mask.id = 'globalSearchModal';
  mask.className = 'modal-mask global-search-modal-mask';
  mask.innerHTML = '' +
    '<div class="global-search-modal" role="dialog" aria-modal="true" aria-label="global search">' +
      '<button class="global-search-modal-close" type="button" aria-label="Close">&times;</button>' +
      '<iframe id="globalSearchFrame" class="global-search-modal-frame" title="global search"></iframe>' +
    '</div>';
  mask.addEventListener('click', function(event) {
    if (event.target === mask) closeGlobalSearchModal(true);
  });
  mask.querySelector('.global-search-modal-close').addEventListener('click', function() {
    closeGlobalSearchModal(true);
  });
  document.body.appendChild(mask);
  return mask;
}

function openGlobalSearchModal(initialQuery) {
  const mask = ensureGlobalSearchModal();
  const frame = document.getElementById('globalSearchFrame');
  const nextQuery = typeof initialQuery === 'string' ? initialQuery : (searchKw || '');
  frame.src = `/assets/global_search.html?embed=1&q=${encodeURIComponent(nextQuery)}`;
  mask.classList.add('open');
  document.body.classList.add('global-search-modal-open');
}

function closeGlobalSearchModal(force) {
  const mask = document.getElementById('globalSearchModal');
  if (!mask) return;
  mask.classList.remove('open');
  document.body.classList.remove('global-search-modal-open');
  if (force) {
    const frame = document.getElementById('globalSearchFrame');
    if (frame) frame.src = 'about:blank';
  }
}

function setEditAnalysisImgPreview(b64) {
  editAnalysisImgBase64 = b64;
  document.getElementById('analysisImgPreview').src = b64;
  document.getElementById('analysisImgFormGroup').style.display = 'block';
}

function clearEditAnalysisImg(isUserAction) {
  editAnalysisImgBase64 = null;
  if(isUserAction) editAnalysisImgDeleted = true;
  document.getElementById('analysisImgFormGroup').style.display = 'none';
  document.getElementById('analysisImgPreview').src = '';
}

function updateSearchClear() {
  const v = document.getElementById('searchInput').value;
  document.getElementById('searchClear').style.display = v ? 'block' : 'none';
}

function clearSearchInput() {
  document.getElementById('searchInput').value = '';
  updateSearchClear();
  searchKw = '';
  renderAll();
}

function applyDateFilter() {
  dateFrom = document.getElementById('dateFrom').value;
  dateTo   = document.getElementById('dateTo').value;
  renderAll();
}

function clearDateFilter() {
  dateFrom = ''; dateTo = '';
  document.getElementById('dateFrom').value = '';
  document.getElementById('dateTo').value = '';
  renderAll();
}
