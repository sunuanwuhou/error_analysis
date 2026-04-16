(function () {
  function byId(id) { return document.getElementById(id); }
  function isMobile() { return window.matchMedia('(max-width: 768px)').matches; }

  function updateBottomActive() {
    const notes = document.body.classList.contains('tab-notes-active');
    const errors = document.body.classList.contains('tab-errors-active');
    byId('mobileQuickNotes')?.classList.toggle('active', notes);
    byId('mobileQuickErrors')?.classList.toggle('active', errors);
  }

  function updateHeaderTitle() {
    const title = byId('mobileHeaderTitle');
    if (!title) return;
    if (document.body.classList.contains('tab-errors-active')) {
      title.textContent = '错题列表';
      return;
    }
    const nodeTitle = document.querySelector('.knowledge-workspace-title')?.textContent?.trim();
    title.textContent = nodeTitle || '学习笔记';
  }

  function enhanceSidebarButtons() {
    const loadBtn = document.querySelector('.sidebar-cloud-actions .btn:nth-child(1)');
    const saveBtn = document.querySelector('.sidebar-cloud-actions .btn:nth-child(2)');
    if (loadBtn) loadBtn.textContent = isMobile() ? '加载' : 'Cloud Load';
    if (saveBtn) saveBtn.textContent = isMobile() ? '保存' : 'Cloud Save';
  }

  function wrapSwitchTab() {
    if (typeof window.switchTab !== 'function' || window.__v53SwitchWrapped) return;
    const original = window.switchTab;
    window.switchTab = function wrappedSwitchTab(tabName) {
      const result = original.apply(this, arguments);
      updateBottomActive();
      updateHeaderTitle();
      return result;
    };
    window.__v53SwitchWrapped = true;
  }

  window.V53ShellCore = {
    byId,
    isMobile,
    updateBottomActive,
    updateHeaderTitle,
    enhanceSidebarButtons,
    wrapSwitchTab,
  };
})();
