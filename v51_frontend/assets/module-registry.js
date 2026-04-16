(function () {
  window.V53ModuleRegistry = {
    deferredActions: [
      'switchAppView',
      'openWorkspaceView',
      'openWorkspaceTaskView',
      'openWorkspaceQuickAdd',
      'switchTab',
      'openQuickAddModal',
      'startQuiz',
      'startFullPractice',
    ],
    bootScripts: [
      '/assets/modules/mathjax-config.js',
      '/assets/vendor/mathjax/tex-svg.js',
    ],
    shellModules: [
      '/v51-static/assets/shell/core-state.js',
      '/v51-static/assets/shell/mobile-actions.js',
    ],
    viewModules: [
      '/v51-static/assets/views/home-view.js',
      '/v51-static/assets/views/workspace-errors-view.js',
      '/v51-static/assets/views/workspace-notes-view.js',
      '/v51-static/assets/views/quiz-view.js',
    ],
    rendererModules: [
      '/v51-static/assets/renderers/render-attempt-card.js',
      '/v51-static/assets/renderers/render-review-extra.js',
      '/v51-static/assets/renderers/render-home-metrics.js',
    ],
    featureModules: [
      '/v51-static/assets/features/attempt-sync.js',
      '/v51-static/assets/features/attempt-modal.js',
      '/v51-static/assets/features/attempt-panel.js',
    ],
    appEntryModules: [
      '/v51-static/assets/v53-shell.js',
      '/v51-static/assets/final-flow.js',
      '/v51-static/assets/process-canvas-ultimate.js',
    ],
  };
})();
