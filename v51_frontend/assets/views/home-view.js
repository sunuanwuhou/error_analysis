(function () {
  function initHomeView() {
    const home = document.getElementById('homeView');
    if (!home) return;
    home.dataset.v53ViewReady = '1';
  }
  window.V53Views = Object.assign(window.V53Views || {}, { initHomeView });
})();
