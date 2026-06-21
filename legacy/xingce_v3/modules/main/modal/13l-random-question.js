// ============================================================
// Random question pick (wrong-count + duration, 3-day cooldown)
// ============================================================
const RANDOM_QUESTION_PICK_KEY = 'xingce_random_question_picks';
const RANDOM_QUESTION_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

function _readRandomQuestionPickRecord() {
  try {
    const raw = localStorage.getItem(RANDOM_QUESTION_PICK_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function _writeRandomQuestionPickRecord(record) {
  try {
    localStorage.setItem(RANDOM_QUESTION_PICK_KEY, JSON.stringify(record || {}));
  } catch (e) {}
}

function markRandomQuestionPicked(errorId) {
  if (!errorId) return;
  const record = _readRandomQuestionPickRecord();
  record[String(errorId)] = new Date().toISOString();
  _writeRandomQuestionPickRecord(record);
}

function _isRandomQuestionMastered(errorItem) {
  if (!errorItem) return true;
  if (typeof isEffectivelyMastered === 'function') return isEffectivelyMastered(errorItem);
  return String(errorItem.status || '') === 'mastered' || String(errorItem.masteryLevel || '') === 'mastered';
}

function _isRandomQuestionEligible(errorItem, record, nowMs) {
  if (!errorItem || !errorItem.id || _isRandomQuestionMastered(errorItem)) return false;
  const pickedAt = record[String(errorItem.id)];
  if (!pickedAt) return true;
  const ts = Date.parse(pickedAt);
  return !Number.isFinite(ts) || nowMs - ts >= RANDOM_QUESTION_COOLDOWN_MS;
}

function countEligibleRandomQuestions() {
  const record = _readRandomQuestionPickRecord();
  const now = Date.now();
  if (typeof getErrorEntries !== 'function') return 0;
  return getErrorEntries().filter(e => _isRandomQuestionEligible(e, record, now)).length;
}

function refreshRandomQuestionBadge() {
  const badge = document.getElementById('randomQuestionBadge');
  if (!badge) return;
  badge.textContent = String(countEligibleRandomQuestions());
}

function _computeRandomQuestionWeight(errorItem) {
  if (typeof _computeRandomNotePracticePriority === 'function') {
    const priority = _computeRandomNotePracticePriority(errorItem);
    return Math.max(
      0.001,
      (0.5 * Math.log1p(Number(priority.wrongCount || 0)))
      + (0.3 * Number(priority.recentWrong || 0))
      + (0.2 * Number(priority.durationOverTarget || 0)),
    );
  }
  const wrongCount = Number(errorItem && errorItem.quiz && errorItem.quiz.wrongCount || errorItem.wrongCount || 0);
  const duration = Number(errorItem.actualDurationSec || errorItem.lastDuration || 0);
  return Math.max(0.001, 0.6 * Math.log1p(wrongCount) + 0.4 * Math.log1p(duration / 30));
}

function _pickWeightedRandomQuestion(pool) {
  if (!pool || !pool.length) return null;
  const weighted = pool.map(entry => ({ entry, weight: _computeRandomQuestionWeight(entry) }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.entry;
  }
  return weighted[weighted.length - 1].entry;
}

function pickRandomQuestionEntry() {
  const record = _readRandomQuestionPickRecord();
  const now = Date.now();
  const pool = getErrorEntries().filter(e => _isRandomQuestionEligible(e, record, now));
  if (!pool.length) return { entry: null, reason: '近 3 天可抽题目已练完，请稍后再试' };
  const entry = _pickWeightedRandomQuestion(pool);
  if (!entry) return { entry: null, reason: '抽题失败，请重试' };
  markRandomQuestionPicked(entry.id);
  return { entry };
}

async function startRandomQuestion() {
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
  const { entry, reason } = pickRandomQuestionEntry();
  if (!entry) {
    showToast(reason || '暂无可随机练习的错题', 'warning');
    return;
  }
  quizQueue = [entry];
  quizSessionMode = 'random';
  quizIdx = 0;
  quizAnswers = [];
  quizSkipped = new Set();
  resetQuizPauseState();
  document.getElementById('quizTitleText').textContent = '🎲 随机题目';
  openModal('quizModal');
  renderQuizQuestion();
  refreshRandomQuestionBadge();
}
