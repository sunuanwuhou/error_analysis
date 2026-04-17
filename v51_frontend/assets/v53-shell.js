(function () {
  if (window.__v53ShellOptimizedInitDone) return;
  window.__v53ShellOptimizedInitDone = true;

  function init() {
    const core = window.V53ShellCore;
    const mobile = window.V53ShellMobile;
    const views = window.V53Views || {};
    if (!core || !mobile) return;

    core.wrapSwitchTab();
    mobile.bindQuickActions(core);
    mobile.closeSidebarOnMainClick(core);
    mobile.syncQuizBadges(core);

    views.initHomeView?.();
    views.initWorkspaceErrorsView?.();
    views.initWorkspaceNotesView?.();
    views.initQuizView?.();

    core.updateBottomActive();
    core.updateHeaderTitle();
    core.enhanceSidebarButtons();

    mobile.installResizeHandler(core);
    mobile.observeNotesTitle(core);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
