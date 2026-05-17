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

async function startRandomNoteHighValuePractice(limit) {
  const current = randomNoteReviewQueue[randomNoteReviewIndex];
  if (!current || !current.nodeId) {
    showToast('当前没有可练习笔记', 'warning');
    return;
  }
  if (typeof hasFullWorkspaceDataLoaded === 'function'
      && typeof ensureFullWorkspaceDataLoaded === 'function'
      && !hasFullWorkspaceDataLoaded()) {
    showToast('正在加载完整错题数据...', 'warning');
    try {
      await ensureFullWorkspaceDataLoaded();
    } catch (e) {
      showToast('错题数据加载失败，请稍后重试', 'error');
      return;
    }
  }
  if (!(await ensureQuizModalReady())) return;
  const maxItems = Math.max(1, Number(limit || 5));
  const pool = _collectErrorsForRandomNotePractice(current.nodeId);
  if (!pool.length) {
    showToast('这条笔记下暂无可练习错题', 'warning');
    return;
  }
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
  quizQueue = ranked.slice(0, maxItems).map(row => row.item);
  if (!quizQueue.length) {
    showToast('没有可练习题目', 'warning');
    return;
  }
  quizSessionMode = 'note';
  quizIdx = 0;
  quizAnswers = [];
  quizSkipped = new Set();
  document.getElementById('quizTitleText').textContent = `笔记专项练习 · ${current.title} (${quizQueue.length}题)`;
  closeModal('randomNoteReviewModal');
  openModal('quizModal');
  renderQuizQuestion();
}

function startRandomNoteReview() {
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

function openRandomNoteInWorkspace() {
  const current = randomNoteReviewQueue[randomNoteReviewIndex];
  if (!current || !current.nodeId) return;
  _openRandomNoteInWorkspace(current.nodeId);
}
