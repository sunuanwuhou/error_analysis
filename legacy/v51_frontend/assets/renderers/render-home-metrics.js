(function () {
  let rafToken = 0;

  function refreshHomeMetricsIfVisible() {
    if (rafToken) return;
    rafToken = requestAnimationFrame(() => {
      rafToken = 0;
      const homeActive = window.currentAppView === 'home' || document.getElementById('homeView')?.classList.contains('active');
      if (homeActive && typeof window.renderHomeDashboard === 'function') {
        window.renderHomeDashboard();
      }
    });
  }

  window.V53HomeMetricsRenderer = { refreshHomeMetricsIfVisible };
})();
