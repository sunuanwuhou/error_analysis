(function () {
  function initQuizView() {
    const quiz = document.getElementById('quizModal');
    if (!quiz) return;
    quiz.dataset.v53ViewReady = '1';
  }
  window.V53Views = Object.assign(window.V53Views || {}, { initQuizView });
})();
