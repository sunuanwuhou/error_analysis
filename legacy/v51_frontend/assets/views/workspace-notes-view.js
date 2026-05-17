(function () {
  function initWorkspaceNotesView() {
    const view = document.getElementById('tabContentNotes');
    if (!view) return;
    view.dataset.v53ViewReady = '1';
  }
  window.V53Views = Object.assign(window.V53Views || {}, { initWorkspaceNotesView });
})();
