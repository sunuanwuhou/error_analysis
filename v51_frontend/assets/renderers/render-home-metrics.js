(function () {
  function refreshHomeMetricsIfVisible() {
    const homeActive = window.currentAppView === 'home' || document.getElementById('homeView')?.classList.contains('active');
    if (homeActive && typeof window.renderHomeDashboard === 'function') {
      window.renderHomeDashboard();
    }
  }

  window.V53HomeMetricsRenderer = { refreshHomeMetricsIfVisible };
})();
