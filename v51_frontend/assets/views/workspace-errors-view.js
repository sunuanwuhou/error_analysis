(function () {
  function initWorkspaceErrorsView() {
    const view = document.getElementById('tabContentErrors');
    if (!view) return;
    view.dataset.v53ViewReady = '1';
  }
  window.V53Views = Object.assign(window.V53Views || {}, { initWorkspaceErrorsView });
})();
