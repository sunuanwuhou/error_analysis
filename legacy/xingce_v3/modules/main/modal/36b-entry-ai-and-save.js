// ============================================================
// Entry modal: AI analyze and save flow
// ============================================================

// 鑾峰彇褰撳墠棰樺瀷宸叉湁鐨勫瓙绫诲瀷/涓夌骇鍒嗙被锛堜緵鑷姩琛ュ叏锛?
function getExistingSubtypes() {
  const type = document.getElementById('editType')?.value || '';
  const subtypes = [...new Set(getErrorEntries().filter(e => e.type === type).map(e => e.subtype).filter(Boolean))];
  const subtype = document.getElementById('editSubtype')?.value?.trim() || '';
  const subSubtypes = [...new Set(getErrorEntries().filter(e => e.type === type && e.subtype === subtype).map(e => e.subSubtype).filter(Boolean))];
  return { subtypes, subSubtypes };
}

function resetAIAnalyzeState() {
  aiAnalyzeBusy = false;
  aiAnalyzeResult = null;
  const statusEl = document.getElementById('aiAnalyzeStatus');
  const panelEl = document.getElementById('aiAnalyzePanel');
  const applyAllBtn = document.getElementById('aiApplyAllBtn');
  const analyzeBtn = document.getElementById('aiAnalyzeBtn');
  if (statusEl) statusEl.textContent = '';
  if (panelEl) {
    panelEl.style.display = 'none';
    panelEl.innerHTML = '';
  }
  if (applyAllBtn) applyAllBtn.style.display = 'none';
  if (analyzeBtn) {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = 'AI Analyze';
  }
}

function getAIFieldLabel(key) {
  return ({
    type: 'Level 1',
    subtype: 'Level 2',
    subSubtype: 'Level 3',
    rootReason: 'Root reason',
    errorReason: 'Trigger point',
    analysis: 'Correct model'
  })[key] || key;
}

function collectAIAnalyzePayload() {
  const existing = getExistingSubtypes();
  return {
    type: document.getElementById('editType').value || '',
    subtype: document.getElementById('editSubtype').value.trim(),
    subSubtype: document.getElementById('editSubSubtype').value.trim(),
    question: document.getElementById('editQuestion').value.trim(),
    options: document.getElementById('editOptions').value.trim(),
    answer: document.getElementById('editAnswer').value.trim(),
    myAnswer: document.getElementById('editMyAnswer').value.trim(),
    rootReason: document.getElementById('editRootReason').value.trim(),
    errorReason: document.getElementById('editErrorReason').value.trim(),
    analysis: document.getElementById('editAnalysis').value.trim(),
    availableSubtypes: existing.subtypes,
    availableSubSubtypes: existing.subSubtypes
  };
}

function applyAISuggestionField(key, value) {
  const val = String(value || '').trim();
  if (!val) return;
  if (key === 'type') {
    document.getElementById('editType').value = val;
    updateSubtypeOptions();
    refreshKnowledgePicker();
  } else if (key === 'subtype') {
    document.getElementById('editSubtype').value = val;
    refreshKnowledgePicker();
  } else if (key === 'subSubtype') {
    document.getElementById('editSubSubtype').value = val;
    refreshKnowledgePicker();
  } else if (key === 'rootReason') {
    document.getElementById('editRootReason').value = val;
  } else if (key === 'errorReason') {
    setReasonFormValue(val);
  } else if (key === 'analysis') {
    document.getElementById('editAnalysis').value = val;
  }
  renderAIAnalyzePanel();
}

function applyAISuggestionFieldEncoded(key, encodedValue) {
  applyAISuggestionField(key, decodeURIComponent(encodedValue || ''));
}

function applyAISuggestions() {
  if (!aiAnalyzeResult) return;
  ['type', 'subtype', 'subSubtype', 'rootReason', 'errorReason', 'analysis'].forEach(key => {
    applyAISuggestionField(key, aiAnalyzeResult[key] || '');
  });
  const statusEl = document.getElementById('aiAnalyzeStatus');
  if (statusEl) statusEl.textContent = 'AI suggestions applied';
}

function copyAIAnalyzeJson() {
  if (!aiAnalyzeResult) return;
  const text = JSON.stringify(aiAnalyzeResult, null, 2);
  const statusEl = document.getElementById('aiAnalyzeStatus');
  navigator.clipboard.writeText(text).then(() => {
    if (statusEl) statusEl.textContent = 'JSON copied';
  }).catch(() => {
    if (statusEl) statusEl.textContent = 'JSON copy failed';
  });
}

function renderAIAnalyzePanel() {
  const panelEl = document.getElementById('aiAnalyzePanel');
  const applyAllBtn = document.getElementById('aiApplyAllBtn');
  if (!panelEl || !aiAnalyzeResult) return;
  const rawJson = escapeHtml(JSON.stringify(aiAnalyzeResult, null, 2));
  panelEl.innerHTML = `
    <div style="margin-bottom:10px;padding:8px 10px;background:#fff;border:1px solid #ececec;border-radius:6px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
        <div style="font-weight:600;color:#555">AI JSON Result</div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="copyAIAnalyzeJson()">Copy JSON</button>
      </div>
      <pre style="margin:0;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.6;color:#222;background:none;border:none;padding:0">${rawJson}</pre>
    </div>
  `;
  panelEl.style.display = '';
  if (applyAllBtn) applyAllBtn.style.display = '';
}

async function analyzeEntryWithAI() {
  if (aiAnalyzeBusy) return;
  const payload = collectAIAnalyzePayload();
  if (!payload.question) {
    showToast('Please enter the question first', 'warning');
    document.getElementById('editQuestion').focus();
    return;
  }
  if (!payload.answer) {
    showToast('Please enter the correct answer first', 'warning');
    document.getElementById('editAnswer').focus();
    return;
  }
  aiAnalyzeBusy = true;
  const analyzeBtn = document.getElementById('aiAnalyzeBtn');
  const statusEl = document.getElementById('aiAnalyzeStatus');
  if (analyzeBtn) {
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
  }
  if (statusEl) statusEl.textContent = 'Calling Minimax...';
  try {
    const res = await fetch('/api/ai/analyze-entry', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.error || 'AI analysis failed');
    aiAnalyzeResult = data.result || null;
    renderAIAnalyzePanel();
    if (statusEl) {
      const model = aiAnalyzeResult && aiAnalyzeResult.model ? ` (${aiAnalyzeResult.model})` : '';
      statusEl.textContent = 'AI analysis completed' + model;
    }
  } catch (e) {
    aiAnalyzeResult = null;
    const panelEl = document.getElementById('aiAnalyzePanel');
    const applyAllBtn = document.getElementById('aiApplyAllBtn');
    if (panelEl) {
      panelEl.style.display = 'none';
      panelEl.innerHTML = '';
    }
    if (applyAllBtn) applyAllBtn.style.display = 'none';
    if (statusEl) statusEl.textContent = e.message || 'AI analysis failed';
    showToast(e.message || 'AI analysis failed', 'error');
  } finally {
    aiAnalyzeBusy = false;
    if (analyzeBtn) {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'AI Analyze';
    }
  }
}

// Save or update an error item.
async function saveError(){
  if (saveErrorBusy) return;
  const level1 = document.getElementById('editType').value;
  const level2 = document.getElementById('editSubtype').value.trim();
  const level3 = document.getElementById('editSubSubtype').value.trim();
  const level4 = (document.getElementById('editLevel4')?.value || '').trim();
  const level5 = (document.getElementById('editLevel5')?.value || '').trim();
  const pathTitles = (typeof normalizeKnowledgePathTitles === 'function')
    ? normalizeKnowledgePathTitles([level1, level2, level3, level4, level5], {
      fallbackTitles: [level1 || '其他', level2 || '未分类', level3 || '未细分']
    })
    : [level1, level2, level3, level4, level5].filter(Boolean);
  const type = pathTitles[0] || '';
  const subtype = pathTitles[1] || '';
  const subSubtype = pathTitles[pathTitles.length - 1] || '';
  const question = document.getElementById('editQuestion').value.trim();
  const options = document.getElementById('editOptions').value.trim();
  const answer = document.getElementById('editAnswer').value.trim();
  const myAnswer = document.getElementById('editMyAnswer').value.trim();
  const rootReason = document.getElementById('editRootReason').value.trim();
  const errorReason = document.getElementById('editErrorReason').value.trim();
  const analysis = document.getElementById('editAnalysis').value.trim();
  const nextAction = (document.getElementById('editNextAction')?.value || '').trim();
  const mistakeType = rootReason;
  const triggerPoint = errorReason;
  const correctModel = analysis;
  const status = normalizeErrorStatusValue(document.getElementById('editStatus').value);
  const difficulty = _modalDiff || 0;
  const srcYear     = document.getElementById('editSrcYear').value;
  const srcProvince = document.getElementById('editSrcProvince').value;
  const srcOrigin   = document.getElementById('editSrcOrigin').value.trim();

  if(!question && !editImgBase64){ showToast('Question cannot be empty', 'warning'); return; }
  if(!subtype){ showToast('Level 2 cannot be empty', 'warning'); document.getElementById('editSubtype').focus(); return; }
  if(!answer){ showToast('Correct answer cannot be empty', 'warning'); document.getElementById('editAnswer').focus(); return; }
  if(!mistakeType){ showToast('Root reason cannot be empty', 'warning'); document.getElementById('editRootReason').focus(); return; }
  if(!triggerPoint){ showToast('Trigger point cannot be empty', 'warning'); document.getElementById('editErrorReason').focus(); return; }
  if(!correctModel){ showToast('Correct model cannot be empty', 'warning'); document.getElementById('editAnalysis').focus(); return; }
  setSaveErrorBusyState(true);
  try {
    const noteNodeId  = resolveKnowledgeNodeIdForSave(pathTitles);
    const knowledgePathTitles = noteNodeId && typeof getKnowledgePathTitles === 'function'
      ? collapseKnowledgePathTitles(getKnowledgePathTitles(noteNodeId))
      : pathTitles.slice();
    const knowledgePathText = knowledgePathTitles.join(' > ');
    const id = editingId ? normalizeErrorId(editingId) : null;

    // Use new image if present, keep the existing image otherwise.
    const existing = id ? findErrorById(id) : null;
    const prevImgData = existing?.imgData || null;
    const prevAnalysisImgData = existing?.analysisImgData || null;

    let imgData;
    if (editImgDeleted) {
      imgData = null;
      await unrefImageValue(prevImgData);
    } else if (editImgBase64) {
      imgData = await uploadImageValue(editImgBase64);
      if (prevImgData && prevImgData !== imgData) await unrefImageValue(prevImgData);
    } else {
      imgData = prevImgData;
    }

    let analysisImgData;
    if (editAnalysisImgDeleted) {
      analysisImgData = null;
      await unrefImageValue(prevAnalysisImgData);
    } else if (editAnalysisImgBase64) {
      analysisImgData = await uploadImageValue(editAnalysisImgBase64);
      if (prevAnalysisImgData && prevAnalysisImgData !== analysisImgData) await unrefImageValue(prevAnalysisImgData);
    } else {
      analysisImgData = prevAnalysisImgData;
    }

    let savedErrorId = '';
    const data = {
      type, subtype, subSubtype, question, options, answer, myAnswer, rootReason, errorReason, analysis, status, difficulty,
      imgData, analysisImgData, srcYear, srcProvince, srcOrigin, noteNodeId,
      mistakeType, triggerPoint, correctModel, nextAction,
      knowledgePathTitles,
      knowledgePath: knowledgePathText,
      knowledgeNodePath: knowledgePathText,
      notePath: knowledgePathText
    };
    if(existing){
      const old = existing;
      if (!old.id) old.id = newId();
      old.id = normalizeErrorId(old.id);
      const oldType = old ? old.type : null;
      Object.assign(old, data);
      normalizeErrorForWorkflow(old);
      touchErrorUpdatedAt(old);
      // 棰樺瀷鏀瑰悕 鈫?鍚屾绗旇 key
      if (oldType && oldType !== type && notesByType[oldType] !== undefined) {
        if (!notesByType[type]) notesByType[type] = notesByType[oldType];
        // 鏃?key 浠呭湪娌℃湁鍏朵粬閿欓浣跨敤鏃舵墠鍒犻櫎
        const stillUsed = errors.some(e => e.type === oldType);
        if (!stillUsed) delete notesByType[oldType];
        saveNotesByType();
      }
      recordErrorUpsert(old);
      savedErrorId = normalizeErrorId(old.id);
      showToast('Updated successfully', 'success');
    }else{
      const newErr = {
        id:newId(),
        entryKind:'error',
        addDate:today(),
        updatedAt:new Date().toISOString(),
        masteryLevel:'not_mastered',
        masteryUpdatedAt:null,
        lastPracticedAt:null,
        ...data
      };
      normalizeErrorForWorkflow(newErr);
      errors.push(newErr);
      recordErrorUpsert(newErr);
      savedErrorId = normalizeErrorId(newErr.id);
      showToast('Added successfully', 'success');
    }
    refreshWorkspaceAfterErrorMutation({ save:true, syncNotes:true, saveKnowledge:true, renderNotes:true });
    try {
      if (window.__pendingAttemptLink && typeof window.syncAttemptLinkAfterSave === 'function') {
        window.syncAttemptLinkAfterSave({
          attemptId: window.__pendingAttemptLink.attemptId || '',
          errorId: savedErrorId,
          noteNodeId,
          mistakeType,
          triggerPoint,
          correctModel,
          nextAction
        });
      }
      if (savedErrorId && typeof window.invalidatePracticeAttemptSummaries === 'function') {
        window.invalidatePracticeAttemptSummaries([savedErrorId]);
      }
    } catch (linkErr) { console.warn('attempt link sync failed', linkErr); }
    setSaveErrorBusyState(false);
    closeModal('addModal');
  } catch (e) {
    showToast(e && e.message ? e.message : 'Save failed, please try again', 'error');
  } finally {
    if (saveErrorBusy) setSaveErrorBusyState(false);
  }
}
