// ============================================================
// Startup summary and deferred-load helpers
// ============================================================
function isLikelyMobileLikeDevice() {
  try {
    if (window.matchMedia && window.matchMedia('(max-width: 1024px)').matches) return true;
    if (typeof navigator !== 'undefined') {
      if (Number(navigator.maxTouchPoints || 0) >= 2 && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
      const ua = String(navigator.userAgent || '').toLowerCase();
      if (/iphone|ipad|android|mobile|tablet/.test(ua)) return true;
    }
  } catch (e) {}
  return false;
}

function shouldDeferFullDataLoadOnStartup() {
  const summary = startupSummaryCache || {};
  const bytes = Number(summary.errorsBytes || 0);
  const totalErrors = Number(summary.totalErrors || 0);
  // On large datasets, eager JSON parse blocks the main thread during refresh.
  // Always defer full-load and enter with lightweight summary first.
  if (bytes >= 1024 * 1024 || totalErrors >= 1200) return true;
  return isLikelyMobileLikeDevice() && bytes >= 512 * 1024;
}

async function loadStartupSummaryCacheFromDb() {
  try {
    startupSummaryCache = JSON.parse(await DB.get(KEY_STARTUP_SUMMARY) || 'null');
  } catch (e) {
    startupSummaryCache = null;
  }
  return startupSummaryCache;
}

function buildStartupSummary(errorsBytes) {
  const summary = {
    builtAt: new Date().toISOString(),
    errorsBytes: Number(errorsBytes || 0),
    totalErrors: 0,
    fullPracticeCount: 0,
    todayDone: Number(todayDone || 0),
    todayDue: 0,
    noteFirstCount: 0,
    directDoCount: 0,
    speedDrillCount: 0,
    accuracy: 0,
    weakestReasons: [],
    workflowAdvice: []
  };
  if (typeof buildPracticeTaskPack === 'function') {
    const taskPack = buildPracticeTaskPack(24);
    summary.totalErrors = getErrorEntries().length;
    summary.fullPracticeCount = getErrorEntries().filter(e => !isEffectivelyMastered(e)).length;
    summary.todayDue = Number((taskPack.dailyQueue || []).length || 0);
    summary.noteFirstCount = Number((taskPack.noteFirstQueue || []).length || 0);
    summary.directDoCount = Number((taskPack.directDoQueue || []).length || 0);
    summary.speedDrillCount = Number((taskPack.speedDrillQueue || []).length || 0);
    summary.weakestReasons = (taskPack.weakestReasons || []).slice(0, 5);
    summary.workflowAdvice = (taskPack.advice || []).slice(0, 4);
  }
  if (typeof getPracticeBehaviorSnapshot === 'function') {
    const behavior = getPracticeBehaviorSnapshot(7) || {};
    summary.accuracy = Number(behavior.accuracy || 0);
  }
  startupSummaryCache = summary;
  return summary;
}

function persistStartupSummary(errorsText) {
  try {
    const summary = buildStartupSummary(String(errorsText || '').length);
    queuePersist(KEY_STARTUP_SUMMARY, summary, 80);
  } catch (e) {
    console.warn('[persistStartupSummary] failed', e);
  }
}
