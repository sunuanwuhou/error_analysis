// ============================================================
// Random note review actions
// ============================================================
function _markRandomNoteViewed(nodeId) {
  if (!nodeId) return;
  noteReviewTracking = noteReviewTracking || {};
  const current = noteReviewTracking[nodeId] || {};
  noteReviewTracking[nodeId] = {
    ...current,
    nodeId,
    lastViewedAt: new Date().toISOString(),
    lastViewedDate: today(),
    lastSource: 'random_note_review',
    lastRandomReviewAt: new Date().toISOString(),
    viewCount: Number(current.viewCount || 0) + 1,
  };
  if (typeof saveNoteReviewTracking === 'function') saveNoteReviewTracking();
}

function _openRandomNoteInWorkspace(nodeId) {
  if (!nodeId) return;
  closeModal('randomNoteReviewModal');
  if (typeof noteEditing !== 'undefined') noteEditing = false;
  if (typeof switchAppView === 'function') switchAppView('workspace');
  let attempts = 0;
  const locate = () => {
    attempts += 1;
    if (typeof setCurrentKnowledgeNode === 'function') {
      setCurrentKnowledgeNode(nodeId, { switchTab: true, mode: 'note' });
      return;
    }
    if (attempts >= 25) return;
    setTimeout(locate, 120);
  };
  locate();
}

function _setQuizModalNotePracticeStyle(enabled) {
  const quizModal = document.getElementById('quizModal');
  if (!quizModal) return;
  quizModal.classList.toggle('quiz-modal--note-practice', !!enabled);
}

async function _ensureRandomNotePracticeDataReady() {
  if (typeof hasFullWorkspaceDataLoaded === 'function'
      && typeof ensureFullWorkspaceDataLoaded === 'function'
      && !hasFullWorkspaceDataLoaded()) {
    showToast('正在加载完整错题数据...', 'warning');
    try {
      await ensureFullWorkspaceDataLoaded();
    } catch (e) {
      showToast('错题数据加载失败，请稍后重试', 'error');
      return false;
    }
  }
  if (!(await ensureQuizModalReady())) return false;
  return true;
}

async function _startRandomNotePractice(limit, pickQueueFn, titlePrefix) {
  const current = randomNoteReviewQueue[randomNoteReviewIndex];
  if (!current || !current.nodeId) {
    showToast('当前没有可练习笔记', 'warning');
    return;
  }
  if (!(await _ensureRandomNotePracticeDataReady())) return;
  const maxItems = Math.max(1, Number(limit || 5));
  const pool = _collectErrorsForRandomNotePractice(current.nodeId);
  if (!pool.length) {
    showToast('这条笔记下暂无可练习错题', 'warning');
    return;
  }
  const quizItems = pickQueueFn(pool, maxItems);
  if (!quizItems.length) {
    showToast('没有可练习题目', 'warning');
    return;
  }
  quizQueue = quizItems;
  quizSessionMode = 'note';
  quizIdx = 0;
  quizAnswers = [];
  quizSkipped = new Set();
  document.getElementById('quizTitleText').textContent = `${titlePrefix} · ${current.title} (${quizQueue.length}题)`;
  _setQuizModalNotePracticeStyle(true);
  closeModal('randomNoteReviewModal');
  openModal('quizModal');
  renderQuizQuestion();
}

async function startRandomNoteHighValuePractice(limit) {
  await _startRandomNotePractice(limit, (pool, maxItems) => {
    const ranked = pool.map(item => {
      const priority = _computeRandomNotePracticePriority(item);
      return { item, priority };
    }).sort((a, b) => {
      if (b.priority.score !== a.priority.score) return b.priority.score - a.priority.score;
      if (b.priority.wrongCount !== a.priority.wrongCount) return b.priority.wrongCount - a.priority.wrongCount;
      const ta = String(a.item.updatedAt || a.item.lastPracticedAt || '');
      const tb = String(b.item.updatedAt || b.item.lastPracticedAt || '');
      return tb.localeCompare(ta);
    });
    return ranked.slice(0, maxItems).map(row => row.item);
  }, '笔记高价值练习');
}

async function startRandomNoteAllPractice(limit) {
  await _startRandomNotePractice(limit, (pool, maxItems) => {
    return _shuffleArray(pool).slice(0, maxItems);
  }, '笔记全部错题');
}

function startRandomNoteReview() {
  randomNoteSkipSet = new Set();
  const queue = _buildRandomNoteReviewQueue('');
  if (!queue.length) {
    showToast('暂无可复习笔记（需要有内容）', 'warning');
    return;
  }
  randomNoteReviewQueue = queue;
  randomNoteReviewIndex = 0;
  ensureRandomNoteReviewModal();
  openModal('randomNoteReviewModal');
  renderRandomNoteReview();
}

function randomNoteReviewPrev() {
  if (randomNoteReviewIndex <= 0) return;
  randomNoteReviewIndex -= 1;
  renderRandomNoteReview();
}

function randomNoteReviewNext() {
  if (randomNoteReviewIndex >= randomNoteReviewQueue.length - 1) return;
  randomNoteReviewIndex += 1;
  renderRandomNoteReview();
}

function randomNoteReviewShuffle() {
  const current = randomNoteReviewQueue[randomNoteReviewIndex];
  const nextQueue = _buildRandomNoteReviewQueue(current && current.nodeId);
  if (!nextQueue.length) {
    showToast('没有更多可切换笔记', 'warning');
    return;
  }
  randomNoteReviewQueue = nextQueue;
  randomNoteReviewIndex = 0;
  renderRandomNoteReview();
}

function randomNoteReviewSkip() {
  const current = randomNoteReviewQueue[randomNoteReviewIndex];
  if (!current || !current.nodeId) return;
  randomNoteSkipSet.add(String(current.nodeId));
  const hadNext = randomNoteReviewIndex < randomNoteReviewQueue.length - 1;
  randomNoteReviewQueue = randomNoteReviewQueue.filter(item => item.nodeId !== current.nodeId);
  if (!randomNoteReviewQueue.length) {
    randomNoteReviewIndex = -1;
    renderRandomNoteReview();
    showToast('当前筛选下没有更多笔记', 'warning');
    return;
  }
  if (!hadNext) randomNoteReviewIndex = Math.max(0, randomNoteReviewQueue.length - 1);
  renderRandomNoteReview();
}

function setRandomNoteQueueMode(mode) {
  const nextMode = String(mode || '') === 'priority' ? 'priority' : 'weighted';
  if (randomNoteQueueMode === nextMode) return;
  randomNoteQueueMode = nextMode;
  if (!rebuildRandomNoteReviewQueue({ mode: nextMode })) {
    showToast('当前条件下没有可复习笔记', 'warning');
  }
  renderRandomNoteReview();
}

function setRandomNoteRootFilter(rootId) {
  randomNoteRootFilter = String(rootId || '');
  if (!rebuildRandomNoteReviewQueue({ rootId: randomNoteRootFilter })) {
    showToast('该模块下没有可复习笔记', 'warning');
  }
  renderRandomNoteReview();
}

function openRandomNoteInWorkspace() {
  const current = randomNoteReviewQueue[randomNoteReviewIndex];
  if (!current || !current.nodeId) return;
  _openRandomNoteInWorkspace(current.nodeId);
}
